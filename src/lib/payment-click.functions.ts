import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const TEAM_EMAIL = "sales@progressgrp.co.za";
const TEAM_CC = ["louis@progressgrp.co.za", "chris@progressinstallations.co.za"];

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const schema = z.object({
  quoteNo: z.string().max(60).optional(),
  product: z.string().min(1).max(200),
  amount: z.string().max(40).optional(),
  customer: z.string().max(200).optional(),
  source: z.string().min(1).max(60),
});

// Notifies the sales team whenever a customer clicks a payment button.
export const notifyPaymentClick = createServerFn({ method: "POST" })
  .inputValidator((data) => schema.parse(data))
  .handler(async ({ data }) => {
    const when = `${new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })} (SAST)`;
    const rows: [string, string][] = [
      ["Quote number", data.quoteNo || "— (no quote yet)"],
      ["Product", data.product],
      ["Amount", data.amount || "—"],
      ["Customer", data.customer || "—"],
      ["Button", data.source],
      ["Clicked at", when],
    ];
    const html = `<div style="font-family:Arial,sans-serif;color:#111;max-width:600px">
      <h2 style="margin:0 0 12px">Customer clicked a payment button</h2>
      <table style="border-collapse:collapse;width:100%">${rows
        .map(
          ([k, v]) =>
            `<tr><td style="padding:6px 10px;border:1px solid #eee;background:#fafafa;width:160px;font-weight:600">${esc(k)}</td><td style="padding:6px 10px;border:1px solid #eee">${esc(v)}</td></tr>`,
        )
        .join("")}</table>
      <p style="color:#555;font-size:13px">They were sent to the Stitch payment page. This does not confirm payment.</p>
    </div>`;
    const { sendSmtpEmailDirect } = await import("@/lib/email/send-smtp.server");
    const r = await sendSmtpEmailDirect({
      to: TEAM_EMAIL,
      cc: TEAM_CC,
      subject: `Payment click: ${data.quoteNo || "no quote"} — ${data.product} — ${data.amount || "—"}`,
      html,
      templateName: "payment-click-team",
    });
    return { ok: r.success };
  });
