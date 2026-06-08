import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import productsData from "@/data/products.json";

const SPREADSHEET_ID = "1LXuqaffpiqcL41fwqULVAanot7GpABpKGLX3r7cF8Hs";
const SHEET_NAME = "Form responses 4";
const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";
const MAPS_GATEWAY = "https://connector-gateway.lovable.dev/google_maps";
const ORIGIN_ADDRESS = "Progress Lighting & Fires, 189 Durban Rd, Bellville, Cape Town, 7530, South Africa";

// Transport zones (km thresholds → price ZAR incl VAT).
function transportPriceForKm(km: number, destination: string): { zone: string; price: number } {
  const destLower = destination.toLowerCase();
  if (/cape town|capetown/.test(destLower)) return { zone: "Cape Town", price: 650 };
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
  // If user typed a bare number, treat it as km directly.
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

type Product = { name: string; price: string; url: string; category: string };
const PRODUCTS = productsData as Product[];

function norm(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

// Tokenise for fuzzy product matching (alphanum tokens >= 2 chars).
function tokens(s: string): string[] {
  return norm(s)
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

function matchProduct(query: string): Product | null {
  if (!query.trim()) return null;
  const qTokens = tokens(query);
  if (qTokens.length === 0) return null;
  const qSet = new Set(qTokens);

  let best: { product: Product; score: number } | null = null;
  for (const p of PRODUCTS) {
    const pTokens = tokens(p.name);
    let overlap = 0;
    for (const t of pTokens) if (qSet.has(t)) overlap++;
    // Heuristic: require at least 2 overlapping tokens, prefer higher coverage.
    const score = overlap + overlap / Math.max(pTokens.length, 1);
    if (overlap >= 2 && (!best || score > best.score)) {
      best = { product: p, score };
    }
  }
  return best?.product ?? null;
}

export const lookupQuoteSubmission = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      firstName: z.string().trim().min(1).max(80),
      lastName: z.string().trim().min(1).max(80),
    }),
  )
  .handler(async ({ data }) => {
    const lovableKey = process.env.LOVABLE_API_KEY;
    const sheetsKey = process.env.GOOGLE_SHEETS_API_KEY;
    if (!lovableKey) throw new Error("Missing LOVABLE_API_KEY");
    if (!sheetsKey) throw new Error("Missing GOOGLE_SHEETS_API_KEY");

    const url = `${GATEWAY}/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(
      SHEET_NAME,
    )}!A1:Q`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": sheetsKey,
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Sheets gateway ${res.status}: ${body.slice(0, 200)}`);
    }
    const json = (await res.json()) as { values?: string[][] };
    const rows = json.values ?? [];
    if (rows.length < 2) return { match: false as const };

    const header = rows[0];
    const idx = {
      timestamp: header.findIndex((h) => /timestamp/i.test(h)),
      nameSurname: header.findIndex((h) => /name.*surname/i.test(h)),
      email: header.findIndex((h) => /e-?mail/i.test(h)),
      phone: header.findIndex((h) => /phone/i.test(h)),
      product: header.findIndex((h) => /product.*interest|which product/i.test(h)),
      quantity: header.findIndex((h) => /product\s*quantity/i.test(h)),
      story: header.findIndex((h) => /single or double story|story/i.test(h)),
      flooring: header.findIndex((h) => /flooring/i.test(h)),
      cornerInstall: header.findIndex((h) => /corner|installation position|install.*position/i.test(h)),
      distance: header.findIndex((h) => /distance.*to.*you|distance|address|location|where/i.test(h)),
    };

    const target = norm(`${data.firstName} ${data.lastName}`);
    for (let i = rows.length - 1; i >= 1; i--) {
      const row = rows[i];
      if (norm(row[idx.nameSurname] ?? "") !== target) continue;

      const productText = (row[idx.product] ?? "").trim();
      const qtyText = (row[idx.quantity] ?? "").trim();
      const qty = Number.parseInt(qtyText, 10);
      const matched = matchProduct(productText);
      const storyText = idx.story >= 0 ? (row[idx.story] ?? "").trim() : "";
      const storyLower = storyText.toLowerCase();
      const storyType: "single" | "double" | null = /double/.test(storyLower)
        ? "double"
        : /single/.test(storyLower)
          ? "single"
          : null;
      const flueKitPrice =
        storyType === "double" ? 9650 : storyType === "single" ? 7650 : null;

      const flooringText = idx.flooring >= 0 ? (row[idx.flooring] ?? "").trim() : "";
      const flooringLower = flooringText.toLowerCase();
      const needsPlate = flooringLower.length > 0 && !/tile/.test(flooringLower);
      const plate: { type: "glass"; price: number } | null = needsPlate
        ? { type: "glass", price: 2495 }
        : null;

      const cornerInstallText = idx.cornerInstall >= 0 ? (row[idx.cornerInstall] ?? "").trim() : "";
      const cornerInstallLower = cornerInstallText.toLowerCase();
      const isCornerInstall = /corner/.test(cornerInstallLower);

      const destinationText = idx.distance >= 0 ? (row[idx.distance] ?? "").trim() : "";
      const distanceKm = destinationText ? await computeDistanceKm(destinationText) : null;
      const transport = distanceKm !== null ? transportPriceForKm(distanceKm, destinationText) : null;

      const cornerInstallPrice = isCornerInstall
        ? 800 + (distanceKm !== null && distanceKm <= 50 ? 650 : 0)
        : null;

      return {
        match: true as const,
        firstName: data.firstName,
        lastName: data.lastName,
        email: (row[idx.email] ?? "").trim(),
        phone: (row[idx.phone] ?? "").trim(),
        productRequested: productText,
        quantity: Number.isFinite(qty) && qty > 0 ? qty : 1,
        catalog: matched
          ? {
              name: matched.name,
              unitPrice: matched.price,
              url: matched.url,
              category: matched.category,
            }
          : null,
        storyType,
        storyText,
        flueKitPrice,
        flooringText,
        plate,
        cornerInstallPrice,
        cornerInstallText,
        destinationText,
        distanceKm: distanceKm !== null ? Math.round(distanceKm * 10) / 10 : null,
        transportZone: transport?.zone ?? null,
        transportPrice: transport?.price ?? null,
        submittedAt: (row[idx.timestamp] ?? "").trim(),
      };
    }
    return { match: false as const };
  });
