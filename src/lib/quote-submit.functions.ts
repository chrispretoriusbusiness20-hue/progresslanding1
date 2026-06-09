import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import productsData from "@/data/products.json";

const MAPS_GATEWAY = "https://connector-gateway.lovable.dev/google_maps";
const SHEETS_GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";
const CALENDAR_GATEWAY = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";
const GMAIL_GATEWAY = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";
const QUOTE_SHEET_ID = "1AVvNPoavrAf0ptWt4dUXdA2zmGqNjA70ebPXn-gJgW8";
const QUOTE_FROM_EMAIL = "sales@progressgroup.co.za";
const QUOTE_CC_EMAILS = [
  "louis@progressinstallations.co.za",
  "christiaan@progressinstallations.co.za",
];
const ORIGIN_ADDRESS =
  "Progress Lighting & Fires, 189 Durban Rd, Bellville, Cape Town, 7530, South Africa";

function encodeRawEmailWithAttachment(args: {
  to: string;
  cc?: string;
  from?: string;
  subject: string;
  htmlBody: string;
  attachment?: { filename: string; base64: string; mimeType: string };
}): string {
  const boundary = `bnd_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  const headers: string[] = [
    `To: ${args.to}`,
    ...(args.cc ? [`Cc: ${args.cc}`] : []),
    `Subject: ${args.subject}`,
    "MIME-Version: 1.0",
  ];
  let body: string;
  if (args.attachment) {
    headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    // Chunk the base64 into 76-char lines per RFC.
    const chunked = args.attachment.base64.replace(/(.{76})/g, "$1\r\n");
    body =
      "\r\n" +
      `--${boundary}\r\n` +
      'Content-Type: text/html; charset="UTF-8"\r\n' +
      "Content-Transfer-Encoding: 7bit\r\n\r\n" +
      args.htmlBody +
      `\r\n--${boundary}\r\n` +
      `Content-Type: ${args.attachment.mimeType}; name="${args.attachment.filename}"\r\n` +
      `Content-Disposition: attachment; filename="${args.attachment.filename}"\r\n` +
      "Content-Transfer-Encoding: base64\r\n\r\n" +
      chunked +
      `\r\n--${boundary}--`;
  } else {
    headers.push('Content-Type: text/html; charset="UTF-8"');
    body = "\r\n" + args.htmlBody;
  }
  const message = headers.join("\r\n") + body;
  const b64 =
    typeof Buffer !== "undefined"
      ? Buffer.from(message, "utf-8").toString("base64")
      : btoa(unescape(encodeURIComponent(message)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sendQuoteNotificationEmail(args: {
  subject: string;
  html: string;
  cc?: string;
  attachment?: { filename: string; base64: string; mimeType: string };
}): Promise<void> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const gmailKey = process.env.GOOGLE_MAIL_API_KEY;
  if (!lovableKey || !gmailKey) return;
  try {
    const raw = encodeRawEmailWithAttachment({
      to: QUOTE_NOTIFY_EMAIL,
      cc: args.cc,
      subject: args.subject,
      htmlBody: args.html,
      attachment: args.attachment,
    });
    const res = await fetch(`${GMAIL_GATEWAY}/users/me/messages/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": gmailKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    });
    if (!res.ok) {
      console.error("Gmail send failed", res.status, await res.text());
    }
  } catch (err) {
    console.error("Gmail send error", err);
  }
}

export const emailQuotePdf = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      subject: z.string().trim().min(1).max(300),
      html: z.string().min(1).max(200_000),
      cc: z.string().trim().email().max(200).optional(),
      filename: z.string().trim().min(1).max(200),
      pdfBase64: z.string().min(1).max(15_000_000),
    }),
  )
  .handler(async ({ data }) => {
    await sendQuoteNotificationEmail({
      subject: data.subject,
      html: data.html,
      cc: data.cc,
      attachment: {
        filename: data.filename,
        base64: data.pdfBase64,
        mimeType: "application/pdf",
      },
    });
    return { ok: true as const };
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

    const cornerInstallPrice = data.cornerInstall
      ? 800 + (distanceKm !== null && distanceKm <= 50 ? 650 : 0)
      : null;

    const totalPriceNum =
      productSubtotal !== null ||
      flueKitPrice !== null ||
      plate !== null ||
      cornerInstallPrice !== null ||
      transport !== null
        ? (productSubtotal ?? 0) +
          (flueKitPrice ?? 0) +
          (plate?.price ?? 0) +
          (cornerInstallPrice ?? 0) +
          (transport?.price ?? 0)
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
    const notificationSubject = `New quote — ${data.firstName} ${data.lastName} (${matched?.name ?? data.product})`;









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
      bookingLink,
      preferredDate: data.preferredDate ?? null,
      preferredTime: data.preferredTime ?? null,
      submittedAt: new Date().toISOString(),
      notificationSubject,
      notificationHtml: html,
    };
  });
