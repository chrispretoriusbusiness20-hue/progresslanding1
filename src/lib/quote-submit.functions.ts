import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import productsData from "@/data/products.json";

const MAPS_GATEWAY = "https://connector-gateway.lovable.dev/google_maps";
const SHEETS_GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";
const CALENDAR_GATEWAY = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";
const QUOTE_SHEET_ID = "1AVvNPoavrAf0ptWt4dUXdA2zmGqNjA70ebPXn-gJgW8";
const ORIGIN_ADDRESS =
  "Progress Lighting & Fires, 189 Durban Rd, Bellville, Cape Town, 7530, South Africa";

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

function transportPriceForKm(km: number): { zone: string; price: number } {
  if (km <= 25) return { zone: "0–25 km", price: 0 };
  if (km <= 50) return { zone: "25–50 km", price: 450 };
  if (km <= 100) return { zone: "50–100 km", price: 900 };
  if (km <= 200) return { zone: "100–200 km", price: 1500 };
  return { zone: "200 km+", price: 1800 };
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
      cornerInstall: z.boolean().default(false),
      address: z.string().trim().max(300).optional(),
      message: z.string().trim().max(2000).optional(),
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
      data.storyType === "double" ? 9500 : data.storyType === "single" ? 6785 : null;

    const flooringLower = (data.flooring ?? "").toLowerCase();
    const needsPlate = /laminat|carpet/.test(flooringLower);
    const plate: { type: "glass"; price: number } | null = needsPlate
      ? { type: "glass", price: 2450 }
      : null;

    const cornerInstallPrice = data.cornerInstall ? 800 : null;

    const distanceKm = data.address ? await computeDistanceKm(data.address) : null;
    const transport = distanceKm !== null ? transportPriceForKm(distanceKm) : null;

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
      submittedAt: new Date().toISOString(),
    };
  });
