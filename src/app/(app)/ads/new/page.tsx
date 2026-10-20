import Link from "next/link";
import { db } from "@/lib/db";
import { NewCampaignForm } from "./NewCampaignForm";

export const dynamic = "force-dynamic";

export default async function NewCampaignPage() {
  const adAccounts = await db.adAccount.findMany({ orderBy: { name: "asc" } });
  if (!adAccounts.length) {
    return (
      <div className="card">
        Sambung Meta Ads atau TikTok Ads dulu di <Link href="/accounts" className="underline">halaman Akaun</Link>.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Kempen baru</h1>
      <p className="text-sm muted">Kempen dibuat dalam keadaan PAUSE. Tiada duit keluar sampai kau tekan "Hidupkan" di halaman Iklan.</p>
      <NewCampaignForm
        adAccounts={adAccounts.map((a) => ({ id: a.id, name: a.name, network: a.network, currency: a.currency }))}
      />
    </div>
  );
}
