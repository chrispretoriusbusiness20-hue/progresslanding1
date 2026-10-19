import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getQuoteDistance = createServerFn({ method: "POST" }).inputValidator(z.object({ address: z.string().trim().min(3).max(300) })).handler(async ({ data }) => {
  const { computeDistanceKm } = await import("./quote-distance.server");
  const distanceKm = await computeDistanceKm(data.address);
  return { distanceKm };
});