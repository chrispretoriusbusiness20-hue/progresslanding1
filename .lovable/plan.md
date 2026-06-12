# Resend Email Configuration — Verification Report

No code changes. Findings only.

## 1. RESEND_API_KEY secret

- **Present:** Yes. Managed by the Resend connector (visible in project secrets alongside `LOVABLE_API_KEY`).
- **Read correctly:** Yes. Both send paths read it the same way and through the same connector gateway:
  - `src/lib/quote-submit.functions.ts` → `sendQuoteNotificationEmail()` reads `process.env.LOVABLE_API_KEY` and `process.env.RESEND_API_KEY` inside the handler, sends `Authorization: Bearer ${LOVABLE_API_KEY}` + `X-Connection-Api-Key: ${RESEND_API_KEY}` to `https://connector-gateway.lovable.dev/resend/emails`.
  - `src/lib/email-test.functions.ts` → identical pattern.
- **Evidence the key is valid:** the gateway returned HTTP **403 with a Resend validation_error JSON body** (see §4). A missing/invalid API key would return 401 `unauthorized` from the gateway, not a Resend domain-validation error. So the credential chain (Lovable key → Resend connection key → Resend API) is working.

## 2. From / Reply-To addresses

From `src/lib/quote-submit.functions.ts`:

- `from`: `Progress Installations <sales@progressgrp.co.za>` (constants `QUOTE_FROM_NAME` + `QUOTE_FROM_EMAIL`)
- `reply_to`: `sales@progressgrp.co.za`
- `cc` (team notification + customer PDF): `louis@progressinstallations.co.za`, `christiaan@progressinstallations.co.za`

From `src/lib/email-test.functions.ts` (diagnostic tool): same `from` / `reply_to` (`sales@progressgrp.co.za`).

The sending domain is `progressgrp.co.za` in every path.

## 3. Recipient / test address

- **Customer quote PDF** (`emailQuotePdf`): `to` is the email the customer typed into the quote form (validated as an email, max 200 chars). CC'd to the two `progressinstallations.co.za` addresses.
- **Team notification** (`submitQuoteRequest` → `sendQuoteNotificationEmail`): `to: sales@progressgrp.co.za`, CC the two `progressinstallations.co.za` addresses.
- **Diagnostic test** (`sendTestEmail`): `to` is whatever address you enter on `/email-diagnostic`.

Recipient addresses are well-formed and chosen by the user/form — they are not the cause of the failure (Resend rejects before even looking at recipients).

## 4. Latest function logs

Worker logs in the last hour show exactly one email-related error, and it is the domain-verification 403:

```
[2026-06-12T08:29:58Z] [error] Resend send failed 403
{"statusCode":403,
 "message":"The progressgrp.co.za domain is not verified. Please, add and verify your domain on https://resend.com/domains",
 "name":"validation_error"}
```

No other errors observed:
- No `401 unauthorized` from the connector gateway → LOVABLE_API_KEY + RESEND_API_KEY are accepted.
- No `lovable_api_key_not_registered` / decryption errors.
- No network/timeout errors (`fetch failed`, `ECONNRESET`, etc.).
- No Zod validation errors on the send payload.
- The 401s in logs are unrelated — they're on `/lovable/email/auth/preview` / `/webhook` (Lovable Emails auth-template scaffolding probes), not the Resend quote path.

## Conclusion

The ONLY thing blocking delivery is that **`progressgrp.co.za` is not verified in the connected Resend account**. The API key is present, valid, and being read correctly; the from/reply-to/recipient addresses are well-formed; no other errors are appearing in logs.

Once `progressgrp.co.za` is added and verified in Resend (DKIM + SPF + Return-Path DNS at the registrar), both the team notification and the customer PDF send should succeed with no code changes.
