const MAPS_GATEWAY = "https://connector-gateway.lovable.dev/google_maps";
const ORIGIN_ADDRESS = "189 Durban Road, Bellville, Cape Town, 7530, South Africa";
export async function computeDistanceKm(destination: string): Promise<number | null> {
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

