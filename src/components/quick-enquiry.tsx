import { TOP_PRODUCTS } from "@/lib/popular-products";
import { decodeProductName } from "@/lib/product-display";
import { ProductEnquiryForm } from "./product-enquiry";

export function QuickEnquiry({
  product,
  onProduct,
}: {
  product: string;
  onProduct: (product: string) => void;
}) {
  return (
    <div id="quick-enquiry" className="mb-8 scroll-mt-24 border-b-2 border-foreground pb-8">
      <h3 className="text-2xl">Quick enquiry</h3>
      <div className="mt-4 space-y-4">
        <label className="block text-sm font-semibold" htmlFor="enquiry-product">
          Product
          <select
            id="enquiry-product"
            className="form-input mt-2"
            value={product}
            onChange={(event) => onProduct(event.target.value)}
            required
          >
            {TOP_PRODUCTS.map((item) => (
              <option key={item.name} value={item.name}>
                {decodeProductName(item.name)}
              </option>
            ))}
          </select>
        </label>
        <ProductEnquiryForm product={product} />
      </div>
    </div>
  );
}
