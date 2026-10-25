import { Link } from "@tanstack/react-router";
import { PencilRuler } from "lucide-react";
import { Button } from "./ui/button";

// Select the product in the existing form; generate the PDF only on submission.
// The root data-select-product handler also covers clicks before hydration.
export function BuildQuoteButton({
  product,
  className = "",
  label = "Build your own quote",
}: {
  product: string;
  className?: string;
  label?: string;
}) {
  return (
    <Button
      asChild
      className={`h-auto min-h-11 w-full whitespace-normal rounded-none border-2 border-foreground px-2 py-3 text-xs font-bold shadow-brutal-sm ${className}`}
    >
      <Link
        to="/"
        hash="form"
        data-select-product={product}
        className="flex items-center justify-center gap-2"
      >
        <PencilRuler className="size-4" />
        {label}
      </Link>
    </Button>
  );
}
