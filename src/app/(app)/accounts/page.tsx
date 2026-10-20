import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { PLATFORM_LABEL } from "@/lib/platforms";
import { fmtDateTime } from "@/components/format";
import { disconnectAccount, setAdAccountPage } from "../actions";

export const dynamic = "force-dynamic";

export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ connected?: string; error?: string }> }) {
  const { connected, error } = await searchParams;
  const e = env();
  const [accounts, adAccounts] = await Promise.all([
    db.account.findMany({ orderBy: [{ platform: "asc" }, { name: "asc" }] }),
    db.adAccount.findMany({ orderBy: { name: "asc" } }),
  ]);
  const pages = accounts.filter((a) => a.platform === "FACEBOOK");

  const connectors = [
    { href: "/api/oauth/meta/start", label: "Facebook + Instagram + Meta Ads", ready: e.META_APP_ID && e.META_APP_SECRET },
    { href: "/api/oauth/threads/start", label: "Threads", ready: e.THREADS_APP_ID && e.THREADS_APP_SECRET },
    { href: "/api/oauth/tiktok/start", label: "TikTok (post)", ready: e.TIKTOK_CLIENT_KEY && e.TIKTOK_CLIENT_SECRET },
    { href: "/api/oauth/tiktok-ads/start", label: "TikTok Ads", ready: e.TIKTOK_ADS_APP_ID && e.TIKTOK_ADS_SECRET },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Accounts</h1>
      {connected && <div className="card text-sm">✓ Connected: {connected}</div>}
      {error && <div className="card text-sm text-red-500">Connection failed: {error}</div>}

      <section className="card space-y-3">
        <h2 className="font-semibold">Connect accounts</h2>
        <div className="flex flex-wrap gap-2">
          {connectors.map((c) =>
            c.ready ? (
              <a key={c.href} href={c.href} className="btn">
                {c.label}
              </a>
            ) : (
              <span key={c.href} className="btn btn-ghost opacity-60" title="Fill in the App ID & secret in .env first">
                {c.label} (not set up)
              </span>
            ),
          )}
        </div>
        <p className="text-xs muted">
          Redirect URI to register in the developer portal: <code>{e.APP_URL}/api/oauth/&lt;meta|threads|tiktok|tiktok-ads&gt;/callback</code>
        </p>
      </section>

      <section className="card">
        <h2 className="font-semibold mb-2">Social accounts</h2>
        <table>
          <thead>
            <tr>
              <th>Platform</th>
              <th>Name</th>
              <th>Token expires</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <td>{PLATFORM_LABEL[a.platform]}</td>
                <td>{a.name}</td>
                <td className="muted">{a.tokenExpiresAt ? fmtDateTime(a.tokenExpiresAt) : "never"}</td>
                <td className="text-right">
                  <form action={disconnectAccount}>
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="kind" value="social" />
                    <button className="text-xs underline muted">Disconnect</button>
                  </form>
                </td>
              </tr>
            ))}
            {!accounts.length && (
              <tr>
                <td colSpan={4} className="muted">
                  None yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2 className="font-semibold mb-2">Ad account</h2>
        <table>
          <thead>
            <tr>
              <th>Network</th>
              <th>Name</th>
              <th>Currency</th>
              <th>FB Page for ads</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {adAccounts.map((a) => {
              const meta = a.meta as { pageId?: string };
              return (
                <tr key={a.id}>
                  <td>{a.network === "META" ? "Meta" : "TikTok"}</td>
                  <td>{a.name}</td>
                  <td>{a.currency}</td>
                  <td>
                    {a.network === "META" ? (
                      <form action={setAdAccountPage} className="flex gap-1">
                        <input type="hidden" name="adAccountId" value={a.id} />
                        <select name="pageAccountId" defaultValue={pages.find((p) => p.externalId === meta.pageId)?.id}>
                          {pages.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                        <button className="btn btn-ghost">Save</button>
                      </form>
                    ) : (
                      <span className="muted">–</span>
                    )}
                  </td>
                  <td className="text-right">
                    <form action={disconnectAccount}>
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="kind" value="ad" />
                      <button className="text-xs underline muted">Disconnect</button>
                    </form>
                  </td>
                </tr>
              );
            })}
            {!adAccounts.length && (
              <tr>
                <td colSpan={5} className="muted">
                  None yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
