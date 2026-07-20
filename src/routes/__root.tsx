import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { ChatWidget } from "@/components/chat-widget";

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

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

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
    scripts: [
      {
        type: "text/javascript",
        children: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','2169427620464385');fbq('track','PageView');`,
      },
      {
        type: "text/javascript",
        children: `(function(){var img=document.createElement('img');img.height=1;img.width=1;img.style.display='none';img.src='https://www.facebook.com/tr?id=2169427620464385&ev=PageView&noscript=1';document.body.appendChild(img);})();`,
      },
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
  errorComponent: ErrorComponent,
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
    // Fire Meta Pixel PageView on every client-side navigation.
    // The initial PageView is sent by the base pixel snippet in <head>.
    let lastPath = typeof window !== "undefined" ? window.location.pathname + window.location.search : "";
    const unsub = router.subscribe("onResolved", () => {
      if (typeof window === "undefined") return;
      const current = window.location.pathname + window.location.search;
      if (current === lastPath) return;
      lastPath = current;
      const fbq = (window as unknown as { fbq?: (...a: unknown[]) => void }).fbq;
      if (typeof fbq === "function") fbq("track", "PageView");
    });
    return () => unsub();
  }, [router]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <ChatWidget />
    </QueryClientProvider>
  );
}
