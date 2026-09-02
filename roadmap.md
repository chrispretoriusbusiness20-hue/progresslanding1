# Roadmap

- [ ] Complete DNS verification for progressgrp.co.za in the email setup screen.
- [ ] Retry quote email after the rolling 100-emails-per-hour window resets.
- [ ] Confirm quote emails send from sales@progressgrp.co.za.
- [ ] After Stitch payment opens: record payment status on the record and email the client a confirmation (blocked: Stitch credentials return invalid_client; consultations are email-only with no stored record).
- [ ] Custom domain (progressgrp.co.za): create own Google Maps API key with referrer allowlist, then link it as a new Maps connection.
- [ ] Add STITCH_WEBHOOK_SECRET and register https://progresslanding1.lovable.app/api/public/stitch-webhook in the Stitch dashboard.
- [x] "Pay it off" CTA opens the installment options dialog and pays the first installment amount.
- [ ] Confirm a real Stitch payment flips a quote to paid (needs a live card/bank payment by the user).

- [x] Unify quote total with live cart total everywhere
- [x] Visible "Pay by EFT" button on quote panel
- [x] "Exit — pay & get your invoice later" option in payment modal
