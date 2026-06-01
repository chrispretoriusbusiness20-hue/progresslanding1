import { lazy, Suspense } from "react";
import { useFavorites } from "@/hooks/use-favorites";

// Heavy: pulls in products-full.json (~700 items). Only load it when
// the user actually has favorites — keeps it out of the initial bundle.
const FavoritesQuickPickInner = lazy(() =>
  import("./favorites-quick-pick-inner").then((m) => ({
    default: m.FavoritesQuickPickInner,
  })),
);

export function FavoritesQuickPick() {
  const { ids } = useFavorites();
  if (ids.length === 0) return null;
  return (
    <Suspense fallback={null}>
      <FavoritesQuickPickInner />
    </Suspense>
  );
}
