import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

const InputSchema = z.object({
  input: z.string().min(1).max(200),
  sessionToken: z.string().min(1).max(128).optional(),
});

export const autocompleteAddress = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
    if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) {
      return { suggestions: [] as Array<{ placeId: string; text: string }> };
    }

    const res = await fetch(`${GATEWAY_URL}/places/v1/places:autocomplete`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: data.input,
        sessionToken: data.sessionToken,
        includedRegionCodes: ["za"],
        languageCode: "en",
      }),
    });

    if (!res.ok) {
      return { suggestions: [] as Array<{ placeId: string; text: string }> };
    }

    const json = (await res.json()) as {
      suggestions?: Array<{
        placePrediction?: {
          placeId?: string;
          text?: { text?: string };
        };
      }>;
    };

    const suggestions = (json.suggestions ?? [])
      .map((s) => ({
        placeId: s.placePrediction?.placeId ?? "",
        text: s.placePrediction?.text?.text ?? "",
      }))
      .filter((s) => s.placeId && s.text);

    return { suggestions };
  });

const ReverseSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const reverseGeocode = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ReverseSchema.parse(data))
  .handler(async ({ data }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
    if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) {
      return { address: null as string | null };
    }

    const res = await fetch(
      `${GATEWAY_URL}/maps/api/geocode/json?latlng=${data.lat},${data.lng}&language=en&region=za`,
      {
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY,
        },
      },
    );

    if (!res.ok) return { address: null as string | null };

    const json = (await res.json()) as {
      results?: Array<{ formatted_address?: string }>;
    };
    const address = json.results?.[0]?.formatted_address ?? null;
    return { address };
  });

