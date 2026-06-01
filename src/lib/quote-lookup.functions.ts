import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import productsData from "@/data/products.json";

const SPREADSHEET_ID = "1LXuqaffpiqcL41fwqULVAanot7GpABpKGLX3r7cF8Hs";
const SHEET_NAME = "Form responses 4";
const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";

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
        storyType === "double" ? 9500 : storyType === "single" ? 6785 : null;

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
        submittedAt: (row[idx.timestamp] ?? "").trim(),
      };
    }
    return { match: false as const };
  });
