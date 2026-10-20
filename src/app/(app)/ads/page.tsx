import Link from "next/link";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { fmtDateTime, fmtMoney, fmtNum } from "@/components/format";
import { AdsToolbar, CampaignControls, RecommendationButtons } from "./AdsClient";

export const dynamic = "force-dynamic";

export default async function AdsPage() {
  const since = new Date(Date.now() - 7 * 86400_000);
  const [campaigns, recs, last] = await Promise.all([
    db.campaign.findMany({
      include: { adAccount: true, insights: { where: { date: { gte: since } } } },
      orderBy: [{ status: "asc" }, { name: "asc" }],
    }),
    db.recommendation.findMany({ include: { campaign: true }, orderBy: { createdAt: "desc" }, take: 30 }),
    getSetting<{ summary?: string; at?: string }>("lastAnalysis", {}),
  ]);
  const pending = recs.filter((r) => r.status === "PENDING");
  const history = recs.filter((r) => r.status !== "PENDING").slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Ads</h1>
        <div className="ml-auto flex gap-2">
          <AdsToolbar />
          <Link href="/ads/new" className="btn">
            + New campaign
          </Link>
        </div>
      </div>

      <section className="card space-y-3">
        <h2 className="font-semibold">AI suggestions</h2>
        {last.summary && (
          <p className="text-sm whitespace-pre-line">
            {last.summary} <span className="muted text-xs">({fmtDateTime(last.at ? new Date(last.at) : null)})</span>
          </p>
        )}
        {!pending.length && <p className="text-sm muted">No pending suggestions.</p>}
        {pending.map((r) => (
          <div key={r.id} className="border rounded-lg p-3 text-sm space-y-1" style={{ borderColor: "var(--border)" }}>
            <div className="flex flex-wrap gap-2 items-center">
              <span className="badge">{r.kind}</span>
              <strong>{r.title}</strong>
              {r.campaign && <span className="muted">· {r.campaign.name}</span>}
            </div>
            <p>{r.reason}</p>
            {r.kind === "SET_BUDGET" && <p className="text-xs">New budget: {String((r.action as { dailyBudget?: number }).dailyBudget)}/day</p>}
            <RecommendationButtons id={r.id} actionable={r.kind !== "INFO"} />
          </div>
        ))}
        {history.length > 0 && (
          <details className="text-xs">
            <summary className="cursor-pointer muted">History</summary>
            <ul className="mt-2 space-y-1">
              {history.map((r) => (
                <li key={r.id}>
                  {fmtDateTime(r.decidedAt)} · {r.status} · {r.title} {r.result && r.result !== "OK" ? `(${r.result})` : ""}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="card overflow-x-auto">
        <h2 className="font-semibold mb-2">Campaigns (7 days)</h2>
        <table>
          <thead>
            <tr>
              <th>Campaign</th>
              <th>Status</th>
              <th>Spend</th>
              <th>Impression</th>
              <th>Clicks</th>
              <th>CTR</th>
              <th>CPC</th>
              <th>Video views</th>
              <th>Budget/day</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => {
              const s = c.insights.reduce(
                (a, i) => ({ spend: a.spend + i.spend, imp: a.imp + i.impressions, clicks: a.clicks + i.clicks, views: a.views + i.videoViews }),
                { spend: 0, imp: 0, clicks: 0, views: 0 },
              );
              const cur = c.adAccount.currency;
              return (
                <tr key={c.id}>
                  <td>
                    {c.name}
                    <div className="text-xs muted">
                      {c.adAccount.network === "META" ? "Meta" : "TikTok"} · {c.adAccount.name}
                    </div>
                  </td>
                  <td>
                    <span className="badge">{c.status}</span>
                  </td>
                  <td>{fmtMoney(s.spend, cur)}</td>
                  <td>{fmtNum(s.imp)}</td>
                  <td>{fmtNum(s.clicks)}</td>
                  <td>{s.imp ? `${((s.clicks / s.imp) * 100).toFixed(2)}%` : "–"}</td>
                  <td>{s.clicks ? fmtMoney(s.spend / s.clicks, cur) : "–"}</td>
                  <td>{fmtNum(s.views)}</td>
                  <td>
                    <CampaignControls id={c.id} active={c.status === "ACTIVE"} budget={c.dailyBudget} currency={cur} />
                  </td>
                </tr>
              );
            })}
            {!campaigns.length && (
              <tr>
                <td colSpan={9} className="muted">
                  No campaigns yet. Press "Sync" after connecting an ad account, or create a new campaign.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
