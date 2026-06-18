import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import productsData from "@/data/products.json";

const MAPS_GATEWAY = "https://connector-gateway.lovable.dev/google_maps";
const SHEETS_GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";
const CALENDAR_GATEWAY = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";
const QUOTE_SHEET_ID = "1AVvNPoavrAf0ptWt4dUXdA2zmGqNjA70ebPXn-gJgW8";
const QUOTE_TEAM_EMAIL = "sales@progressgrp.co.za";
const QUOTE_CC_EMAILS = [
  "louis@progressinstallations.co.za",
  "christiaan@progressinstallations.co.za",
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
    }),
  )
  .handler(async ({ data }) => {
    try {
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
    }),
  )
  .handler(async ({ data }) => {
    try {
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
      const { sendSmtpEmailDirect } = await import("@/lib/email/send-smtp.server");
      const clientName = data.clientName ?? "there";
      const productName = data.productName ?? "your selection";
      const quoteNo = data.quoteNo ?? "";
      const expiresInDays = 10;
      const esc = (s: string) =>
        s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const html = `
        <div style="font-family:Arial,sans-serif;color:#111;max-width:600px">
          <h2 style="margin:0 0 12px">${quoteNo ? esc(quoteNo) : "Your quote"}</h2>
          <p>Hi ${esc(clientName)},</p>
          <p>Thanks for your interest in <strong>${esc(productName)}</strong>. Herewith your quote as requested.</p>
          <p style="margin:24px 0">
            <a href="${signed.signedUrl}" style="display:inline-block;background:#dd7400;color:#fff;padding:12px 22px;border-radius:4px;text-decoration:none;font-weight:600">Download your quote (PDF)</a>
          </p>
          <p style="color:#555;font-size:13px">This link is valid for ${expiresInDays} days. If the button doesn't work, copy and paste this URL into your browser:</p>
          <p style="color:#0a58ca;font-size:12px;word-break:break-all">${esc(signed.signedUrl)}</p>
          <p style="color:#555;font-size:13px">Questions? Reply to this email or call us — we're happy to help.</p>
          <p style="margin-top:24px">— Progress Installations</p>
        </div>`;
      const send = await sendSmtpEmailDirect({
        to: data.to,
        cc: QUOTE_CC_EMAILS,
        subject: quoteNo ? quoteNo : `Your quote — Progress Group`,
        html,
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

function transportPriceForKm(_km: number): { zone: string; price: number } {
  return { zone: "Standard delivery", price: 800 };
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
      plateType: z.enum(["glass", "granite", "metal"]).optional(),
      cornerInstall: z.boolean().default(false),
      installationRequired: z.boolean().default(true),
      address: z.string().trim().max(300).optional(),
      message: z.string().trim().max(2000).optional(),
      extrasForAccount: z.string().trim().max(2000).optional(),
      preferredDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      preferredTime: z.string().trim().regex(/^\d{2}:\d{2}$/).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const matched = matchProduct(data.product);
    const unitPriceNum = matched ? parseRand(matched.price) : null;
    const productSubtotal = unitPriceNum !== null ? unitPriceNum * data.quantity : null;

    const flueKitPrice =
      data.storyType === "double" ? 9650 : data.storyType === "single" ? 7650 : null;

    const flooringLower = (data.flooring ?? "").toLowerCase();
    const needsPlate = flooringLower.length > 0 && !/tile/.test(flooringLower);
    const plateType: "glass" | "granite" | "metal" = data.plateType === "granite" ? "granite" : data.plateType === "metal" ? "metal" : "glass";
    const plate: { type: "glass" | "granite" | "metal"; price: number } | null = needsPlate
      ? { type: plateType, price: plateType === "granite" ? 2895 : plateType === "metal" ? 1490 : 2495 }
      : null;

    const distanceKm = data.address ? await computeDistanceKm(data.address) : null;
    const transport = distanceKm !== null ? transportPriceForKm(distanceKm) : null;
    const travelFee = data.installationRequired && distanceKm !== null && distanceKm <= 50 ? 250 : 0;

    const cornerInstallPrice = data.cornerInstall
      ? 800 + (distanceKm !== null && distanceKm <= 50 ? 650 : 0)
      : null;

    const totalPriceNum =
      productSubtotal !== null ||
      flueKitPrice !== null ||
      plate !== null ||
      cornerInstallPrice !== null ||
      transport !== null ||
      travelFee > 0
        ? (productSubtotal ?? 0) +
          (flueKitPrice ?? 0) +
          (plate?.price ?? 0) +
          (cornerInstallPrice ?? 0) +
          (transport?.price ?? 0) +
          travelFee
        : null;

    await supabaseAdmin.from("quote_requests").insert({
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
    });

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
      ["Plate", plate ? `${plate.type} (${fmtR(plate.price)})` : "—"],
      ["Corner install", data.cornerInstall ? `Yes${cornerInstallPrice ? ` (${fmtR(cornerInstallPrice)})` : ""}` : "No"],
      ["Address", data.address ?? "—"],
      ["Distance", distanceKm !== null ? `${Math.round(distanceKm * 10) / 10} km` : "—"],
      ["Transport", transport ? `${transport.zone} (${fmtR(transport.price)})` : "—"],
      ["Travel fee", travelFee > 0 ? fmtR(travelFee) : "—"],
      ["Unit price", unitPriceNum !== null ? fmtR(unitPriceNum) : "—"],
      ["Flue kit", flueKitPrice !== null ? fmtR(flueKitPrice) : "—"],
      ["Estimated total", totalPriceNum !== null ? fmtR(totalPriceNum) : "—"],
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
      const subject = `New quote request — ${customerName} (${productLabel})`;
      const recipients = [QUOTE_TEAM_EMAIL, ...QUOTE_CC_EMAILS];
      let firstError: string | undefined;
      let anyOk = false;
      for (const recipient of recipients) {
        const r = await sendSmtpEmailDirect({ to: recipient, subject, html, replyTo: data.email });
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











    return {
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
      bookingLink,
      preferredDate: data.preferredDate ?? null,
      preferredTime: data.preferredTime ?? null,
      submittedAt: new Date().toISOString(),
      teamNotificationOk: teamSend.ok,
      teamNotificationError: teamSend.error ?? null,
    };
  });
