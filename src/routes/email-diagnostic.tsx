import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { diagnoseEmailDomain } from "@/lib/email-diagnostic.functions";
import { sendTestEmail } from "@/lib/email-test.functions";

export const Route = createFileRoute("/email-diagnostic")({
  head: () => ({
    meta: [
      { title: "Email Deliverability Diagnostic" },
      { name: "description", content: "Check MX, SPF, DKIM and DMARC for an email address." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EmailDiagnosticPage,
});

type Result = Awaited<ReturnType<typeof diagnoseEmailDomain>>;

type TestResult = Awaited<ReturnType<typeof sendTestEmail>>;

function EmailDiagnosticPage() {
  const run = useServerFn(diagnoseEmailDomain);
  const sendTest = useServerFn(sendTestEmail);
  const [email, setEmail] = useState("sales@progressinstallations.co.za");
  const [selectors, setSelectors] = useState("google,default,selector1,selector2,k1,mail,dkim");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  async function onSendTest() {
    setTestLoading(true);
    setTestError(null);
    setTestResult(null);
    try {
      const r = await sendTest({ data: { to: email } });
      setTestResult(r);
    } catch (err) {
      setTestError(err instanceof Error ? err.message : "Test send failed.");
    } finally {
      setTestLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const dkimSelectors = selectors
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 10);
      const r = await run({ data: { email, dkimSelectors } });
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Diagnostic failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold mb-2">Email deliverability diagnostic</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Looks up MX, SPF, DKIM and DMARC over DNS-over-HTTPS and explains likely reasons verification emails don't arrive.
      </p>

      <form onSubmit={onSubmit} className="space-y-3 mb-8">
        <label className="block text-sm font-medium">
          Email address
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm font-medium">
          DKIM selectors to probe (comma-separated)
          <input
            type="text"
            value={selectors}
            onChange={(e) => setSelectors(e.target.value)}
            className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-sm font-mono"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Run diagnostic
          </button>
          <button
            type="button"
            onClick={onSendTest}
            disabled={testLoading}
            className="inline-flex items-center gap-2 rounded border border-input bg-background px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {testLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Send test email to this address
          </button>
        </div>
      </form>

      {testError ? (
        <div className="rounded border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive mb-4">
          {testError}
        </div>
      ) : null}
      {testResult ? <TestReport t={testResult} /> : null}

      {error ? (
        <div className="rounded border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      ) : null}

      {result ? <Report r={result} /> : null}
    </main>
  );
}

function Section({ title, ok, children }: { title: string; ok: boolean | "warn"; children: React.ReactNode }) {
  const Icon = ok === true ? CheckCircle2 : ok === "warn" ? AlertTriangle : XCircle;
  const color = ok === true ? "text-green-600" : ok === "warn" ? "text-amber-600" : "text-red-600";
  return (
    <section className="rounded border border-border p-4 mb-4">
      <h2 className={`flex items-center gap-2 font-semibold mb-2 ${color}`}>
        <Icon className="h-4 w-4" /> {title}
      </h2>
      <div className="text-sm space-y-1">{children}</div>
    </section>
  );
}

function Report({ r }: { r: Result }) {
  return (
    <div>
      <Section title="Likely causes" ok={r.causes.length === 1 && r.causes[0].startsWith("DNS looks") ? true : "warn"}>
        <ul className="list-disc pl-5 space-y-1">
          {r.causes.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      </Section>

      <Section title={`MX records for ${r.domain}`} ok={r.mx.length > 0 && r.primaryMxA.length > 0 ? true : false}>
        {r.mx.length === 0 ? (
          <p>None published. Mail to this domain will not be delivered.</p>
        ) : (
          <ul className="font-mono">
            {r.mx.map((m, i) => (
              <li key={i}>
                {m.preference} {m.exchange}
              </li>
            ))}
          </ul>
        )}
        {r.mx[0] ? (
          <p className="mt-1">
            Primary MX A: {r.primaryMxA.length ? r.primaryMxA.join(", ") : <span className="text-red-600">does not resolve</span>}
          </p>
        ) : null}
      </Section>

      <Section title="SPF" ok={r.spf ? (r.spfIssues.length ? "warn" : true) : false}>
        <p className="font-mono break-all">{r.spf ?? "— none —"}</p>
        {r.spfIssues.length ? (
          <ul className="list-disc pl-5 mt-1">
            {r.spfIssues.map((i, k) => (
              <li key={k}>{i}</li>
            ))}
          </ul>
        ) : null}
      </Section>

      <Section title="DMARC" ok={r.dmarc ? (r.dmarcIssues.length ? "warn" : true) : "warn"}>
        <p className="font-mono break-all">{r.dmarc ?? "— none —"}</p>
        {r.dmarcIssues.length ? (
          <ul className="list-disc pl-5 mt-1">
            {r.dmarcIssues.map((i, k) => (
              <li key={k}>{i}</li>
            ))}
          </ul>
        ) : null}
      </Section>

      <Section title={`DKIM (${r.dkimFound}/${r.dkim.length} selectors found)`} ok={r.dkimFound > 0 ? true : "warn"}>
        <ul className="space-y-1">
          {r.dkim.map((d) => (
            <li key={d.selector} className="font-mono text-xs break-all">
              <span className={d.found ? "text-green-600" : "text-muted-foreground"}>
                {d.found ? "✓" : "·"} {d.selector}._domainkey
              </span>
              {d.value ? <div className="pl-4 text-muted-foreground">{d.value.slice(0, 200)}{d.value.length > 200 ? "…" : ""}</div> : null}
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground mt-2">
          DKIM selectors are publisher-specific; absence here doesn't prove DKIM isn't configured for some other selector.
        </p>
      </Section>

      <p className="text-xs text-muted-foreground">Checked {new Date(r.checkedAt).toLocaleString()}</p>
    </div>
  );
}
