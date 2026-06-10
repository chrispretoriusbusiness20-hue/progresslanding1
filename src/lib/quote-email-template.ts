export interface QuoteEmailData {
  clientName: string;
  quoteNo: string;
  productName?: string;
}

export function buildQuoteEmailHtml(data: QuoteEmailData): string {
  const { clientName, quoteNo, productName } = data;
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your Progress Group Quote</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f4;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%;background-color:#ffffff;border-radius:4px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background-color:#ffffff;padding:24px 32px;text-align:center;border-bottom:1px solid #e5e5e5;">
              <img src="https://www.progressgrp.co.za/__l5e/assets-v1/97a6fd48-6b37-4177-9026-44e00e1aa5eb/progress-header-transparent.png" alt="The Progress Group" width="280" style="display:inline-block;max-width:80%;height:auto;" />
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;color:#111111;font-size:16px;line-height:1.6;">Hi ${escapeHtml(clientName)},</p>
              <p style="margin:0 0 16px;color:#111111;font-size:16px;line-height:1.6;">Thank you for your enquiry. Below is your quotation for the supply and installation of your fireplace system.</p>
              ${productName ? `<p style="margin:0 0 16px;color:#111111;font-size:16px;line-height:1.6;"><strong>Product:</strong> ${escapeHtml(productName)}</p>` : ""}
              <p style="margin:0 0 24px;color:#111111;font-size:16px;line-height:1.6;">Please find your quote <strong>${escapeHtml(quoteNo)}</strong> attached as a PDF.</p>
              <p style="margin:0 0 4px;color:#111111;font-size:16px;line-height:1.6;">Kind regards</p>
              <p style="margin:0;color:#111111;font-size:16px;font-weight:700;line-height:1.6;">The Progress Group</p>
            </td>
          </tr>
          <!-- Footer -->
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
