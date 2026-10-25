import { MessageCircle } from "lucide-react";
import { Button } from "./ui/button";
import { TOP_PRODUCTS } from "@/lib/popular-products";
import { decodeProductName } from "@/lib/product-display";
import { buildQuickEnquiryUrl } from "@/lib/quick-enquiry";
import { captureLeadAction } from "@/lib/lead-events";

export function QuickEnquiry({ name, phone, product, onName, onPhone, onProduct }: {
  name: string;
  phone: string;
  product: string;
  onName: (name: string) => void;
  onPhone: (phone: string) => void;
  onProduct: (product: string) => void;
}) {
  return (
    <div id="quick-enquiry" className="mb-8 scroll-mt-24 border-b-2 border-foreground pb-8">
      <h3 className="text-2xl">Quick enquiry</h3>
      <form className="mt-4 space-y-4" onSubmit={(event) => {
        event.preventDefault();
        window.open(buildQuickEnquiryUrl(name, phone, product), "_blank", "noopener,noreferrer");
        void captureLeadAction("whatsapp_click", [product], { customerName: name.trim(), phone: phone.trim() });
      }}>
        <label className="block text-sm font-semibold" htmlFor="enquiry-name">
          Name *
          <input id="enquiry-name" className="form-input mt-2" value={name} onChange={(event) => onName(event.target.value)} autoComplete="given-name" required maxLength={80} />
        </label>
        <label className="block text-sm font-semibold" htmlFor="enquiry-phone">
          Phone number *
          <input id="enquiry-phone" className="form-input mt-2" type="tel" value={phone} onChange={(event) => onPhone(event.target.value)} autoComplete="tel" required maxLength={40} />
        </label>
        <label className="block text-sm font-semibold" htmlFor="enquiry-product">
          Product
          <select id="enquiry-product" className="form-input mt-2" value={product} onChange={(event) => onProduct(event.target.value)} required>
            {TOP_PRODUCTS.map((item) => <option key={item.name} value={item.name}>{decodeProductName(item.name)}</option>)}
          </select>
        </label>
        <Button type="submit" className="min-h-12 w-full rounded-none"><MessageCircle />Continue on WhatsApp</Button>
      </form>
    </div>
  );
}