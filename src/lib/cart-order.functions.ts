import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ORDER_TEAM_EMAIL = "sales@progressgrp.co.za";
const ORDER_CC_EMAILS = [
  "louis@progressgrp.co.za",
  "chris@progressinstallations.co.za",
];

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const fmtR = (n: number) =>
  `R${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const cartOrderSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  address: z.string().min(1),
  installation: z.boolean(),
  notes: z.string().max(1500).optional(),
  quoteNo: z.string().min(1),
  delivery: z.number().min(0),
  items: z
    .array(
      z.object({
        name: z.string().min(1),
        quantity: z.number().int().min(1),
        unitPrice: z.number().min(0).nullable(),
      }),
    )
    .min(1),
});

export const sendCartOrderEmail = createServerFn({ method: "POST" })
  .inputValidator((data) => cartOrderSchema.parse(data))
  .handler(async ({ data }) => {
    const customerName = `${data.firstName} ${data.lastName}`.trim();
    const subtotal = data.items.reduce(
      (sum, item) => sum + (item.unitPrice ?? 0) * item.quantity,
      0,
    );
    const total = subtotal + data.delivery;
    const submittedAt = `${new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })} (SAST)`;

    const itemRows = data.items
      .map(
        (item) => `
          <tr>
            <td style="padding:6px 10px;border:1px solid #eee">${esc(item.name)}</td>
            <td style="padding:6px 10px;border:1px solid #eee;text-align:center">${item.quantity}</td>
            <td style="padding:6px 10px;border:1px solid #eee;text-align:right">${item.unitPrice !== null ? esc(fmtR(item.unitPrice)) : "Price on request"}</td>
            <td style="padding:6px 10px;border:1px solid #eee;text-align:right">${item.unitPrice !== null ? esc(fmtR(item.unitPrice * item.quantity)) : "—"}</td>
          </tr>`,
      )
      .join("");

    const detailRows: [string, string][] = [
      ["Customer", customerName],
      ["Email", data.email],
      ["Phone", data.phone],
      ["Delivery address", data.address],
      ["Installation", data.installation ? "Supply & install" : "Product only"],
      ["Notes", data.notes?.trim() || "—"],
    ];

    const html = `
      <div style="font-family:Arial,sans-serif;color:#111;max-width:640px">
        <h2 style="margin:0 0 12px">New cart order — ${esc(data.quoteNo)}</h2>
        <p style="margin:0 0 16px;color:#555">Submitted ${esc(submittedAt)}</p>
        <table style="border-collapse:collapse;width:100%;margin-bottom:16px">
          <thead>
            <tr>
              <th style="padding:6px 10px;border:1px solid #eee;background:#fafafa;text-align:left">Product</th>
              <th style="padding:6px 10px;border:1px solid #eee;background:#fafafa">Qty</th>
              <th style="padding:6px 10px;border:1px solid #eee;background:#fafafa;text-align:right">Unit</th>
              <th style="padding:6px 10px;border:1px solid #eee;background:#fafafa;text-align:right">Line total</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
          <tfoot>
            <tr>
              <td colspan="3" style="padding:6px 10px;border:1px solid #eee;font-weight:600">Delivery</td>
              <td style="padding:6px 10px;border:1px solid #eee;text-align:right">${esc(fmtR(data.delivery))}</td>
            </tr>
            <tr>
              <td colspan="3" style="padding:6px 10px;border:1px solid #eee;font-weight:700">Order total (incl. VAT)</td>
              <td style="padding:6px 10px;border:1px solid #eee;text-align:right;font-weight:700">${esc(fmtR(total))}</td>
            </tr>
          </tfoot>
        </table>
        <table style="border-collapse:collapse;width:100%">
          ${detailRows
            .map(
              ([k, v]) =>
                `<tr><td style="padding:6px 10px;border:1px solid #eee;background:#fafafa;width:180px;font-weight:600">${esc(k)}</td><td style="padding:6px 10px;border:1px solid #eee">${esc(String(v))}</td></tr>`,
            )
            .join("")}
        </table>
      </div>`;

    const { sendSmtpEmailDirect } = await import("@/lib/email/send-smtp.server");
    const subject = `New cart order ${data.quoteNo} — ${customerName}`;
    const recipients = [ORDER_TEAM_EMAIL, ...ORDER_CC_EMAILS];
    let firstError: string | undefined;
    let anyOk = false;
    for (const recipient of recipients) {
      const r = await sendSmtpEmailDirect({
        to: recipient,
        subject,
        html,
        replyTo: data.email,
        templateName: "cart-order-team",
      });
      if (r.success) anyOk = true;
      else if (!firstError) firstError = r.error;
    }
    return { ok: anyOk, error: anyOk ? null : (firstError ?? "Unknown send error") };
  });
