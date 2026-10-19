# Project architecture

- Use `src/lib/product-display.ts` for browser-safe rand formatting and product-name decoding, keeping catalogue and quote presentation consistent.
- Use `src/lib/product-images.ts` for product image resolution and category fallbacks so every product renderer has a usable image.
- Define landing popular picks by exact names from `products.json` in `src/lib/popular-products.ts`; include those records in the quote dropdown so card selections remain selectable.