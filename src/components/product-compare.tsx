import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Columns3, RotateCcw } from "lucide-react";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import {
  flueRequirement,
  nextCompareSelection,
  productFuel,
  productKw,
  type CatalogueProduct,
} from "@/lib/catalogue-products";
import { decodeProductName, formatRand } from "@/lib/product-display";
import { getProductImageUrl } from "@/lib/product-images";
import { BuildQuoteButton } from "./build-quote-button";
import { getTopProduct, restoreTopComparisons } from "@/lib/popular-products";

const CompareContext = createContext<{
  products: CatalogueProduct[];
  toggle: (product: CatalogueProduct) => void;
} | null>(null);
export function CompareCheckbox({ product }: { product: CatalogueProduct }) {
  const compare = useContext(CompareContext);
  if (!compare) return null;
  const checked = compare.products.some((item) => item.name === product.name);
  return (
    <label className="flex min-h-11 items-center gap-2 text-sm">
      <Checkbox
        aria-label={`Compare ${decodeProductName(product.name)}`}
        checked={checked}
        disabled={!checked && compare.products.length >= 3}
        onCheckedChange={() => compare.toggle(product)}
      />
      Compare
    </label>
  );
}
export function ProductCompareProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<CatalogueProduct[]>([]);
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (state) => state.location.pathname });
  useEffect(() => {
    try {
      const names: unknown = JSON.parse(sessionStorage.getItem("progress_compare") ?? "[]");
      setProducts(restoreTopComparisons(names));
    } catch {
      /* Storage unavailable. */
    }
  }, []);
  const toggle = (product: CatalogueProduct) =>
    setProducts((selected) => {
      const currentProduct = getTopProduct(product.name);
      if (!currentProduct) return selected;
      const next = nextCompareSelection(selected, currentProduct);
      try {
        sessionStorage.setItem("progress_compare", JSON.stringify(next.map((item) => item.name)));
      } catch {
        /* Storage unavailable. */
      }
      return next;
    });
  const clear = () => {
    setProducts([]);
    try {
      sessionStorage.removeItem("progress_compare");
    } catch {
      /* Storage unavailable. */
    }
  };
  const visible = path === "/" || path === "/catalog";
  return (
    <CompareContext.Provider value={{ products, toggle }}>
      {children}
      {visible && products.length > 0 && (
        <div
          className={`fixed inset-x-0 z-40 border-t-2 border-foreground bg-background p-3 ${path === "/" ? "bottom-[72px] sm:bottom-0" : "bottom-0"}`}
        >
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 sm:pr-24">
            <span className="text-sm font-semibold">{products.length} / 3 selected</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                aria-label="Clear comparison"
                title="Clear comparison"
                onClick={clear}
              >
                <RotateCcw />
              </Button>
              <Button className="min-h-11 rounded-none" onClick={() => setOpen(true)}>
                <Columns3 />
                Compare ({products.length})
              </Button>
            </div>
          </div>
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] w-[calc(100%-32px)] max-w-4xl overflow-y-auto p-4 sm:p-6">
          <DialogTitle>Compare products</DialogTitle>
          <DialogDescription>Up to three products · Prices include VAT</DialogDescription>
          <div
            className="min-w-0 overflow-x-auto"
            tabIndex={0}
            aria-label="Product comparison table"
          >
            <table className="w-full table-fixed border-collapse text-left text-sm">
              <colgroup>
                <col className="w-28" />
                {products.map((product) => (
                  <col key={product.name} className="w-52" />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th className="p-3">Product</th>
                  {products.map((product) => (
                    <th key={product.name} className="border-l border-border p-3 align-top">
                      <img
                        src={getProductImageUrl({ ...product, productName: product.name })}
                        alt={decodeProductName(product.name)}
                        width={160}
                        height={160}
                        className="mb-3 aspect-square w-full object-contain"
                      />
                      <span className="break-words">{decodeProductName(product.name)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {["Fuel", "kW", "Price", "Flue required"].map((label) => (
                  <tr key={label} className="border-t border-border">
                    <th className="p-3">{label}</th>
                    {products.map((product) => (
                      <td key={product.name} className="border-l border-border p-3">
                        {label === "Fuel"
                          ? productFuel(product)
                          : label === "kW"
                            ? (productKw(product.name) ?? "—")
                            : label === "Price"
                              ? formatRand(product.price)
                              : flueRequirement(product)}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="border-t border-border">
                  <th className="p-3">Enquiry</th>
                  {products.map((product) => (
                    <td key={product.name} className="border-l border-border p-3">
                      <BuildQuoteButton product={product.name} label="Build your quote" />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </CompareContext.Provider>
  );
}
