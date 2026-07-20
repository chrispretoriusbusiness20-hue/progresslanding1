## Goal
Confirm Meta Pixel `2169427620464385` is firing on the live site (https://progressgrp.co.za) using headless Chromium to simulate what Meta Pixel Helper / Events Manager check.

## Steps
1. Launch Playwright against `https://progressgrp.co.za/` (and key routes: `/catalog`, `/contact`, `/consultation`).
2. On each page, capture:
   - Network requests to `connect.facebook.net/en_US/fbevents.js` (script load)
   - Network requests to `facebook.com/tr/` with `id=2169427620464385` and `ev=PageView` (the pixel beacon Events Manager reads)
   - `window.fbq` presence and `fbq.version`
   - Screenshot of each page loaded
3. Report per-page pass/fail table with the actual beacon URLs observed.
4. If any page fails, inspect `__root.tsx` head injection order and CSP/response headers for blockers, and propose a fix in a follow-up plan.

## Note
Meta Events Manager's "A pixel wasn't detected" wizard uses a cached crawler and often reports false negatives even when the pixel is live. The authoritative signal is the `facebook.com/tr` beacon in network traffic and the **Test Events** tab in Events Manager — that's what this verification checks.

## Deliverable
A short results table (URL → fbevents.js loaded? → /tr PageView beacon fired? → fbq present?) plus screenshots saved under `/tmp/browser/meta-pixel/`.