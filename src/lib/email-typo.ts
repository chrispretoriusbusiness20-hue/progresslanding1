// Lightweight email typo detection: suggests corrections for common domain
// and TLD misspellings before form submission. No network calls.

const COMMON_DOMAINS = [
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "yahoo.co.za",
  "hotmail.com",
  "hotmail.co.uk",
  "hotmail.co.za",
  "outlook.com",
  "live.com",
  "live.co.za",
  "icloud.com",
  "me.com",
  "mac.me",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "mweb.co.za",
  "webmail.co.za",
  "telkomsa.net",
  "vodamail.co.za",
  "iafrica.com",
  "absamail.co.za",
];

const COMMON_TLDS = ["com", "co.za", "co.uk", "net", "org", "io", "me", "us"];

// Damerau-Levenshtein distance (handles adjacent transpositions like "gmial").
function distance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const d: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[m][n];
}

function closest(value: string, candidates: string[], maxDistance: number): string | null {
  let best: string | null = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    if (c === value) return null; // already correct
    const d = distance(value, c);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return bestDist > 0 && bestDist <= maxDistance ? best : null;
}

export interface EmailTypoResult {
  /** Hard format problem (missing @, no dot, etc.). */
  invalid?: string;
  /** Suggested corrected email if a likely typo was detected. */
  suggestion?: string;
  /** Human-readable reason for the suggestion. */
  reason?: string;
}

export function checkEmail(rawInput: string): EmailTypoResult {
  const value = rawInput.trim().toLowerCase();
  if (!value) return {};

  // Basic shape
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return { invalid: "Please enter a valid email address (name@example.com)." };
  }

  const atIdx = value.lastIndexOf("@");
  const local = value.slice(0, atIdx);
  const domain = value.slice(atIdx + 1);

  // Disposable / obviously fake patterns
  if (/(test|asdf|qwerty|noemail|fake)@/.test(value) || /^[a-z]{1,2}@/.test(value)) {
    return {
      invalid:
        "This looks like a placeholder email. Please use a real address so we can send your quote.",
    };
  }

  // Check full-domain typo (handles "gmial.com", "gmai.com", "hotnail.com", etc.)
  const domainSuggestion = closest(domain, COMMON_DOMAINS, 2);
  if (domainSuggestion) {
    return {
      suggestion: `${local}@${domainSuggestion}`,
      reason: `Did you mean ${local}@${domainSuggestion}?`,
    };
  }

  // Check TLD-only typo (e.g. "gmail.co" → "gmail.com", "gmail.con")
  const parts = domain.split(".");
  if (parts.length >= 2) {
    const tld = parts.slice(1).join(".");
    const tldSuggestion = closest(tld, COMMON_TLDS, 1);
    if (tldSuggestion && tldSuggestion !== tld) {
      const fixed = `${parts[0]}.${tldSuggestion}`;
      return {
        suggestion: `${local}@${fixed}`,
        reason: `Did you mean ${local}@${fixed}?`,
      };
    }
  }

  return {};
}
