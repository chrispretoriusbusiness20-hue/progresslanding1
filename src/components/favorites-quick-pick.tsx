import { useMemo, useState } from "react";
import { Heart, Copy, Check, X, ExternalLink } from "lucide-react";
import productsData from "@/data/products-full.json";
import { useFavorites } from "@/hooks/use-favorites";

type Product = {
  id: string;
  name: string;
  price: string | null;
  image: string | null;
  url: string;
  category: string;
  subcategory: string;
};

const products = productsData as Product[];

export function FavoritesQuickPick() {
  const { ids, remove } = useFavorites();
  const [copied, setCopied] = useState<"single" | "all" | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const favoriteProducts = useMemo(
    () => ids.map((id) => products.find((p) => p.id === id)).filter((p): p is Product => Boolean(p)),
    [ids],
  );

  if (favoriteProducts.length === 0) return null;

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  };

  const copyOne = async (p: Product) => {
    await copy(p.name);
    setCopiedId(p.id);
    setCopied("single");
    setTimeout(() => {
      setCopiedId(null);
      setCopied(null);
    }, 1500);
  };

  const copyAll = async () => {
    const list = favoriteProducts
      .map((p) => `• ${p.name}${p.price ? ` — ${p.price}` : ""}`)
      .join("\n");
    await copy(list);
    setCopied("all");
    setTimeout(() => setCopied(null), 1800);
  };

  return (
    <div className="mb-8 border-2 border-foreground bg-accent/20 shadow-brutal-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-foreground bg-background px-4 py-3">
        <div className="flex items-center gap-2">
          <Heart className="h-4 w-4 fill-primary text-primary" />
          <span className="font-display text-sm uppercase tracking-wider">
            Your favorites
          </span>
          <span className="text-xs font-bold uppercase tracking-widest text-primary">
            ({favoriteProducts.length})
          </span>
        </div>
        <button
          type="button"
          onClick={copyAll}
          className="inline-flex items-center gap-1.5 border-2 border-foreground bg-primary px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-primary-foreground shadow-brutal-sm transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none"
        >
          {copied === "all" ? (
            <>
              <Check className="h-3.5 w-3.5" /> Copied list
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" /> Copy all to clipboard
            </>
          )}
        </button>
      </div>
      <ul className="divide-y-2 divide-foreground/10">
        {favoriteProducts.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            {p.image ? (
              <img
                src={p.image}
                alt=""
                loading="lazy"
                className="h-12 w-12 border-2 border-foreground object-cover"
              />
            ) : (
              <div className="h-12 w-12 border-2 border-foreground bg-background" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-sm leading-tight">{p.name}</p>
              <p className="text-xs text-muted-foreground">
                {p.subcategory || p.category}
                {p.price ? ` · ${p.price}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => copyOne(p)}
                className="inline-flex items-center gap-1 border-2 border-foreground/40 px-2 py-1.5 text-[11px] font-bold uppercase tracking-widest text-foreground/70 transition hover:border-foreground hover:text-foreground"
                aria-label={`Copy ${p.name}`}
              >
                {copied === "single" && copiedId === p.id ? (
                  <>
                    <Check className="h-3 w-3" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" /> Copy
                  </>
                )}
              </button>
              <a
                href={p.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-7 w-7 items-center justify-center border-2 border-foreground/40 text-foreground/70 transition hover:border-foreground hover:text-foreground"
                aria-label={`Open ${p.name} details`}
              >
                <ExternalLink className="h-3 w-3" />
              </a>
              <button
                type="button"
                onClick={() => remove(p.id)}
                className="inline-flex h-7 w-7 items-center justify-center border-2 border-foreground/40 text-foreground/70 transition hover:border-foreground hover:text-foreground"
                aria-label={`Remove ${p.name} from favorites`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </li>
        ))}
      </ul>
      <p className="border-t-2 border-foreground/10 px-4 py-2 text-[11px] uppercase tracking-widest text-muted-foreground">
        Tip: copy a product name, then paste it into the form's product field.
      </p>
    </div>
  );
}
