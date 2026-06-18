import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sendSmtpEmailDirect } from "./send-smtp.server";

const sendInput = z.object({
  to: z.string().trim().email().max(255),
  subject: z.string().trim().min(1).max(200),
  html: z.string().min(1).max(50_000),
  replyTo: z.string().trim().email().max(255).optional(),
  cc: z.array(z.string().trim().email().max(255)).optional(),
});

export type SendEmailInput = z.infer<typeof sendInput>;

export const sendSmtpEmail = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => sendInput.parse(input))
  .handler(async ({ data }) => sendSmtpEmailDirect(data));
