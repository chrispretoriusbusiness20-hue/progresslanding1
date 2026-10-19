/** Shared, browser-safe product presentation for catalogue and quote screens. */
export function parseRand(value: string | number | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (!value) return null;
  const cleaned = value.replace(/[^\d.,-]/g, "");
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned;
  const amount = Number.parseFloat(normalized);
  return Number.isFinite(amount) ? amount : null;
}

export function formatRand(value: string | number | null | undefined): string {
  const amount = parseRand(value);
  if (amount === null) return "Price on request";
  const [whole, cents] = amount.toFixed(2).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `R${grouped}${cents === "00" ? "" : `,${cents}`}`;
}

export function decodeProductName(name: string): string {
  const entities: Record<string, string> = {
    amp: "&",
    quot: '"',
    apos: "'",
    lt: "<",
    gt: ">",
    nbsp: " ",
    ndash: "–",
    mdash: "—",
    rsquo: "’",
    lsquo: "‘",
    rdquo: "”",
    ldquo: "“",
  };
  return name.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (!code.startsWith("#")) return entities[code.toLowerCase()] ?? entity;
    const point = code.toLowerCase().startsWith("#x")
      ? Number.parseInt(code.slice(2), 16)
      : Number.parseInt(code.slice(1), 10);
    return point >= 0 && point <= 0x10ffff ? String.fromCodePoint(point) : entity;
  });
}
