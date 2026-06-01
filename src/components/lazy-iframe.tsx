import { useEffect, useRef, useState } from "react";

type Props = {
  src: string;
  title: string;
  className?: string;
  style?: React.CSSProperties;
  /** Distance in px before the iframe enters the viewport at which to start loading. */
  rootMargin?: string;
  placeholder?: React.ReactNode;
};

/**
 * Defers iframe mount until the placeholder scrolls near the viewport.
 * Native loading="lazy" still downloads the document earlier than this and
 * runs scripts; LazyIframe skips the whole mount so the main thread stays free.
 */
export function LazyIframe({
  src,
  title,
  className,
  style,
  rootMargin = "400px",
  placeholder,
}: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    if (shouldLoad) return;
    const el = wrapRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setShouldLoad(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShouldLoad(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin, shouldLoad]);

  return (
    <div ref={wrapRef} className={className} style={style}>
      {shouldLoad ? (
        <iframe
          src={src}
          title={title}
          loading="lazy"
          className="block h-full w-full bg-transparent"
          style={{ colorScheme: "light" }}
        />
      ) : (
        placeholder ?? (
          <div className="flex h-full w-full items-center justify-center text-xs uppercase tracking-[0.32em] text-muted-foreground">
            Loading form…
          </div>
        )
      )}
    </div>
  );
}
