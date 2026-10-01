/** Browser-side Meta Pixel helpers. Dataset / pixel ID lives here only. */
export const META_PIXEL_ID = "2169427620464385";
export const META_PIXEL_ID_2 = "2184254568792048";

type Fbq = (...args: unknown[]) => void;

function getFbq(): Fbq | null {
  if (typeof window === "undefined") return null;
  const fbq = (window as unknown as { fbq?: Fbq }).fbq;
  return typeof fbq === "function" ? fbq : null;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

const FBCLID_KEY = "progress_fbclid";

/** Capture fbclid from the landing URL so it survives navigation. */
export function captureFbclid(): void {
  if (typeof window === "undefined") return;
  const fbclid = new URLSearchParams(window.location.search).get("fbclid");
  if (!fbclid) return;
  try {
    localStorage.setItem(FBCLID_KEY, JSON.stringify({ fbclid, ts: Date.now() }));
  } catch {
    /* storage unavailable */
  }
  if (!readCookie("_fbc")) {
    const fbc = `fb.1.${Date.now()}.${fbclid}`;
    document.cookie = `_fbc=${encodeURIComponent(fbc)}; path=/; max-age=${90 * 86400}; SameSite=Lax`;
  }
}

export interface MetaAttribution {
  fbp: string | null;
  fbc: string | null;
  fbclid: string | null;
  eventSourceUrl: string;
}

export function getMetaAttribution(): MetaAttribution {
  let fbclid: string | null = null;
  try {
    const raw = localStorage.getItem(FBCLID_KEY);
    if (raw) fbclid = (JSON.parse(raw) as { fbclid?: string }).fbclid ?? null;
  } catch {
    /* ignore */
  }
  const fbc = readCookie("_fbc") ?? (fbclid ? `fb.1.${Date.now()}.${fbclid}` : null);
  return {
    fbp: readCookie("_fbp"),
    fbc,
    fbclid,
    eventSourceUrl: typeof window !== "undefined" ? window.location.href.split("#")[0] : "",
  };
}

export function newEventId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function trackPageView(): void {
  getFbq()?.("track", "PageView");
}

export function trackLead(eventId: string, params: Record<string, unknown> = {}): void {
  getFbq()?.("track", "Lead", params, { eventID: eventId });
}

export function trackContact(method: "whatsapp" | "phone"): void {
  getFbq()?.("track", "Contact", { content_name: method });
}
