import { sendSmtpEmail, type SendEmailInput } from "./send-smtp.functions";

/**
 * Frontend helper. Calls the SMTP server function — no credentials in the browser.
 */
export async function sendEmail(input: SendEmailInput) {
  return await sendSmtpEmail({ data: input });
}
