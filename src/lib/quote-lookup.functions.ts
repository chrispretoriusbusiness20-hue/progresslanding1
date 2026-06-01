import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SPREADSHEET_ID = "1LXuqaffpiqcL41fwqULVAanot7GpABpKGLX3r7cF8Hs";
const SHEET_NAME = "Form responses 4";
const RANGE = `${SHEET_NAME}!A1:Q`;
const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";

function norm(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
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
    if (rows.length < 2) {
      return { match: false as const, range: RANGE };
    }

    const header = rows[0];
    const idx = {
      timestamp: header.findIndex((h) => /timestamp/i.test(h)),
      nameSurname: header.findIndex((h) => /name.*surname/i.test(h)),
      email: header.findIndex((h) => /e-?mail/i.test(h)),
      phone: header.findIndex((h) => /phone/i.test(h)),
    };

    const target = norm(`${data.firstName} ${data.lastName}`);
    // Walk newest-first (form responses append at the bottom).
    for (let i = rows.length - 1; i >= 1; i--) {
      const row = rows[i];
      const candidate = norm(row[idx.nameSurname] ?? "");
      if (candidate === target) {
        return {
          match: true as const,
          firstName: data.firstName,
          lastName: data.lastName,
          email: (row[idx.email] ?? "").trim(),
          phone: (row[idx.phone] ?? "").trim(),
          submittedAt: (row[idx.timestamp] ?? "").trim(),
        };
      }
    }
    return { match: false as const };
  });
