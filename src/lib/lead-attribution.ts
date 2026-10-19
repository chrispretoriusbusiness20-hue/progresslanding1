export type LandingAttribution = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  fbclid?: string;
  gclid?: string;
};
const fields = {
  utmSource: "utm_source",
  utmMedium: "utm_medium",
  utmCampaign: "utm_campaign",
  fbclid: "fbclid",
  gclid: "gclid",
} as const;
export function mergeAttribution(saved: LandingAttribution, search: string): LandingAttribution {
  const params = new URLSearchParams(search);
  const result = { ...saved };
  for (const [field, query] of Object.entries(fields)) {
    const value = params.get(query);
    if (value)
      result[field as keyof LandingAttribution] = value.slice(
        0,
        field === "utmSource" || field === "utmMedium" ? 100 : 200,
      );
  }
  return result;
}
export function getLandingAttribution(): LandingAttribution {
  if (typeof window === "undefined") return {};
  let saved: LandingAttribution = {};
  try {
    saved = JSON.parse(sessionStorage.getItem("progress_attribution") ?? "{}");
  } catch {
    /* Storage unavailable. */
  }
  const attribution = mergeAttribution(saved, window.location.search);
  try {
    sessionStorage.setItem("progress_attribution", JSON.stringify(attribution));
  } catch {
    /* Storage unavailable. */
  }
  return attribution;
}
let fallbackSession: string | undefined;
export function getLeadSessionId(): string {
  try {
    const saved = sessionStorage.getItem("progress_lead_session");
    if (saved) return saved;
    const id = crypto.randomUUID();
    sessionStorage.setItem("progress_lead_session", id);
    return id;
  } catch {
    fallbackSession ??= crypto.randomUUID();
    return fallbackSession;
  }
}
