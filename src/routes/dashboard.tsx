import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, useEffect } from "react";
import { ArrowLeft, Globe, Flame, MapPin, Phone, Mail, Calendar, Banknote } from "lucide-react";
import { getQuoteRequests, type QuoteRequest } from "@/lib/dashboard.functions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Quote Request Dashboard — The Progress Group" },
      {
        name: "description",
        content: "Track incoming quote requests and lead pipeline.",
      },
    ],
  }),
  component: DashboardPage,
});

function formatZar(value: number | null): string {
  if (value == null) return "—";
  return "R " + value.toLocaleString("en-ZA");
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isInternalTest(q: QuoteRequest): boolean {
  const testEmails = [
    "christiaanpretorius16@gmail.com",
    "chrispretoriusbusiness20@gmail.com",
    "louis@progressgroup.co.za",
    "louis@progressinstallations.co.za",
  ];
  return testEmails.includes(q.email ?? "");
}

function getSourceLabel(q: QuoteRequest): string {
  if (isInternalTest(q)) return "Test";
  if (q.source && q.source !== "organic") return q.source;
  return "Organic";
}

function getSourceColor(source: string): string {
  if (source === "fireplacequotes.co.za") return "#E87722";
  if (source === "Facebook") return "#1877F2";
  return "#64748b";
}

function useQuotes() {
  const fetchQuotes = useServerFn(getQuoteRequests);
  const [quotes, setQuotes] = useState<QuoteRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchQuotes()
      .then((d) => {
        if (!cancelled) setQuotes(d);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchQuotes]);

  return { quotes, loading };
}

function DashboardPage() {
  const { quotes, loading } = useQuotes();

  const externalLeads = useMemo(
    () => quotes.filter((q) => !isInternalTest(q)),
    [quotes]
  );

  const featuredLead = useMemo(
    () => externalLeads[0] ?? null,
    [externalLeads]
  );

  const totalValue = useMemo(
    () => externalLeads.reduce((sum, q) => sum + (q.total_zar ?? 0), 0),
    [externalLeads]
  );

  const fireplaceCount = useMemo(
    () => externalLeads.filter((q) => q.source === "fireplacequotes.co.za").length,
    [externalLeads]
  );

  return (
    <div className="min-h-screen bg-background px-4 py-8 md:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground md:text-4xl">
              Quote request dashboard
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Track incoming quote requests and monitor your lead pipeline.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="https://lovable.dev/projects/364b61b2-afc7-4dea-88ce-fd447bccc843"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md border-2 border-primary bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-brutal-sm transition-colors hover:bg-primary/90"
            >
              <Flame className="h-4 w-4" />
              Open new leads CRM
            </a>
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to site
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="border-2 border-primary shadow-brutal-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                fireplacequotes.co.za leads
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Globe className="h-6 w-6 text-[#E87722]" />
                <span className="font-display text-3xl font-bold text-foreground">
                  {fireplaceCount}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total pipeline value
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Banknote className="h-6 w-6 text-primary" />
                <span className="font-display text-3xl font-bold text-foreground">
                  {formatZar(totalValue)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Latest lead
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Calendar className="h-6 w-6 text-primary" />
                <span className="text-lg font-semibold text-foreground">
                  {featuredLead
                    ? `${featuredLead.first_name} ${featuredLead.last_name}`
                    : "—"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Featured Lead */}
        {featuredLead && (
          <Card className="relative overflow-hidden border-2 border-[#E87722] shadow-brutal">
            <div className="absolute right-0 top-0 bg-[#E87722] px-3 py-1 text-xs font-bold text-white">
              {getSourceLabel(featuredLead).toUpperCase()} LEAD
            </div>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Flame className="h-5 w-5 text-primary" />
                Featured lead: {featuredLead.first_name} {featuredLead.last_name}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Email</p>
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-primary" />
                  {featuredLead.email}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Phone</p>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-primary" />
                  {featuredLead.phone ?? "—"}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Product</p>
                <div className="flex items-center gap-2 text-sm">
                  <Flame className="h-4 w-4 text-primary" />
                  {featuredLead.matched_product ?? featuredLead.product_requested}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Quote total</p>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Banknote className="h-4 w-4 text-primary" />
                  {formatZar(featuredLead.total_zar)}
                </div>
              </div>
              <div className="space-y-1 sm:col-span-2 lg:col-span-4">
                <p className="text-xs text-muted-foreground">Address</p>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-primary" />
                  {featuredLead.address}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Leads table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">All quote requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                        Loading quote requests…
                      </TableCell>
                    </TableRow>
                  ) : quotes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                        No quote requests yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    quotes.map((q) => {
                      const source = getSourceLabel(q);
                      const sourceColor = getSourceColor(source);
                      const isFeatured = q.id === featuredLead?.id;
                      return (
                        <TableRow
                          key={q.id}
                          className={isFeatured ? `bg-[${sourceColor}]/5` : undefined}
                        >
                          <TableCell className="whitespace-nowrap text-xs">
                            {formatDate(q.created_at)}
                          </TableCell>
                          <TableCell className="font-medium">
                            {q.first_name} {q.last_name}
                            {isFeatured && (
                              <Badge className="ml-2" style={{ backgroundColor: sourceColor }}>
                                {source}
                              </Badge>
                            )}
                            {isInternalTest(q) && (
                              <Badge variant="secondary" className="ml-2">
                                Internal test
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            <div>{q.email}</div>
                            <div className="text-muted-foreground">{q.phone}</div>
                          </TableCell>
                          <TableCell className="max-w-xs truncate text-xs">
                            {q.matched_product ?? q.product_requested}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right font-semibold">
                            {formatZar(q.total_zar)}
                          </TableCell>
                          <TableCell>
                            {source === "Test" ? (
                              <span className="text-xs text-muted-foreground">Test</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: sourceColor }}>
                                {source === "fireplacequotes.co.za" ? (
                                  <Globe className="h-3 w-3" />
                                ) : null}
                                {source}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
