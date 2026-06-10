import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const DOH = "https://dns.google/resolve";

type DnsAnswer = { name: string; type: number; TTL: number; data: string };
type DnsResponse = { Status: number; Answer?: DnsAnswer[] };

async function query(name: string, type: string): Promise<DnsAnswer[]> {
  try {
    const res = await fetch(`${DOH}?name=${encodeURIComponent(name)}&type=${type}`, {
      headers: { accept: "application/dns-json" },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as DnsResponse;
    return data.Answer ?? [];
  } catch {
    return [];
  }
}

function stripQuotes(s: string): string {
  return s.replace(/^"|"$/g, "").replace(/"\s*"/g, "");
}

export const diagnoseEmailDomain = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      email: z.string().trim().email().max(200),
      dkimSelectors: z.array(z.string().trim().min(1).max(63)).max(10).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const domain = data.email.split("@")[1]!.toLowerCase();
    const selectors = data.dkimSelectors?.length
      ? data.dkimSelectors
      : ["google", "default", "selector1", "selector2", "k1", "mail", "dkim"];

    const [mx, txt, dmarcTxt, aRoot, mxA] = await Promise.all([
      query(domain, "MX"),
      query(domain, "TXT"),
      query(`_dmarc.${domain}`, "TXT"),
      query(domain, "A"),
      Promise.resolve([] as DnsAnswer[]),
    ]);

    // MX
    const mxRecords = mx
      .map((r) => {
        const m = r.data.match(/^(\d+)\s+(.+?)\.?$/);
        return m ? { preference: Number(m[1]), exchange: m[2].toLowerCase() } : null;
      })
      .filter((v): v is { preference: number; exchange: string } => v !== null)
      .sort((a, b) => a.preference - b.preference);

    // Resolve A records for primary MX to check reachability
    let primaryMxA: string[] = [];
    if (mxRecords[0]) {
      const ans = await query(mxRecords[0].exchange, "A");
      primaryMxA = ans.map((a) => a.data);
    }

    // SPF
    const txtJoined = txt.map((r) => stripQuotes(r.data));
    const spfRecords = txtJoined.filter((t) => /^v=spf1\b/i.test(t));
    const spf = spfRecords[0] ?? null;
    const spfIssues: string[] = [];
    if (!spf) spfIssues.push("No SPF (v=spf1) record found on the domain.");
    else {
      if (spfRecords.length > 1) spfIssues.push("Multiple SPF records found — RFC violation, providers will ignore SPF.");
      if (!/[~\-?+]all\b/i.test(spf)) spfIssues.push("SPF has no 'all' qualifier — providers may treat as neutral.");
      const lookups = (spf.match(/\b(include|a|mx|ptr|exists|redirect)[:=]/gi) ?? []).length;
      if (lookups > 10) spfIssues.push(`SPF has ${lookups} DNS-lookup mechanisms (>10 = permerror).`);
    }

    // DMARC
    const dmarcJoined = dmarcTxt.map((r) => stripQuotes(r.data));
    const dmarc = dmarcJoined.find((t) => /^v=DMARC1\b/i.test(t)) ?? null;
    const dmarcIssues: string[] = [];
    if (!dmarc) dmarcIssues.push("No DMARC record at _dmarc." + domain + ".");
    else {
      const p = dmarc.match(/\bp=(none|quarantine|reject)/i)?.[1]?.toLowerCase();
      if (!p) dmarcIssues.push("DMARC missing required 'p=' policy tag.");
      else if (p !== "none") dmarcIssues.push(`DMARC policy is p=${p} — unaligned mail may be quarantined/rejected.`);
    }

    // DKIM (best-effort — selectors are publisher-specific)
    const dkimResults = await Promise.all(
      selectors.map(async (sel) => {
        const ans = await query(`${sel}._domainkey.${domain}`, "TXT");
        const value = ans.map((a) => stripQuotes(a.data)).find((t) => /(^|;)\s*(v=DKIM1|k=|p=)/i.test(t));
        return { selector: sel, found: Boolean(value), value: value ?? null };
      }),
    );
    const dkimFound = dkimResults.filter((d) => d.found);

    // Top-level diagnosis for verification email non-delivery
    const causes: string[] = [];
    if (mxRecords.length === 0) {
      causes.push(
        "The domain has NO MX records — no mail server is publicly advertised for " +
          domain +
          ". Any email sent to this address will bounce or be dropped. Verification emails cannot be delivered until valid MX records are published.",
      );
    } else if (primaryMxA.length === 0) {
      causes.push(
        `Primary MX ${mxRecords[0].exchange} has no A record — the mail server hostname does not resolve, so delivery will fail.`,
      );
    }
    if (!spf) {
      causes.push(
        "No SPF record — inbound spam filters on this mailbox may silently drop external mail (including Gmail's verification).",
      );
    }
    if (dmarc && /p=(quarantine|reject)/i.test(dmarc)) {
      causes.push(
        "DMARC policy is enforcing — if the receiving server applies inbound DMARC to itself, legitimate verification mail can land in quarantine/junk.",
      );
    }
    if (dkimFound.length === 0) {
      causes.push(
        "No DKIM record found for common selectors — this only affects OUTBOUND mail from " +
          domain +
          ", not inbound verification delivery, but indicates the domain may not be properly configured for email at all.",
      );
    }
    if (causes.length === 0) {
      causes.push(
        "DNS looks plausible. If the Gmail verification still doesn't arrive, check the actual inbox/forwarder for " +
          data.email +
          ": confirm the mailbox exists, isn't full, and isn't filtering Gmail's 'noreply@google.com' / 'gmail-noreply@google.com' messages into spam or a server-side quarantine.",
      );
    }

    return {
      domain,
      email: data.email,
      mx: mxRecords,
      primaryMxA,
      spf,
      spfAll: spfRecords,
      spfIssues,
      dmarc,
      dmarcIssues,
      dkim: dkimResults,
      dkimFound: dkimFound.length,
      aRoot: aRoot.map((a) => a.data),
      causes,
      checkedAt: new Date().toISOString(),
    };
  });
