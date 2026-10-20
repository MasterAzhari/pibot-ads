import Link from "next/link";
import { db } from "@/lib/db";
import { monthSpendUsd } from "@/lib/ai";
import { getAiSettings, getSetting } from "@/lib/settings";
import { fmtDateTime, fmtMoney } from "@/components/format";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const weekAgo = new Date(Date.now() - 7 * 86400_000);
  const [accounts, adAccounts, upcoming, failed, spend, pending, aiSpent, ai, last] = await Promise.all([
    db.account.count(),
    db.adAccount.count(),
    db.post.findMany({ where: { status: "SCHEDULED" }, orderBy: { scheduledAt: "asc" }, take: 5 }),
    db.post.count({ where: { status: { in: ["FAILED", "PARTIAL"] } } }),
    db.insightDaily.findMany({
      where: { date: { gte: weekAgo } },
      select: { spend: true, clicks: true, campaign: { select: { adAccount: { select: { currency: true } } } } },
    }),
    db.recommendation.count({ where: { status: "PENDING" } }),
    monthSpendUsd(),
    getAiSettings(),
    getSetting<{ summary?: string; at?: string }>("lastAnalysis", {}),
  ]);

  // Ad accounts can be in different currencies, so totals are kept per currency.
  const spendByCurrency = new Map<string, number>();
  for (const i of spend) {
    const cur = i.campaign.adAccount.currency;
    spendByCurrency.set(cur, (spendByCurrency.get(cur) ?? 0) + i.spend);
  }
  const spendText = spendByCurrency.size ? [...spendByCurrency].map(([cur, n]) => fmtMoney(n, cur)).join(" · ") : fmtMoney(0);
  const clicks = spend.reduce((s, i) => s + i.clicks, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Overview</h1>
      {accounts === 0 && (
        <div className="card">
          No accounts connected yet. <Link href="/accounts" className="underline">Connect FB, IG, Threads or TikTok</Link> to get started.
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Social accounts" value={String(accounts)} sub={`${adAccounts} ad account`} />
        <Stat label="Ad spend (7 days)" value={spendText} sub={`${clicks} clicks`} />
        <Stat label="AI suggestions pending" value={String(pending)} sub={<Link href="/ads" className="underline">Review</Link>} />
        <Stat label="AI cost this month" value={`USD ${aiSpent.toFixed(2)}`} sub={`limit USD ${ai.monthlyBudgetUsd}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card space-y-2">
          <h2 className="font-semibold">Upcoming posts</h2>
          {upcoming.length === 0 && <p className="muted text-sm">No scheduled posts.</p>}
          {upcoming.map((p) => (
            <div key={p.id} className="text-sm flex justify-between gap-3">
              <span className="truncate">{p.caption || "(no caption)"}</span>
              <span className="muted whitespace-nowrap">{fmtDateTime(p.scheduledAt)}</span>
            </div>
          ))}
          {failed > 0 && (
            <p className="text-sm text-red-500">
              {failed} post(s) failed or partly failed. <Link href="/posts" className="underline">View</Link>
            </p>
          )}
        </section>
        <section className="card space-y-2">
          <h2 className="font-semibold">Latest AI analysis</h2>
          {last.summary ? (
            <>
              <p className="text-sm whitespace-pre-line">{last.summary}</p>
              <p className="text-xs muted">{fmtDateTime(last.at ? new Date(last.at) : null)}</p>
            </>
          ) : (
            <p className="muted text-sm">Analysis runs every morning once you have ad campaigns.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: React.ReactNode }) {
  return (
    <div className="card">
      <div className="text-xs muted">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      <div className="text-xs muted mt-1">{sub}</div>
    </div>
  );
}
