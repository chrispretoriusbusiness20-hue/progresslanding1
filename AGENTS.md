# Project architecture

- Use `src/lib/product-display.ts` for browser-safe rand formatting and product-name decoding, keeping catalogue and quote presentation consistent.
- Generate instant catalogue PDFs client-side from approved product records as product-only quotations; extract included VAT rather than adding VAT, and leave unknown prices/delivery unconfirmed without creating an order or invoice.
- Use `src/lib/product-images.ts` for product image resolution and category fallbacks so every product renderer has a usable image.
- Define landing popular picks by exact names from `products.json` in `src/lib/popular-products.ts`; include those records in the quote dropdown so card selections remain selectable.
- Keep estimator, live quote and submitted quote calculations in `src/lib/quote-pricing.ts` and Bellville distance lookup in `quote-distance.server.ts` so amounts cannot diverge.
- Use the merged catalogue module for finder specs and comparisons; unknown specs remain unknown rather than inferred beyond names/categories.
- Share the approved `TOP_PRODUCTS` list (popular picks plus explicitly imported products) across catalogue, enquiries and quote pickers; preserve nullable prices so new cards cannot lose pricing or become delivery-only payments.
- Resolve flue-kit eligibility from catalogue fireplace categories, excluding bundled kits, braais and vent-free models; only use explicit fireplace names for unknown records so accessories and unrelated goods never gain a kit charge.
- Capture session attribution through `lead-attribution.ts` and append validated actions to private `lead_events`; only existing server-verified staff access can list these records.
- Keep quote CRM handoffs on the existing signed webhook, carrying action/page/session/ad attribution; anonymous click events stay distinct from completed quotes.
- Mount comparison state once at the root and position its bar above the landing mobile CTA so selections survive navigation without overlapping controls.
- Render the quote form selection summary from its active pricing selections using the shared calculation, so displayed add-ons match the submitted quote rather than a separate shopping list.
- Use the shared product enquiry form on cards and the inline quick enquiry; validate its schema on both client and server, persist the WhatsApp action including optional town before navigating, and never count it as a completed quote.
- Keep enquiry request eligibility and message labels in `enquiry-options.ts`; validate selected requests against the active product category and log them without altering quote pricing.
- Route every product-tile quote CTA through one shared component using the root product-selection hand-off only; leave PDF generation in the successful form-submission flow to avoid duplicate quotes.
- Keep controls labelled WhatsApp on `wa.me` links and only genuine phone controls on `tel:` links, so a WhatsApp contact never places a call.