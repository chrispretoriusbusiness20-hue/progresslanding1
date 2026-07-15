import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import productsData from "@/data/products.json";
import productsFullData from "@/data/products-full.json";

const PRODUCT_IMAGE_MAP = new Map(
  (productsFullData as Array<{ name: string; image?: string }>).map((p) => [p.name, p.image ?? ""]),
);

function resolveProductImage(productName: string): string {
  const direct = PRODUCT_IMAGE_MAP.get(productName);
  if (direct) return direct;
  // Fuzzy fallback: pick the catalog entry with the most token overlap.
  const qTokens = productName
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2);
  if (qTokens.length === 0) return "";
  const qSet = new Set(qTokens);
  let best: { image: string; score: number } | null = null;
  for (const p of productsFullData as Array<{ name: string; image?: string }>) {
    if (!p.image) continue;
    const pTokens = p.name
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 2);
    let overlap = 0;
    for (const t of pTokens) if (qSet.has(t)) overlap++;
    if (overlap >= 2) {
      const score = overlap + overlap / Math.max(pTokens.length, 1);
      if (!best || score > best.score) best = { image: p.image, score };
    }
  }
  return best?.image ?? "";
}



const MAPS_GATEWAY = "https://connector-gateway.lovable.dev/google_maps";
const SHEETS_GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";
const CALENDAR_GATEWAY = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";
const QUOTE_SHEET_ID = "1AVvNPoavrAf0ptWt4dUXdA2zmGqNjA70ebPXn-gJgW8";
const QUOTE_TEAM_EMAIL = "sales@progressgrp.co.za";
const QUOTE_CC_EMAILS = [
  "louis@progressgrp.co.za",
  "chris@progressinstallations.co.za",
];
const ORIGIN_ADDRESS =
  "Progress Lighting & Fires, 189 Durban Rd, Bellville, Cape Town, 7530, South Africa";
const QUOTE_BUCKET = "quotes";
const QUOTE_SIGNED_URL_EXPIRES_S = 60 * 60 * 24 * 30; // 30 days

const QUOTE_PATH_RE = /^\d{4}-\d{2}-\d{2}\/[0-9a-f-]{36}-[A-Za-z0-9._-]+\.pdf$/;
const RECENT_UPLOAD_WINDOW_MS = 10 * 60 * 1000; // emails only allowed within 10 min of upload

/**
 * Direct-upload flow: avoid pushing 1MB+ of base64 through the RPC channel
 * (Safari mobile aborts with "Load failed"). The browser uploads the PDF
 * blob straight to storage via a signed upload URL, then we email by path.
 */
export const createQuoteUploadUrl = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      filename: z
        .string()
        .trim()
        .min(1)
        .max(200)
        .regex(/\.pdf$/i, "filename must end with .pdf"),
      email: z.string().trim().email().max(200),
      session: z.string().trim().min(10).max(300),
    }),
  )
  .handler(async ({ data }) => {
    try {
      const { verifyQuoteSession } = await import("@/lib/quote-session.server");
      if (!verifyQuoteSession(data.email, data.session)) {
        return { ok: false as const, error: "Unauthorized" };
      }
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const safeName = data.filename.replace(/[^A-Za-z0-9._-]/g, "_");
      const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safeName}`;
      const { data: signed, error } = await supabaseAdmin.storage
        .from(QUOTE_BUCKET)
        .createSignedUploadUrl(path);
      if (error || !signed) {
        return { ok: false as const, error: error?.message ?? "Failed to create upload URL" };
      }
      return { ok: true as const, path, token: signed.token, signedUrl: signed.signedUrl };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  });

export const emailQuoteFromPath = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      to: z.string().trim().email().max(200),
      path: z
        .string()
        .trim()
        .min(1)
        .max(500)
        .regex(QUOTE_PATH_RE, "invalid quote path"),
      clientName: z.string().trim().min(1).max(200).optional(),
      quoteNo: z.string().trim().min(1).max(80).optional(),
      productName: z.string().trim().min(1).max(300).optional(),
      session: z.string().trim().min(10).max(300),
    }),
  )
  .handler(async ({ data }) => {
    try {
      const { verifyQuoteSession } = await import("@/lib/quote-session.server");
      if (!verifyQuoteSession(data.to, data.session)) {
        return { ok: false, error: "Unauthorized", downloadUrl: null };
      }
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      // Verify the object exists AND was uploaded recently — prevents the
      // endpoint from being used to email arbitrary or stale stored files.
      const [folder, name] = data.path.split("/", 2);
      const { data: listed, error: listError } = await supabaseAdmin.storage
        .from(QUOTE_BUCKET)
        .list(folder, { limit: 1, search: name });
      if (listError || !listed?.length) {
        return { ok: false, error: "Quote PDF not found", downloadUrl: null };
      }
      const created = listed[0].created_at ? Date.parse(listed[0].created_at) : 0;
      if (!created || Date.now() - created > RECENT_UPLOAD_WINDOW_MS) {
        return { ok: false, error: "Upload expired; please re-submit", downloadUrl: null };
      }

      const { data: signed, error: signError } = await supabaseAdmin.storage
        .from(QUOTE_BUCKET)
        .createSignedUrl(data.path, QUOTE_SIGNED_URL_EXPIRES_S);
      if (signError || !signed?.signedUrl) {
        return { ok: false, error: signError?.message ?? "Failed to sign URL", downloadUrl: null };
      }

      // Save the uploaded PDF path on the most recent matching quote_requests row
      try {
        const { data: latest } = await supabaseAdmin
          .from("quote_requests")
          .select("id")
          .eq("email", data.to)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (latest?.id) {
          await supabaseAdmin
            .from("quote_requests")
            .update({ pdf_path: data.path })
            .eq("id", latest.id);
        }
      } catch (err) {
        console.error("Failed to save pdf_path on quote_requests", err);
      }
      const { sendSmtpEmailDirect } = await import("@/lib/email/send-smtp.server");
      const clientName = data.clientName ?? "there";
      const productName = data.productName ?? "your selection";
      const quoteNo = data.quoteNo ?? "";
      const expiresInDays = 10;
      const esc = (s: string) =>
        s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const productImage = resolveProductImage(productName);
      const productBlock = productImage
        ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0">
            <tr>
              <td style="padding-right:14px;vertical-align:middle">
                <img src="${esc(productImage)}" alt="${esc(productName)}" width="120" height="120" style="display:block;border:1px solid #eee;border-radius:6px;object-fit:cover" />
              </td>
              <td style="vertical-align:middle;font-family:Arial,sans-serif;color:#111;font-size:14px;line-height:1.5">
                <strong>${esc(productName)}</strong>
              </td>
            </tr>
          </table>`
        : "";
      const { signAcceptance } = await import("@/lib/accept-quote-sign.server");
      const acceptPayload = `${data.to}|${quoteNo}|${productName}|${clientName}|${data.path}`;
      const acceptSig = signAcceptance(acceptPayload);
      const origin =
        process.env.PUBLIC_SITE_URL ?? "https://progressgrp.co.za";
      const acceptUrl = `${origin}/api/public/accept-quote?to=${encodeURIComponent(data.to)}&quoteNo=${encodeURIComponent(quoteNo)}&product=${encodeURIComponent(productName)}&client=${encodeURIComponent(clientName)}&pdfPath=${encodeURIComponent(data.path)}&sig=${acceptSig}`;

      const html = `
        <div style="font-family:Arial,sans-serif;color:#111;max-width:600px">
          <h2 style="margin:0 0 12px;color:#dd7400">Thank you for your enquiry</h2>
          <p>Hi ${esc(clientName)},</p>
          <p>Thank you for requesting a quote from <strong>Progress Group</strong>. We truly appreciate your interest in <strong>${esc(productName)}</strong>.</p>
          <p>Please find your personalised quote ${quoteNo ? `(<strong>${esc(quoteNo)}</strong>) ` : ""}below. If you'd like to proceed, simply click <strong>Accept Quote</strong> and our sales team will be in touch shortly.</p>
          ${productBlock}
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0">
            <tr>
              <td style="padding-right:12px">
                <a href="${acceptUrl}" style="display:inline-block;background:#dd7400;color:#fff;padding:12px 22px;border-radius:4px;text-decoration:none;font-weight:600">Accept Quote</a>
              </td>
              <td>
                <a href="${signed.signedUrl}" style="display:inline-block;background:#fff;color:#dd7400;padding:11px 21px;border:1px solid #dd7400;border-radius:4px;text-decoration:none;font-weight:600">Download your quote (PDF)</a>
              </td>
            </tr>
          </table>
          <p style="margin-top:24px">Kind regards,<br/><strong>The Progress Group Sales Team</strong><br/><a href="mailto:sales@progressgrp.co.za" style="color:#dd7400;text-decoration:none">sales@progressgrp.co.za</a></p>
        </div>`;
      const send = await sendSmtpEmailDirect({
        to: data.to,
        cc: QUOTE_CC_EMAILS,
        subject: `Your Quote - ${quoteNo || "Progress Group"}`,
        html,
        templateName: "quote-customer",
      });
      return {
        ok: send.success,
        error: send.success ? null : send.error ?? "Email failed",
        downloadUrl: signed.signedUrl,
      };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
        downloadUrl: null,
      };
    }
  });




async function createCalendarBooking(args: {
  summary: string;
  description: string;
  location?: string;
  startISO: string;
  endISO: string;
  attendeeEmail: string;
  attendeeName: string;
}): Promise<{ htmlLink: string | null } | null> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const calKey = process.env.GOOGLE_CALENDAR_API_KEY;
  if (!lovableKey || !calKey) return null;
  try {
    const res = await fetch(
      `${CALENDAR_GATEWAY}/calendars/primary/events?sendUpdates=all`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": calKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary: args.summary,
          description: args.description,
          location: args.location,
          start: { dateTime: args.startISO, timeZone: "Africa/Johannesburg" },
          end: { dateTime: args.endISO, timeZone: "Africa/Johannesburg" },
          attendees: [
            { email: args.attendeeEmail, displayName: args.attendeeName },
          ],
        }),
      },
    );
    if (!res.ok) {
      console.error("Calendar create failed", res.status, await res.text());
      return null;
    }
    const data = (await res.json()) as { htmlLink?: string };
    return { htmlLink: data.htmlLink ?? null };
  } catch (err) {
    console.error("Calendar create error", err);
    return null;
  }
}

async function appendToQuoteSheet(row: (string | number | null)[]): Promise<void> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const sheetsKey = process.env.GOOGLE_SHEETS_API_KEY;
  if (!lovableKey || !sheetsKey) return;
  try {
    const url = `${SHEETS_GATEWAY}/spreadsheets/${QUOTE_SHEET_ID}/values/Sheet1!A:Z:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": sheetsKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: [row.map((v) => (v === null ? "" : v))] }),
    });
  } catch (err) {
    console.error("Failed to append quote to Google Sheet", err);
  }
}

type Product = { name: string; price: string; url: string; category: string };
const PRODUCTS = productsData as Product[];

function tokens(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

function matchProduct(query: string): Product | null {
  const q = tokens(query);
  if (q.length === 0) return null;
  const qSet = new Set(q);
  let best: { product: Product; score: number } | null = null;
  for (const p of PRODUCTS) {
    const pTokens = tokens(p.name);
    let overlap = 0;
    for (const t of pTokens) if (qSet.has(t)) overlap++;
    const score = overlap + overlap / Math.max(pTokens.length, 1);
    if (overlap >= 2 && (!best || score > best.score)) best = { product: p, score };
  }
  return best?.product ?? null;
}

function transportPriceForKm(km: number, installationRequired: boolean): { zone: string; price: number } {
  if (!installationRequired) {
    if (km <= 50) return { zone: "Courier within Cape Town (≤50 km)", price: 325 };
    if (km <= 150) return { zone: "Courier 51–150 km (estimate — sales to confirm)", price: 600 };
    if (km <= 300) return { zone: "Courier 151–300 km (estimate — sales to confirm)", price: 1100 };
    return { zone: "Courier 300 km+ (estimate — sales to confirm)", price: 1750 };
  }
  return { zone: "Standard delivery from Bellville", price: 0 };
}


async function computeDistanceKm(destination: string): Promise<number | null> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const mapsKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!lovableKey || !mapsKey) return null;
  const trimmed = destination.trim();
  if (!trimmed) return null;
  if (/^[\d.,\s]+(km|kms|kilometers?)?$/i.test(trimmed)) {
    const n = Number.parseFloat(trimmed.replace(/[^0-9.,]/g, "").replace(",", "."));
    if (Number.isFinite(n) && n > 0 && n < 5000) return n;
  }
  try {
    const res = await fetch(`${MAPS_GATEWAY}/routes/directions/v2:computeRoutes`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": mapsKey,
        "Content-Type": "application/json",
        "X-Goog-FieldMask": "routes.distanceMeters",
      },
      body: JSON.stringify({
        origin: { address: ORIGIN_ADDRESS },
        destination: { address: trimmed },
        travelMode: "DRIVE",
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { routes?: { distanceMeters?: number }[] };
    const meters = data.routes?.[0]?.distanceMeters;
    return typeof meters === "number" ? meters / 1000 : null;
  } catch {
    return null;
  }
}

function parseRand(price: string): number | null {
  const cleaned = price.replace(/[^0-9.,]/g, "").replace(/\s/g, "");
  const normalized = cleaned.replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

export const submitQuoteRequest = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      firstName: z.string().trim().min(1).max(80),
      lastName: z.string().trim().min(1).max(80),
      email: z.string().trim().email().max(200),
      phone: z.string().trim().min(5).max(40),
      product: z.string().trim().min(1).max(200),
      quantity: z.number().int().min(1).max(50).default(1),
      storyType: z.enum(["single", "double"]).nullable(),
      flooring: z.string().trim().max(80).optional(),
      roofType: z.string().trim().max(80).optional(),
      plateType: z.enum(["steel", "glass", "granite"]).optional(),
      cornerInstall: z.boolean().default(false),
      installationRequired: z.boolean().default(true),
      address: z.string().trim().max(300).optional(),
      message: z.string().trim().max(2000).optional(),
      extrasForAccount: z.string().trim().max(2000).optional(),
      preferredDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      preferredTime: z.string().trim().regex(/^\d{2}:\d{2}$/).optional(),
      utmSource: z.string().trim().max(100).optional(),
      utmMedium: z.string().trim().max(100).optional(),
      utmCampaign: z.string().trim().max(200).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const matched = matchProduct(data.product);
    const unitPriceNum = matched ? parseRand(matched.price) : null;
    const productSubtotal = unitPriceNum !== null ? unitPriceNum * data.quantity : null;

    const distanceKm = data.address ? await computeDistanceKm(data.address) : null;

    // Installation pricing only applies within 300 km of Cape Town (Bellville origin).
    const installOutOfRange =
      data.installationRequired && distanceKm !== null && distanceKm > 300;
    const installEligible = data.installationRequired && !installOutOfRange;

    const flueKitIncluded = /flue\s*kit/i.test(matched?.name ?? "") || /flue\s*kit/i.test(data.product);
    const flueKitPrice = flueKitIncluded
      ? null
      : data.storyType === "double" ? 9650 : data.storyType === "single" ? 7650 : null;

    const flooringLower = (data.flooring ?? "").toLowerCase();
    const needsPlate = flooringLower.length > 0 && !/tile/.test(flooringLower);
    const plateType: "steel" | "glass" | "granite" = data.plateType === "granite" ? "granite" : data.plateType === "steel" ? "steel" : "glass";
    const corner = data.cornerInstall;
    const platePriceVal =
      plateType === "steel" ? 1500 : plateType === "granite" ? (corner ? 5500 : 4500) : (corner ? 3500 : 2500);
    const plate: { type: "steel" | "glass" | "granite"; price: number } | null = needsPlate
      ? { type: plateType, price: platePriceVal }
      : null;


    const transport = distanceKm !== null ? transportPriceForKm(distanceKm, data.installationRequired) : null;
    const travelFee = installEligible && distanceKm !== null && distanceKm <= 50 ? 250 : 0;

    const cornerInstallPrice = installEligible && data.cornerInstall
      ? 800 + (distanceKm !== null && distanceKm <= 50 ? 650 : 0)
      : null;

    // Installation estimate (within Cape Town) — base fee + core drilling for double-story flues.
    // Subject to site visit; mirrors the "Installation Estimate" page on the PDF.
    const INSTALL_BASE = 5500;
    const CORE_DRILL = 1500;
    const installationEstimate = installEligible
      ? INSTALL_BASE + (data.storyType === "double" ? CORE_DRILL : 0)
      : null;

    const totalPriceNum =
      productSubtotal !== null ||
      flueKitPrice !== null ||
      plate !== null ||
      cornerInstallPrice !== null ||
      transport !== null ||
      travelFee > 0 ||
      installationEstimate !== null
        ? (productSubtotal ?? 0) +
          (flueKitPrice ?? 0) +
          (plate?.price ?? 0) +
          (cornerInstallPrice ?? 0) +
          (transport?.price ?? 0) +
          travelFee +
          (installationEstimate ?? 0)
        : null;

    const { data: insertedQuote, error: insertError } = await supabaseAdmin
      .from("quote_requests")
      .insert({
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email,
        phone: data.phone,
        product_requested: data.product,
        quantity: data.quantity,
        story_type: data.storyType,
        flooring: data.flooring ?? null,
        corner_install: data.cornerInstall,
        address: data.address ?? null,
        message: data.message ?? null,
        matched_product: matched?.name ?? null,
        unit_price_zar: unitPriceNum,
        distance_km: distanceKm,
        transport_zar: transport?.price ?? null,
        total_zar: totalPriceNum,
        source: "fireplacequotes.co.za",
        utm_source: data.utmSource ?? null,
        utm_medium: data.utmMedium ?? null,
        utm_campaign: data.utmCampaign ?? null,
        status: "approved",
        decided_by: "system:auto-approve",
        decided_at: new Date().toISOString(),
      })
      .select(
        "id,first_name,last_name,email,phone,address,product_requested,matched_product,quantity,story_type,flooring,corner_install,distance_km,unit_price_zar,transport_zar,total_zar,pdf_path,source,created_at,utm_source,utm_medium,utm_campaign,status",
      )
      .single();

    if (insertError) {
      console.error("[quote-submit] insert failed", insertError);
    }

    // Belt-and-suspenders: if the row didn't land as 'approved' (e.g. stale
    // schema cache stripped the field, or a trigger reset it), force it now.
    if (insertedQuote && insertedQuote.status !== "approved") {
      const { error: updateError } = await supabaseAdmin
        .from("quote_requests")
        .update({
          status: "approved",
          decided_by: "system:auto-approve",
          decided_at: new Date().toISOString(),
        })
        .eq("id", insertedQuote.id);
      if (updateError) {
        console.error("[quote-submit] auto-approve update failed", updateError);
      } else {
        insertedQuote.status = "approved";
      }
    }

    if (insertedQuote) {
      try {
        const { pushQuoteToCRM } = await import("@/lib/crm-sync.server");
        await pushQuoteToCRM(insertedQuote);
      } catch (e) {
        console.warn("[quote-submit] CRM push failed", e);
      }

      try {
        const { sendLeadWebhookAlert } = await import("@/lib/lead-webhook.server");
        await sendLeadWebhookAlert({
          event: "new_lead",
          quoteNumber: `FPQ-${insertedQuote.id.split("-")[0].toUpperCase()}`,
          firstName: insertedQuote.first_name,
          lastName: insertedQuote.last_name,
          email: insertedQuote.email,
          phone: insertedQuote.phone,
          productRequested: insertedQuote.product_requested,
          matchedProduct: insertedQuote.matched_product,
          quantity: insertedQuote.quantity,
          totalZar: insertedQuote.total_zar,
          distanceKm: insertedQuote.distance_km,
          address: insertedQuote.address,
          source: insertedQuote.source,
          utmSource: insertedQuote.utm_source,
          utmMedium: insertedQuote.utm_medium,
          utmCampaign: insertedQuote.utm_campaign,
          submittedAt: insertedQuote.created_at,
        });
      } catch (e) {
        console.warn("[quote-submit] lead webhook alert failed", e);
      }
    }

    await appendToQuoteSheet([
      new Date().toISOString(),
      `${data.firstName} ${data.lastName}`.trim(),
      data.email,
      data.phone,
      data.product,
      matched?.name ?? "",
      data.quantity,
      data.storyType ?? "",
      data.flooring ?? "",
      data.cornerInstall ? "Yes" : "No",
      data.address ?? "",
      distanceKm !== null ? Math.round(distanceKm * 10) / 10 : "",
      transport?.zone ?? "",
      transport?.price ?? "",
      travelFee > 0 ? travelFee : "",
      unitPriceNum ?? "",
      flueKitPrice ?? "",
      plate?.price ?? "",
      cornerInstallPrice ?? "",
      totalPriceNum ?? "",
      data.message ?? "",
      data.utmSource ?? "",
      data.utmMedium ?? "",
      data.utmCampaign ?? "",
    ]);

    let bookingLink: string | null = null;
    if (data.preferredDate && data.preferredTime) {
      // Build a SAST (+02:00) datetime; Africa/Johannesburg has no DST.
      const startISO = `${data.preferredDate}T${data.preferredTime}:00+02:00`;
      const startMs = Date.parse(startISO);
      if (Number.isFinite(startMs)) {
        const endISO = new Date(startMs + 60 * 60 * 1000).toISOString();
        const lines = [
          `Customer: ${data.firstName} ${data.lastName}`,
          `Email: ${data.email}`,
          `Phone: ${data.phone}`,
          `Product: ${matched?.name ?? data.product} (x${data.quantity})`,
          data.storyType ? `Story: ${data.storyType}` : "",
          data.flooring ? `Flooring: ${data.flooring}` : "",
          data.cornerInstall ? "Corner installation: yes" : "",
          data.address ? `Address: ${data.address}` : "",
          distanceKm !== null ? `Distance: ${Math.round(distanceKm * 10) / 10} km` : "",
          totalPriceNum !== null ? `Estimated total: R${totalPriceNum}` : "",
          data.message ? `Notes: ${data.message}` : "",
        ].filter(Boolean);
        const booking = await createCalendarBooking({
          summary: `Site visit — ${data.firstName} ${data.lastName} (${matched?.name ?? data.product})`,
          description: lines.join("\n"),
          location: data.address,
          startISO,
          endISO,
          attendeeEmail: data.email,
          attendeeName: `${data.firstName} ${data.lastName}`.trim(),
        });
        bookingLink = booking?.htmlLink ?? null;
      }
    }

    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const fmtR = (n: number) => `R${n.toLocaleString("en-ZA")}`;
    const rows: [string, string][] = [
      ["Customer", `${data.firstName} ${data.lastName}`],
      ["Email", data.email],
      ["Phone", data.phone],
      ["Product requested", data.product],
      ["Matched product", matched?.name ?? "—"],
      ["Quantity", String(data.quantity)],
      ["Story type", data.storyType ?? "—"],
      ["Flooring", data.flooring ?? "—"],
      ["Roofing", data.roofType ?? "—"],
      ["Plate", plate ? `${plate.type} (${fmtR(plate.price)})` : "—"],
      ["Corner install", data.cornerInstall ? `Yes${cornerInstallPrice ? ` (${fmtR(cornerInstallPrice)})` : ""}` : "No"],
      ["Address", data.address ?? "—"],
      ["Distance", distanceKm !== null ? `${Math.round(distanceKm * 10) / 10} km` : "—"],
      [!data.installationRequired ? "Courier (estimate — confirm & edit before invoicing)" : "Transport", transport ? `${transport.zone} (${fmtR(transport.price)})` : "—"],
      ["Travel fee", travelFee > 0 ? fmtR(travelFee) : "—"],
      ["Unit price", unitPriceNum !== null ? fmtR(unitPriceNum) : "—"],
      ...(flueKitPrice !== null ? [["Flue kit", fmtR(flueKitPrice)] as [string, string]] : []),
      ["Installation estimate", installationEstimate !== null ? `${fmtR(installationEstimate)} (within Cape Town, subject to site visit)` : "—"],
      ["Estimated total", totalPriceNum !== null ? fmtR(totalPriceNum) : "—"],
      ...(installOutOfRange ? [["Installation", "Outside 300 km — supply only; installation quoted separately"] as [string, string]] : []),
      ["Preferred date/time", data.preferredDate ? `${data.preferredDate} ${data.preferredTime ?? ""}`.trim() : "—"],
      ["Booking link", bookingLink ?? "—"],
      ["Message", data.message ?? "—"],
    ];
    const html = `
      <div style="font-family:Arial,sans-serif;color:#111;max-width:640px">
        <h2 style="margin:0 0 12px">New quote request</h2>
        <p style="margin:0 0 16px;color:#555">Submitted ${new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })} (SAST)</p>
        <table style="border-collapse:collapse;width:100%">
          ${rows
            .map(
              ([k, v]) =>
                `<tr><td style="padding:6px 10px;border:1px solid #eee;background:#fafafa;width:180px;font-weight:600">${esc(k)}</td><td style="padding:6px 10px;border:1px solid #eee">${esc(String(v))}</td></tr>`,
            )
            .join("")}
        </table>
      </div>`;
    const customerName = `${data.firstName} ${data.lastName}`.trim();
    const productLabel = matched?.name ?? data.product;
    const submittedAtLabel = `${new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })} (SAST)`;

    // Send internal team notification email via SMTP.
    let teamSend: { ok: boolean; error?: string } = { ok: false, error: undefined };
    try {
      const { sendSmtpEmailDirect } = await import("@/lib/email/send-smtp.server");
      const subject = `Your Quote - ${customerName}`;
      const recipients = [QUOTE_TEAM_EMAIL, ...QUOTE_CC_EMAILS];
      let firstError: string | undefined;
      let anyOk = false;
      for (const recipient of recipients) {
        const r = await sendSmtpEmailDirect({
          to: recipient,
          subject,
          html,
          replyTo: data.email,
          templateName: "quote-team",
        });
        if (r.success) anyOk = true;
        else if (!firstError) firstError = r.error;
      }
      teamSend = { ok: anyOk, error: anyOk ? undefined : firstError };
    } catch (err) {
      console.error("Team notification send threw", err);
      teamSend = {
        ok: false,
        error: err instanceof Error ? err.message : "Unknown team notification error",
      };
    }
    // Quotes are auto-approved on submission — no manager approval email needed.
    // The client still needs to explicitly "Accept Quote" before an invoice is issued.



    const { signQuoteSession } = await import("@/lib/quote-session.server");

    return {
      session: signQuoteSession(data.email),
      match: true as const,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      productRequested: data.product,
      quantity: data.quantity,
      catalog: matched
        ? {
            name: matched.name,
            unitPrice: matched.price,
            url: matched.url,
            category: matched.category,
          }
        : null,
      storyType: data.storyType,
      storyText: data.storyType === "double" ? "Double story" : data.storyType === "single" ? "Single story" : "",
      flueKitPrice,
      flooringText: data.flooring ?? "",
      plate,
      cornerInstallPrice,
      cornerInstallText: data.cornerInstall ? "Corner installation" : "",
      destinationText: data.address ?? "",
      distanceKm: distanceKm !== null ? Math.round(distanceKm * 10) / 10 : null,
      transportZone: transport?.zone ?? null,
      transportPrice: transport?.price ?? null,
      travelFee: travelFee > 0 ? travelFee : null,
      installationEstimate,
      installOutOfRange,
      bookingLink,
      preferredDate: data.preferredDate ?? null,
      preferredTime: data.preferredTime ?? null,
      submittedAt: new Date().toISOString(),
      teamNotificationOk: teamSend.ok,
      teamNotificationError: teamSend.error ?? null,
    };
  });
