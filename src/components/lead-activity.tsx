import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listLeadEvents } from "@/lib/lead-events.functions";
import { decodeProductName } from "@/lib/product-display";
import { Button } from "./ui/button";

export function LeadActivity() {
  const load = useServerFn(listLeadEvents);
  const { data, error, isLoading, refetch, isFetching } = useQuery({ queryKey: ["lead-activity"], queryFn: () => load() });
  return <section className="border-y border-border py-6"><div className="mb-4 flex items-center justify-between gap-4"><h2 className="text-2xl">Latest 100 lead actions</h2><Button variant="outline" disabled={isFetching} onClick={() => void refetch()}>Refresh</Button></div>
    {isLoading ? <p>Loading activity…</p> : error ? <p role="alert" className="text-destructive">Activity is restricted to authorised staff or temporarily unavailable.</p> : !data?.length ? <p className="text-muted-foreground">No lead actions recorded yet.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-border">{["Date", "Customer", "Action / page", "Product", "Source", "Ad IDs"].map((label) => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{data.map((event) => <tr key={event.id} className="border-b border-border align-top"><td className="whitespace-nowrap p-3">{new Date(event.created_at).toLocaleString("en-GB")}</td><td className="p-3">{event.customer_name || "Anonymous visitor"}<div>{event.email}</div><div>{event.phone}</div></td><td className="p-3">{event.action.replaceAll("_", " ")}<div className="text-muted-foreground">{event.page}</div></td><td className="min-w-48 p-3">{event.products.map(decodeProductName).join("; ") || "—"}</td><td className="p-3">{event.utm_source || "Direct / untagged"}<div>{[event.utm_medium, event.utm_campaign].filter(Boolean).join(" · ")}</div></td><td className="max-w-48 break-all p-3">{event.fbclid ? `fbclid: ${event.fbclid}` : ""}{event.gclid ? ` gclid: ${event.gclid}` : ""}{!event.fbclid && !event.gclid ? "—" : ""}</td></tr>)}</tbody></table></div>}
  </section>;
}