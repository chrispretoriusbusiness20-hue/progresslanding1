import closedAsset from "@/assets/cat-closed.jpg.asset.json";
import gasAsset from "@/assets/cat-gas.jpg.asset.json";
import pelletAsset from "@/assets/cat-pellet.jpg.asset.json";
import biomassAsset from "@/assets/cat-biomass.jpg.asset.json";
import flueAsset from "@/assets/cat-flue.jpg.asset.json";
import braai1200 from "@/assets/product/1200-de-lux-braai-mild-steel.jpg.asset.json";
import bomaImage from "@/assets/product/boma1100.webp.asset.json";
import combo1500 from "@/assets/product/1500-combo-braai.jpg.asset.json";
import cuboAir900 from "@/assets/product/cubo-air-900.jpg.asset.json";
import cuboInsert700 from "@/assets/product/cubo-700-insert.jpg.asset.json";
import magma003 from "@/assets/product/magma-003.jpg.asset.json";
import magmaVented from "@/assets/product/magma-vented-gas.jpg.asset.json";
import nestorStanford9 from "@/assets/product/nestor-martin-stanford-9.jpg.asset.json";
import panorama1000 from "@/assets/product/panorama-1000.jpg.asset.json";
import patio800 from "@/assets/product/800-patio-braai.jpg.asset.json";
import pebble900 from "@/assets/product/pebble-drop-in-900.jpg.asset.json";
import stainless1200 from "@/assets/product/1200-de-lux-430-stainless.jpg.asset.json";
import verto900 from "@/assets/product/verto-900.jpg.asset.json";

const ORIGIN = "https://www.progressgrp.co.za";

const CATEGORY_IMAGES: Record<string, string> = {
  braais: "/__l5e/assets-v1/3546c3ee-909c-4c92-aafc-e9c0b629dc95/1200-de-lux-braai.jpg",
  "closed-combustion-fireplaces": closedAsset.url,
  "gas-fireplaces": gasAsset.url,
  "pellet-fireplaces": pelletAsset.url,
  biomass: biomassAsset.url,
  "flues-and-accessories": flueAsset.url,
};

function absolute(url: string): string {
  return url.startsWith("http") ? url : `${ORIGIN}${url}`;
}

// Product-specific photos, matching the tiles on progressgroup.co.za.
// Checked by product name first so the right photo shows even when the
// stored image link is dead or missing.
const PRODUCT_IMAGES: [RegExp, string][] = [
  [/1200[^\n]{0,24}430[^\n]{0,12}stainless|1200x430/i, stainless1200.url],
  [/1200[^\n]{0,20}(?:steel|de lux)[^\n]{0,10}braai/i, braai1200.url],
  [/800[^\n]{0,12}patio/i, patio800.url],
  [/1500[^\n]{0,16}(?:combo|combination)/i, combo1500.url],
  [/magma[^\n]{0,4}003/i, magma003.url],
  [/nestor martin stanford/i, nestorStanford9.url],
  [/drop in vent free|pebble/i, pebble900.url],
  [/panorama/i, panorama1000.url],
  [/cubo air[^\n]{0,6}900/i, cuboAir900.url],
  [/cubo 700 insert/i, cuboInsert700.url],
  [/magma vented/i, magmaVented.url],
  [/verto/i, verto900.url],
  [/\bboma\b/i, bomaImage.url],
];

// Main-site image URLs that return 404, paired with the hosted copy to use instead.
const DEAD_IMAGES: [RegExp, string][] = [
  [/1200-De-Lux-Braai-300x300\.jpg/, braai1200.url],
  [/800mm-Single-Wall-Patio-Braai-300x300\.jpg/, patio800.url],
  [/1200-De-Lux-430-Stainless-Steel-300x300\.jpg/, stainless1200.url],
  [/1500-Combination-Braai\.1-300x300\.jpg/, combo1500.url],
  [/Magma-003-300x300\.jpg/, magma003.url],
  [/STANFORD9-CAM01-300x300\.jpg/, nestorStanford9.url],
  [/PEBBLE-GAS-GRATE-300x300\.png/, pebble900.url],
  [/e6f0c405-e286-11e8-a1f6-00155d0b6110-1-300x300\.jpg/, panorama1000.url],
  [/CUBO-90-Freestanding-300x300\.jpg/, cuboAir900.url],
  [/built-in-Gas-vent-free-fireplace-1200mm-300x300\.jpg/, verto900.url],
  [/4729e057-3347-4696-acc8-72082b24501b-300x300\.jpg/, pelletAsset.url],
];

/**
 * Get an absolute image URL suitable for use in email templates.
 * Falls back to the closed-combustion image when category is unknown.
 */
export function getProductImageUrl(opts: {
  image?: string | null;
  category?: string | null;
  productName?: string | null;
}): string {
  const name = opts.productName ?? "";
  // Known products always show their own photo from the main site.
  const productMatch = PRODUCT_IMAGES.find(([pattern]) => pattern.test(name));
  if (productMatch) return absolute(productMatch[1]);

  // Old main-site images that 404; fall back to the matching hosted copy.
  if (opts.image) {
    const dead = DEAD_IMAGES.find(([pattern]) => pattern.test(opts.image!));
    if (dead) return absolute(dead[1]);
    return absolute(opts.image);
  }
  const cat = (opts.category ?? "").toLowerCase();
  if (cat && CATEGORY_IMAGES[cat]) return absolute(CATEGORY_IMAGES[cat]);

  const lower = name.toLowerCase();
  if (/braai/.test(lower)) return absolute(CATEGORY_IMAGES.braais);
  if (/gas/.test(lower)) return absolute(CATEGORY_IMAGES["gas-fireplaces"]);
  if (/pellet/.test(lower)) return absolute(CATEGORY_IMAGES["pellet-fireplaces"]);
  if (/biomass/.test(lower)) return absolute(CATEGORY_IMAGES.biomass);
  if (/flue|chimney|accessor/.test(lower)) return absolute(CATEGORY_IMAGES["flues-and-accessories"]);
  return absolute(CATEGORY_IMAGES["closed-combustion-fireplaces"]);
}
