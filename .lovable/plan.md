# Email Infrastructure — Current State

> Last updated: 2026-06-18
> All sends now route through **Lovable's email queue**. Resend path removed.

## 1. Sender domain

- **Delegated subdomain:** `notify.progressgrp.co.za` (Lovable NS delegation)
- **Status:** ⏳ Pending — waiting for DNS propagation
- **Visible From:** `Progress Group <sales@progressgrp.co.za>`
- **Action required:** Add NS records `ns3.lovable.cloud` and `ns4.lovable.cloud` for `notify.progressgrp.co.za` at your registrar, then click **Verify Domain** in Cloud → Emails.

## 2. Send paths

All three send paths now enqueue to Lovable's queue (`/lovable/email/transactional/send`):

| Path | File | From address | Trigger |
|------|------|--------------|---------|
| Quote form PDF to customer | `src/lib/quote-submit.functions.ts` → `sendInternalEmail` | `Progress Group <sales@progressgrp.co.za>` | Customer submits quote request |
| Team notification | `src/lib/quote-submit.functions.ts` → `sendInternalEmail` | `Progress Group <sales@progressgrp.co.za>` | Customer submits quote request |
| Auth emails (magic link, signup, etc.) | `src/routes/lovable/email/auth/webhook.ts` | `Progress Group <sales@progressgrp.co.za>` | Supabase Auth events |

Constants (all aligned):
- `SENDER_DOMAIN` = `notify.progressgrp.co.za`
- `FROM_DOMAIN` = `progressgrp.co.za`
- `FROM_LOCAL_PART` = `sales`

## 3. Infrastructure

- ✅ `email_send_log`, `email_send_state`, `suppressed_emails`, `email_unsubscribe_tokens`
- ✅ `enqueue_email`, `read_email_batch`, `delete_email`, `move_to_dlq` RPCs
- ✅ `process-email-queue` cron (every 5s)
- ✅ Auth webhook (`/lovable/email/auth/webhook`)
- ✅ Transactional send route (`/lovable/email/transactional/send`)
- ✅ 6 auth email templates + 2 app templates (quote-customer, quote-team) with registry

## 4. What was removed

- Resend connector gateway calls (`sendQuoteNotificationEmail` via Resend)
- `email-test.functions.ts` (stale diagnostic tool referencing Resend)
- All `RESEND_API_KEY` usage from quote flow

## 5. Remaining to go live

1. DNS: add NS records for `notify.progressgrp.co.za`
2. Wait for status = **Verified** in Cloud → Emails
3. Emails will begin flowing automatically (queue processes every 5s)

No further code changes needed.
