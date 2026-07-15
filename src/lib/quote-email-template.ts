export interface QuoteEmailData {
  clientName: string;
  quoteNo: string;
  productName?: string;
  productImageUrl?: string;
  /** Main message paragraphs (HTML-safe plain text). */
  intro?: string;
  /** Optional second line, e.g. "Herewith your quote as requested..." */
  body?: string;
  /** Optional CTA button. */
  acceptUrl?: string;
  acceptLabel?: string;
  /** Optional secondary link to view/download the quote again. */
  viewUrl?: string;
  viewLabel?: string;
  /** Payment terms line shown above signature. */
  paymentTerms?: string;
  /** Optional extra HTML inserted before the signature (e.g. a summary table). */
  extraHtml?: string;
  /** Headline color accent. Defaults to brand orange. */
  accent?: string;
}

export function buildQuoteEmailHtml(data: QuoteEmailData): string {
  const {
    clientName,
    quoteNo,
    productName,
    productImageUrl,
    intro,
    body,
    acceptUrl,
    acceptLabel = "Accept Quote",
    viewUrl,
    viewLabel = "View your quote",
    paymentTerms = "Full payment on order.",
    extraHtml,
    accent = "#dd7400",
  } = data;

  const introLine =
    intro ?? (productName
      ? `Thanks for your interest in <strong>${escapeHtml(productName)}</strong>.`
      : "Thank you for your enquiry.");
  const bodyLine =
    body ?? "Herewith your quote as requested. If you want to proceed click on the <strong>Accept Quote</strong> button below.";

  const productBlock = productName
    ? `
      <tr>
        <td style="padding:8px 32px 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
            <tr>
              ${
                productImageUrl
                  ? `<td valign="middle" style="width:120px;padding-right:16px;">
                      <img src="${escapeAttr(productImageUrl)}" alt="${escapeAttr(productName)}" width="120" style="display:block;width:120px;height:auto;border-radius:4px;border:1px solid #e5e5e5;" />
                    </td>`
                  : ""
              }
              <td valign="middle" style="color:#111111;font-size:15px;font-weight:700;line-height:1.5;">
                ${escapeHtml(productName)}
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    : "";

  const acceptCell = acceptUrl
    ? `<td style="background-color:${accent};border-radius:4px;padding:0;">
         <a href="${escapeAttr(acceptUrl)}" style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">
           ${escapeHtml(acceptLabel)}
         </a>
       </td>
       ${viewUrl ? `<td style="width:12px;font-size:0;line-height:0;">&nbsp;</td>` : ""}`
    : "";

  const viewCell = viewUrl
    ? `<td style="background-color:#ffffff;border:1px solid ${accent};border-radius:4px;padding:0;">
         <a href="${escapeAttr(viewUrl)}" style="display:inline-block;padding:13px 26px;color:${accent};font-size:15px;font-weight:700;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">
           ${escapeHtml(viewLabel)}
         </a>
       </td>`
    : "";

  const ctaBlock = acceptUrl || viewUrl
    ? `
      <tr>
        <td style="padding:8px 32px 28px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              ${acceptCell}
              ${viewCell}
            </tr>
          </table>
        </td>
      </tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(quoteNo)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f4;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%;background-color:#ffffff;border-radius:4px;overflow:hidden;">
          <tr>
            <td style="background-color:#ffffff;padding:24px 32px;text-align:center;border-bottom:1px solid #e5e5e5;">
              <img src="https://www.progressgrp.co.za/__l5e/assets-v1/97a6fd48-6b37-4177-9026-44e00e1aa5eb/progress-header-transparent.png" alt="The Progress Group" width="280" style="display:inline-block;max-width:80%;height:auto;" />
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 8px;">
              <h1 style="margin:0 0 18px;color:#111111;font-size:22px;font-weight:700;line-height:1.3;letter-spacing:0.5px;">
                ${escapeHtml(quoteNo)}
              </h1>
              <p style="margin:0 0 14px;color:#111111;font-size:16px;line-height:1.6;">Hi ${escapeHtml(clientName)},</p>
              <p style="margin:0 0 14px;color:#111111;font-size:16px;line-height:1.6;">${introLine}</p>
              <p style="margin:0 0 8px;color:#111111;font-size:16px;line-height:1.6;">${bodyLine}</p>
            </td>
          </tr>
          ${productBlock}
          ${ctaBlock}
          ${extraHtml ? `<tr><td style="padding:0 32px 16px;">${extraHtml}</td></tr>` : ""}
          <tr>
            <td style="padding:8px 32px 28px;">
              <p style="margin:0 0 14px;color:#111111;font-size:14px;line-height:1.6;"><strong>Payment terms:</strong> ${escapeHtml(paymentTerms)}</p>
              <p style="margin:0 0 4px;color:#111111;font-size:15px;line-height:1.6;">Kind regards,</p>
              <p style="margin:0;color:#111111;font-size:15px;font-weight:700;line-height:1.6;">The Progress Group</p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#fafafa;padding:20px 32px;text-align:center;border-top:1px solid #e5e5e5;">
              <p style="margin:0 0 4px;color:#666666;font-size:12px;line-height:1.5;">189 Durban Road, Bellville, Cape Town, 7530</p>
              <p style="margin:0 0 4px;color:#666666;font-size:12px;line-height:1.5;">Tel: 021 945 3636 | Installations: 087 550 0413</p>
              <p style="margin:0;color:#666666;font-size:12px;line-height:1.5;">Email: <a href="mailto:info@progressinstallations.co.za" style="color:#666666;text-decoration:underline;">info@progressinstallations.co.za</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(str: string): string {
  return escapeHtml(str);
}
