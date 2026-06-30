import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listQuotes, getQuotePdfUrl, type QuoteRow } from "@/lib/list-quotes.functions";

const quotesQO = queryOptions({
  queryKey: ["all-quotes"],
  queryFn: () => listQuotes(),
});

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Auto Quote Leads" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(quotesQO),
  component: DashboardPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-red-600">Failed to load: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8">Not found.</div>,
});

const fmtZAR = (n: number | null | undefined) =>
  n == null ? "—" : `R${Number(n).toLocaleString("en-ZA", { maximumFractionDigits: 0 })}`;

const fmtDate = (s: string) => {
  const d = new Date(s);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

function DashboardPage() {
  const { data } = useSuspenseQuery(quotesQO);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [source, setSource] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (source !== "all" && (r.source ?? "organic") !== source) return false;
      if (!q) return true;
      return [r.first_name, r.last_name, r.email, r.phone, r.address, r.matched_product, r.product_requested]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [data, query, status, source]);

  const stats = useMemo(() => {
    const total = data.length;
    const sumValue = data.reduce((acc, r) => acc + (Number(r.total_zar) || 0), 0);
    const pending = data.filter((r) => r.status === "pending").length;
    const approved = data.filter((r) => r.status === "approved").length;
    const fpq = data.filter((r) => (r.source ?? "organic") === "fireplacequotes.co.za").length;
    return { total, sumValue, pending, approved, fpq };
  }, [data]);

  const exportCSV = () => {
    const headers = [
      "Date","Name","Email","Phone","Address","Product","Qty","Story","Flooring","Corner",
      "Distance km","Unit ZAR","Transport ZAR","Total ZAR","Source","Status",
    ];
    const rows = filtered.map((r) => [
      fmtDate(r.created_at),
      `${r.first_name} ${r.last_name}`,
      r.email,
      r.phone,
      r.address ?? "",
      r.matched_product ?? r.product_requested ?? "",
      r.quantity,
      r.story_type ?? "",
      r.flooring ?? "",
      r.corner_install ? "yes" : "no",
      r.distance_km ?? "",
      r.unit_price_zar ?? "",
      r.transport_zar ?? "",
      r.total_zar ?? "",
      r.source ?? "organic",
      r.status,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auto-quotes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Auto Quote Leads</h1>
            <p className="text-sm text-muted-foreground">
              All {stats.total} self-quoted leads from the form.
            </p>
          </div>
          <button
            onClick={exportCSV}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Export CSV
          </button>
        </header>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <StatCard label="Total leads" value={stats.total.toString()} />
          <StatCard label="Pending" value={stats.pending.toString()} />
          <StatCard label="Approved" value={stats.approved.toString()} />
          <StatCard label="From fireplacequotes" value={stats.fpq.toString()} />
          <StatCard label="Pipeline value" value={fmtZAR(stats.sumValue)} />
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email, phone, product…"
            className="flex-1 min-w-[220px] rounded-md border bg-background px-3 py-2 text-sm"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="all">All status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="all">All sources</option>
            <option value="organic">Organic</option>
            <option value="fireplacequotes.co.za">fireplacequotes.co.za</option>
          </select>
          <span className="text-sm text-muted-foreground">{filtered.length} shown</span>
        </div>

        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <Th>Date</Th>
                <Th>Client</Th>
                <Th>Contact</Th>
                <Th>Product</Th>
                <Th>Install</Th>
                <Th className="text-right">Total</Th>
                <Th>Source</Th>
                <Th>Status</Th>
                <Th>PDF</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <Row key={r.id} r={r} />
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted-foreground">
                    No leads match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2 font-medium ${className}`}>{children}</th>;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function Row({ r }: { r: QuoteRow }) {
  const installBits = [
    r.story_type,
    r.flooring,
    r.corner_install ? "corner" : null,
    r.distance_km != null ? `${Math.round(Number(r.distance_km))} km` : null,
  ].filter(Boolean);
  const product = r.matched_product ?? r.product_requested ?? "—";
  const statusColor =
    r.status === "approved"
      ? "bg-green-100 text-green-800"
      : r.status === "rejected"
      ? "bg-red-100 text-red-800"
      : "bg-amber-100 text-amber-800";

  return (
    <tr className="border-t align-top">
      <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">{fmtDate(r.created_at)}</td>
      <td className="px-3 py-3">
        <div className="font-medium">
          {r.first_name} {r.last_name}
        </div>
        {r.address && <div className="text-xs text-muted-foreground">{r.address}</div>}
      </td>
      <td className="px-3 py-3">
        <a href={`mailto:${r.email}`} className="block text-primary hover:underline">
          {r.email}
        </a>
        <a href={`tel:${r.phone}`} className="block text-xs text-muted-foreground hover:underline">
          {r.phone}
        </a>
      </td>
      <td className="px-3 py-3">
        <div>{product}</div>
        <div className="text-xs text-muted-foreground">Qty {r.quantity}</div>
      </td>
      <td className="px-3 py-3 text-xs text-muted-foreground">
        {installBits.length ? installBits.join(" · ") : "—"}
      </td>
      <td className="px-3 py-3 text-right font-medium whitespace-nowrap">{fmtZAR(r.total_zar)}</td>
      <td className="px-3 py-3 text-xs">{r.source ?? "organic"}</td>
      <td className="px-3 py-3">
        <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${statusColor}`}>
          {r.status}
        </span>
      </td>
      <td className="px-3 py-3">
        {r.pdf_path ? (
          <a
            href={`https://vqmrohoxuuyvphuomfuo.supabase.co/storage/v1/object/public/quotes/${r.pdf_path}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-primary hover:underline"
          >
            View
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  );
}
