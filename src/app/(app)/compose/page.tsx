import Link from "next/link";
import { db } from "@/lib/db";
import { PLATFORM_LABEL } from "@/lib/platforms";
import { ComposeForm } from "./ComposeForm";

export const dynamic = "force-dynamic";

export default async function ComposePage() {
  const accounts = await db.account.findMany({ orderBy: [{ platform: "asc" }, { name: "asc" }] });
  if (!accounts.length) {
    return (
      <div className="card">
        Sambung akaun dulu di <Link href="/accounts" className="underline">halaman Akaun</Link>.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Buat post</h1>
      <ComposeForm accounts={accounts.map((a) => ({ id: a.id, name: a.name, platform: a.platform, label: PLATFORM_LABEL[a.platform] }))} />
    </div>
  );
}
