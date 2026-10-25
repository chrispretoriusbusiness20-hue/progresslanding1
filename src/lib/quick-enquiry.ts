import { decodeProductName } from "./product-display";
import { z } from "zod";
import { getTopProduct } from "./popular-products";
import { getEnquiryOptions, type EnquiryRequest } from "./enquiry-options";

const hasNoControlCharacters = (text: string) =>
  Array.from(text).every(
    (character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127,
  );

export const quickEnquirySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter your name")
    .max(80)
    .refine(hasNoControlCharacters, "Enter a valid name"),
  phone: z
    .string()
    .trim()
    .min(7, "Enter a valid phone number")
    .max(25)
    .regex(/^\+?[\d ()-]+$/, "Enter a valid phone number")
    .refine(
      (phone) => phone.replace(/\D/g, "").length >= 7 && phone.replace(/\D/g, "").length <= 15,
      "Enter a valid phone number",
    ),
  product: z
    .string()
    .max(200)
    .refine((name) => Boolean(getTopProduct(name)), "Choose a top-pick product"),
  town: z.string().trim().max(100).refine(hasNoControlCharacters, "Enter a valid town").default(""),
  requests: z.array(z.string().max(40)).max(11).default([]),
}).superRefine((enquiry, context) => {
  const product = getTopProduct(enquiry.product);
  if (!product) return;
  const allowed = getEnquiryOptions(product).map((option) => option.id as string);
  if (new Set(enquiry.requests).size !== enquiry.requests.length || enquiry.requests.some((request) => !allowed.includes(request))) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["requests"], message: "Choose requests relevant to this product" });
  }
});

export function buildQuickEnquiryUrl(name: string, phone: string, product: string, town = "", requests: string[] = []) {
  const enquiry = quickEnquirySchema.parse({ name, phone, product, town, requests });
  const selectedProduct = getTopProduct(product);
  const selected = selectedProduct ? getEnquiryOptions(selectedProduct).filter((option) => enquiry.requests.includes(option.id as EnquiryRequest)) : [];
  const needs = selected.length ? `\n\nRequests:\n${selected.map((option) => `• ${option.label}`).join("\n")}` : "";
  const message = `Hi, I'd like to enquire about ${decodeProductName(enquiry.product)}.\nName: ${enquiry.name}\nPhone: ${enquiry.phone}${enquiry.town ? `\nTown: ${enquiry.town}` : ""}${needs}`;
  // The supplied Business short link resolves to this number. Numeric click-to-chat
  // links support dynamic prefilled text, unlike Business short-link defaults.
  return `https://wa.me/27689560320?text=${encodeURIComponent(message)}`;
}
