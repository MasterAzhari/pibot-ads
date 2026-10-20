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
    db.insightDaily.aggregate({ _sum: { spend: true, clicks: true, impressions: true }, where: { date: { gte: weekAgo } } }),
    db.recommendation.count({ where: { status: "PENDING" } }),
    monthSpendUsd(),
    getAiSettings(),
    getSetting<{ summary?: string; at?: string }>("lastAnalysis", {}),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Ringkasan</h1>
      {accounts === 0 && (
        <div className="card">
          Belum ada akaun disambung. <Link href="/accounts" className="underline">Sambung FB, IG, Threads atau TikTok</Link> untuk mula.
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Akaun sosial" value={String(accounts)} sub={`${adAccounts} ad account`} />
        <Stat label="Spend iklan 7 hari" value={fmtMoney(spend._sum.spend ?? 0)} sub={`${spend._sum.clicks ?? 0} klik`} />
        <Stat label="Cadangan AI menunggu" value={String(pending)} sub={<Link href="/ads" className="underline">Semak</Link>} />
        <Stat label="Kos AI bulan ini" value={`USD ${aiSpent.toFixed(2)}`} sub={`had USD ${ai.monthlyBudgetUsd}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card space-y-2">
          <h2 className="font-semibold">Post akan datang</h2>
          {upcoming.length === 0 && <p className="muted text-sm">Tiada post dijadualkan.</p>}
          {upcoming.map((p) => (
            <div key={p.id} className="text-sm flex justify-between gap-3">
              <span className="truncate">{p.caption || "(tiada caption)"}</span>
              <span className="muted whitespace-nowrap">{fmtDateTime(p.scheduledAt)}</span>
            </div>
          ))}
          {failed > 0 && (
            <p className="text-sm text-red-500">
              {failed} post gagal atau separuh berjaya. <Link href="/posts" className="underline">Lihat</Link>
            </p>
          )}
        </section>
        <section className="card space-y-2">
          <h2 className="font-semibold">Analisis AI terakhir</h2>
          {last.summary ? (
            <>
              <p className="text-sm whitespace-pre-line">{last.summary}</p>
              <p className="text-xs muted">{fmtDateTime(last.at ? new Date(last.at) : null)}</p>
            </>
          ) : (
            <p className="muted text-sm">Analisis berjalan setiap pagi selepas ada kempen iklan.</p>
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
