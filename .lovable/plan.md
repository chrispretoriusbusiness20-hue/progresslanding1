# Fix outgoing email failures (expired mail server certificate)

## What is happening

Every transactional email since 23 August has failed. The send log shows 100% failures
with the same reason: the mail server (xneelo) presents an **expired TLS certificate**,
so the connection is refused before the message is sent. Quote emails, approval emails,
invoice emails and follow-up reminders are all affected — nothing is reaching customers
or the sales inbox.

This is not an app bug: the app is doing the right thing by refusing to trust an expired
certificate. The mail host has to be fixed, or we route mail elsewhere.

## Options

1. **Renew the certificate on the mail host (recommended, no code change)**
   Ask xneelo support to renew/repair the certificate on the SMTP host currently
   configured. Once valid, sending resumes with no code change.

2. **Point SMTP at a host with a valid certificate**
   xneelo also serves mail on their shared hostname (e.g. `smtp.xneelo.co.za`) which
   normally carries a valid certificate. This is a settings change only: update the
   SMTP host (and port, if we move from 465 to 587 STARTTLS). No code change needed —
   I would update the stored settings and send a test email to confirm.

3. **Switch delivery to an email API (Resend) — code change**
   Replace the raw SMTP path with an HTTPS API send, keeping the same templates,
   subjects, CC list and send log. Removes certificate/TCP fragility entirely.
   Requires a sending domain to be verified and an API key.

## Not an option

Disabling certificate verification. That would silently accept a man-in-the-middle
on mail containing customer contact details and quote documents.

## What I need from you

Pick 1, 2 or 3. For option 2 I need the hostname/port your mail provider recommends;
for option 3 I need an API key and confirmation that `progressgrp.co.za` can be
verified as a sending domain.

## Also in this change (already done)

- Quote PDF no longer adds a corner-installation charge to the all-in Magma SPECIAL.
- Payment buttons open the payment page reliably, with same-tab fallback when the
  browser blocks the pop-up.
