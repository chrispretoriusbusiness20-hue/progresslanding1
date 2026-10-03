import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { lazy, useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { ChatWidget } from "@/components/chat-widget";
import { StitchPayLink } from "@/components/stitch-pay-link";
import { Toaster } from "@/components/ui/sonner";
import { META_PIXEL_ID, META_PIXEL_ID_2, captureFbclid, trackContact, trackPageView } from "@/lib/meta-pixel";

type FbqWindow = Window & {
  fbq?: ((...args: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown };
  _fbq?: unknown;
  __metaPixelLoaded?: boolean;
};

/** Installs the lightweight fbq queue stub immediately so early events
 *  (Contact clicks, route-change PageViews) are queued, not dropped, while
 *  the fbevents.js script itself still loads deferred. */
function ensureFbqStub() {
  const w = window as unknown as FbqWindow;
  if (w.fbq) return;
  const n = ((...args: unknown[]) => {
    n.queue!.push(args);
  }) as NonNullable<FbqWindow["fbq"]>;
  n.queue = [];
  n.loaded = false;
  n.version = "2.0";
  n.push = n;
  w.fbq = n;
  w._fbq = n;
}

/** Loads the Meta Pixel script once, after the page has painted, then fires the first PageView. */
function loadMetaPixel() {
  const w = window as unknown as FbqWindow;
  if (w.__metaPixelLoaded) return;
  w.__metaPixelLoaded = true;
  ensureFbqStub();
  const t = document.createElement("script");
  t.async = true;
  t.src = "https://connect.facebook.net/en_US/fbevents.js";
  const s = document.getElementsByTagName("script")[0];
  s?.parentNode?.insertBefore(t, s);
  w.fbq!("init", META_PIXEL_ID);
  w.fbq!("init", META_PIXEL_ID_2);
  w.fbq!("track", "PageView");
}


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  const errorInstance = error instanceof Error ? error : new Error(String(error));
  console.error(errorInstance);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(errorInstance, { boundary: "tanstack_root_error_component" });
  }, [errorInstance]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        if (url.hostname === "progressgroup.co.za") {
          url.hostname = "www.progressgroup.co.za";
          return Response.redirect(url.toString(), 301);
        }
      },
    },
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "The Progress Group — Fireplaces, Braais, Lighting & Aircons" },
      { name: "description", content: "The Progress Group supplies and installs fireplaces, braais, lighting and aircons across South Africa. Request a tailored quote online." },
      { name: "author", content: "The Progress Group" },
      { property: "og:title", content: "The Progress Group — Fireplaces, Braais, Lighting & Aircons" },
      { property: "og:description", content: "The Progress Group supplies and installs fireplaces, braais, lighting and aircons across South Africa. Request a tailored quote online." },
      { property: "og:site_name", content: "The Progress Group" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "The Progress Group — Fireplaces, Braais, Lighting & Aircons" },
      { name: "twitter:description", content: "The Progress Group supplies and installs fireplaces, braais, lighting and aircons across South Africa. Request a tailored quote online." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/5xv0qmivVVhv9FE5bA4bTElDxzo2/social-images/social-1782992808210-ChatGPT_Image_Jul_2,_2026,_01_45_19_PM.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/5xv0qmivVVhv9FE5bA4bTElDxzo2/social-images/social-1782992808210-ChatGPT_Image_Jul_2,_2026,_01_45_19_PM.webp" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;0,800;1,600;1,700&family=Inter:wght@400;500;600;700&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: lazy(() => Promise.resolve({ default: ErrorComponent })),
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    captureFbclid();
    ensureFbqStub();
    const start = () => loadMetaPixel();
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
    if (document.readyState === "complete") {
      if (idle) idle(start, { timeout: 2000 });
      else setTimeout(start, 1);
    } else {
      window.addEventListener("load", () => (idle ? idle(start, { timeout: 2000 }) : setTimeout(start, 1)), { once: true });
    }

    // Contact event for WhatsApp / phone links anywhere on the site.
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.("a[href]");
      const href = link?.getAttribute("href") ?? "";
      if (/^tel:/i.test(href)) trackContact("phone");
      else if (/wa\.me|whatsapp\.com/i.test(href)) trackContact("whatsapp");
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    // Fire Meta Pixel PageView on every client-side navigation.
    // The initial PageView is sent by the base pixel snippet in <head>.
    let lastPath = typeof window !== "undefined" ? window.location.pathname + window.location.search : "";
    const unsub = router.subscribe("onResolved", () => {
      if (typeof window === "undefined") return;
      const current = window.location.pathname + window.location.search;
      if (current === lastPath) return;
      lastPath = current;
      trackPageView();
    });
    return () => unsub();
  }, [router]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <ChatWidget />
      <StitchPayLink />
      <Toaster position="top-center" richColors closeButton />
    </QueryClientProvider>
  );
}
