import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, PencilRuler } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";

// One CTA does both jobs the owner asked for: the customer is taken to the
// quote form with their product already chosen, and a PDF quote for that
// product starts downloading straight away. The product hand-off itself is
// handled by the data-select-product attribute (see the inline script in
// src/routes/__root.tsx), which also covers clicks made before hydration.
export function BuildQuoteButton({
  product,
  className = "",
  label = "Build your own quote",
}: {
  product: string;
  className?: string;
  label?: string;
}) {
  const [pending, setPending] = useState(false);

  const createQuote = () => {
    if (pending) return;
    setPending(true);
    void (async () => {
      try {
        const { downloadCatalogueQuote } = await import("@/lib/catalogue-quote-pdf");
        await downloadCatalogueQuote(product);
      } catch {
        toast.error("Your quote could not be created. Please try again.");
      } finally {
        setPending(false);
      }
    })();
  };

  return (
    <Button
      asChild
      className={`h-auto min-h-11 w-full whitespace-normal rounded-none border-2 border-foreground px-2 py-3 text-xs font-bold shadow-brutal-sm ${className}`}
    >
      <Link
        to="/"
        hash="form"
        data-select-product={product}
        onClick={createQuote}
        className="flex items-center justify-center gap-2"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <PencilRuler className="size-4" />
        )}
        {label}
      </Link>
    </Button>
  );
}
