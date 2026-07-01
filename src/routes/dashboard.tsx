import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listQuotes, getQuotePdfUrl, updateQuote, type QuoteRow } from "@/lib/list-quotes.functions";

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
  const [editing, setEditing] = useState<QuoteRow | null>(null);

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
                <Th>Edit</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <Row key={r.id} r={r} onEdit={() => setEditing(r)} />
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
      {editing && (
        <EditModal
          row={editing}
          onClose={() => setEditing(null)}
        />
      )}
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

function Row({ r, onEdit }: { r: QuoteRow; onEdit: () => void }) {
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
          <button
            type="button"
            onClick={async () => {
              try {
                const res = await getQuotePdfUrl({ data: { id: r.id } });
                if (res.url) window.open(res.url, "_blank", "noopener,noreferrer");
                else alert("PDF not available for this quote.");
              } catch (e) {
                alert(`Could not open PDF: ${(e as Error).message}`);
              }
            }}
            className="text-xs text-primary hover:underline"
          >
            View
          </button>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-3">
        <button
          type="button"
          onClick={onEdit}
          className="text-xs text-primary hover:underline"
        >
          Edit
        </button>
      </td>
    </tr>
  );
}

function EditModal({ row, onClose }: { row: QuoteRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    first_name: row.first_name ?? "",
    last_name: row.last_name ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    address: row.address ?? "",
    matched_product: row.matched_product ?? row.product_requested ?? "",
    quantity: row.quantity ?? 1,
    unit_price_zar: row.unit_price_zar ?? 0,
    transport_zar: row.transport_zar ?? 0,
    total_zar: row.total_zar ?? 0,
    status: row.status ?? "pending",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      await updateQuote({
        data: {
          id: row.id,
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email,
          phone: form.phone,
          address: form.address || null,
          matched_product: form.matched_product || null,
          quantity: Number(form.quantity) || 1,
          unit_price_zar: Number(form.unit_price_zar) || 0,
          transport_zar: Number(form.transport_zar) || 0,
          total_zar: Number(form.total_zar) || 0,
          status: form.status,
        },
      });
      await qc.invalidateQueries({ queryKey: ["all-quotes"] });
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-lg bg-background p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Edit quote</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="First name" value={form.first_name} onChange={(v) => set("first_name", v)} />
          <Field label="Last name" value={form.last_name} onChange={(v) => set("last_name", v)} />
          <Field label="Email" value={form.email} onChange={(v) => set("email", v)} />
          <Field label="Phone" value={form.phone} onChange={(v) => set("phone", v)} />
          <Field label="Address" value={form.address} onChange={(v) => set("address", v)} full />
          <Field label="Product" value={form.matched_product} onChange={(v) => set("matched_product", v)} full />
          <Field label="Qty" type="number" value={String(form.quantity)} onChange={(v) => set("quantity", Number(v))} />
          <Field label="Unit price (R)" type="number" value={String(form.unit_price_zar)} onChange={(v) => set("unit_price_zar", Number(v))} />
          <Field label="Transport (R)" type="number" value={String(form.transport_zar)} onChange={(v) => set("transport_zar", Number(v))} />
          <Field label="Total (R)" type="number" value={String(form.total_zar)} onChange={(v) => set("total_zar", Number(v))} />
          <div>
            <label className="block text-xs font-medium text-muted-foreground">Status</label>
            <select
              value={form.status}
              onChange={(e) => set("status", e.target.value)}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
        {err && <div className="mt-3 text-sm text-red-600">{err}</div>}
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", full = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="block text-xs font-medium text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
      />
    </div>
  );
}
