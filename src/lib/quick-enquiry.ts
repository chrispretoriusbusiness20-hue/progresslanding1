import { decodeProductName } from "./product-display";

export function buildQuickEnquiryUrl(name: string, phone: string, product: string) {
  const message = `Hi, I'd like to enquire about ${decodeProductName(product)}.\nName: ${name.trim()}\nPhone: ${phone.trim()}`;
  return `https://wa.me/27689560320?text=${encodeURIComponent(message)}`;
}
