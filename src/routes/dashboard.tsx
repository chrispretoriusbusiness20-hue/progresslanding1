import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

const TARGET_URL = "https://fireplacequotes.co.za";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Redirecting to Fireplace Quotes" },
      { name: "robots", content: "noindex" },
      { httpEquiv: "refresh", content: `0; url=${TARGET_URL}` },
    ],
  }),
  component: DashboardRedirect,
});

function DashboardRedirect() {
  useEffect(() => {
    window.location.replace(TARGET_URL);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Redirecting…</p>
        <a
          href={TARGET_URL}
          className="text-base font-semibold text-primary underline underline-offset-4"
        >
          Continue to fireplacequotes.co.za
        </a>
      </div>
    </div>
  );
}
