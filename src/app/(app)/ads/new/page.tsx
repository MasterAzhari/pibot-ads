import Link from "next/link";
import { db } from "@/lib/db";
import { NewCampaignForm } from "./NewCampaignForm";

export const dynamic = "force-dynamic";

export default async function NewCampaignPage() {
  const adAccounts = await db.adAccount.findMany({ orderBy: { name: "asc" } });
  if (!adAccounts.length) {
    return (
      <div className="card">
        Connect Meta Ads or TikTok Ads first on the <Link href="/accounts" className="underline">Accounts page</Link>.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">New campaign</h1>
      <p className="text-sm muted">Campaigns are created paused. No money is spent until you press "Turn on" on the Ads page.</p>
      <NewCampaignForm
        adAccounts={adAccounts.map((a) => ({ id: a.id, name: a.name, network: a.network, currency: a.currency }))}
      />
    </div>
  );
}
