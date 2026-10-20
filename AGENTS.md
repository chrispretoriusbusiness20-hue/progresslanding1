# Project architecture

- Use `src/lib/product-display.ts` for browser-safe rand formatting and product-name decoding, keeping catalogue and quote presentation consistent.
- Use `src/lib/product-images.ts` for product image resolution and category fallbacks so every product renderer has a usable image.
- Define landing popular picks by exact names from `products.json` in `src/lib/popular-products.ts`; include those records in the quote dropdown so card selections remain selectable.
- Keep estimator, live quote and submitted quote calculations in `src/lib/quote-pricing.ts` and Bellville distance lookup in `quote-distance.server.ts` so amounts cannot diverge.
- Use the merged catalogue module for finder specs and comparisons; unknown specs remain unknown rather than inferred beyond names/categories.
- Capture session attribution through `lead-attribution.ts` and append validated actions to private `lead_events`; only existing server-verified staff access can list these records.
- Keep quote CRM handoffs on the existing signed webhook, carrying action/page/session/ad attribution; anonymous click events stay distinct from completed quotes.
- Mount comparison state once at the root and position its bar above the landing mobile CTA so selections survive navigation without overlapping controls.
- Render the quote form selection summary from its active pricing selections using the shared calculation, so displayed add-ons match the submitted quote rather than a separate shopping list.