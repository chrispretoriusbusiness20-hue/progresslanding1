import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "./ui/button";

export function CatalogueQuoteButton({ product }: { product: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const download = async () => {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const { downloadCatalogueQuote } = await import("@/lib/catalogue-quote-pdf");
      await downloadCatalogueQuote(product);
    } catch {
      setError("Your PDF could not be created. Please try again.");
    } finally { setPending(false); }
  };
  return <>
    <Button onClick={download} disabled={pending} className="min-h-11 w-full whitespace-normal rounded-none border-2 border-foreground px-2 py-3 text-xs font-bold shadow-brutal-sm">
      {pending ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
      {pending ? "Creating PDF…" : "Get a quote"}
    </Button>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </>;
}