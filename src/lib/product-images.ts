import closedAsset from "@/assets/cat-closed.jpg.asset.json";
import gasAsset from "@/assets/cat-gas.jpg.asset.json";
import pelletAsset from "@/assets/cat-pellet.jpg.asset.json";
import biomassAsset from "@/assets/cat-biomass.jpg.asset.json";
import flueAsset from "@/assets/cat-flue.jpg.asset.json";

const ORIGIN = "https://www.progressgrp.co.za";

const CATEGORY_IMAGES: Record<string, string> = {
  "closed-combustion-fireplaces": closedAsset.url,
  "gas-fireplaces": gasAsset.url,
  "pellet-fireplaces": pelletAsset.url,
  biomass: biomassAsset.url,
  "flues-and-accessories": flueAsset.url,
};

function absolute(url: string): string {
  return url.startsWith("http") ? url : `${ORIGIN}${url}`;
}

/**
 * Get an absolute image URL suitable for use in email templates.
 * Falls back to the closed-combustion image when category is unknown.
 */
export function getProductImageUrl(opts: {
  category?: string | null;
  productName?: string | null;
}): string {
  const cat = (opts.category ?? "").toLowerCase();
  if (cat && CATEGORY_IMAGES[cat]) return absolute(CATEGORY_IMAGES[cat]);

  const name = (opts.productName ?? "").toLowerCase();
  if (/gas/.test(name)) return absolute(CATEGORY_IMAGES["gas-fireplaces"]);
  if (/pellet/.test(name)) return absolute(CATEGORY_IMAGES["pellet-fireplaces"]);
  if (/biomass/.test(name)) return absolute(CATEGORY_IMAGES.biomass);
  if (/flue|chimney|accessor/.test(name))
    return absolute(CATEGORY_IMAGES["flues-and-accessories"]);
  return absolute(CATEGORY_IMAGES["closed-combustion-fireplaces"]);
}
