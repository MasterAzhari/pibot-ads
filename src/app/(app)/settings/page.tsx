import { monthSpendUsd } from "@/lib/ai";
import { hasKey, PROVIDER_LABEL } from "@/lib/ai/providers";
import { db } from "@/lib/db";
import { getAiSettings, type AiProviderId } from "@/lib/settings";
import { saveAiSettings } from "../actions";

export const dynamic = "force-dynamic";

const PROVIDERS: AiProviderId[] = ["anthropic", "openai", "llama"];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams;
  const [s, spent, byTask] = await Promise.all([
    getAiSettings(),
    monthSpendUsd(),
    db.aiUsage.groupBy({ by: ["provider", "model"], _sum: { costUsd: true, inputTokens: true, outputTokens: true }, _count: true }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Tetapan AI</h1>
      {saved && <div className="card text-sm">✓ Disimpan</div>}
      <form action={saveAiSettings} className="space-y-4">
        <section className="card space-y-3">
          <h2 className="font-semibold">Provider & model</h2>
          <p className="text-xs muted">API key diletak dalam fail .env di server (ANTHROPIC_API_KEY, OPENAI_API_KEY, LLAMA_API_KEY). Sistem sambung terus ke setiap provider.</p>
          <table>
            <thead>
              <tr>
                <th>Provider</th>
                <th>Key</th>
                <th>Model ringan (caption, skrip)</th>
                <th>Model berat (audience, analisis)</th>
                <th>Fallback</th>
              </tr>
            </thead>
            <tbody>
              {PROVIDERS.map((p) => (
                <tr key={p}>
                  <td>{PROVIDER_LABEL[p]}</td>
                  <td>{hasKey(p) ? "✓" : <span className="muted">tiada</span>}</td>
                  <td>
                    <input name={`${p}_light`} defaultValue={s.models[p]?.light} />
                  </td>
                  <td>
                    <input name={`${p}_heavy`} defaultValue={s.models[p]?.heavy} />
                  </td>
                  <td>
                    <input type="checkbox" className="!w-auto" name={`fallback_${p}`} defaultChecked={s.fallback.includes(p)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label>Provider utama: tugas ringan</label>
              <select name="light" defaultValue={s.light}>
                {PROVIDERS.map((p) => (
                  <option key={p} value={p}>
                    {PROVIDER_LABEL[p]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Provider utama: tugas berat</label>
              <select name="heavy" defaultValue={s.heavy}>
                {PROVIDERS.map((p) => (
                  <option key={p} value={p}>
                    {PROVIDER_LABEL[p]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Had bajet AI sebulan (USD)</label>
              <input type="number" step="0.5" min={0} name="monthlyBudgetUsd" defaultValue={s.monthlyBudgetUsd} />
            </div>
          </div>
        </section>

        <section className="card space-y-2">
          <h2 className="font-semibold">Harga model (USD per 1 juta token)</h2>
          <p className="text-xs muted">Satu baris setiap model: nama, harga input, harga output. Isi harga OpenAI/Llama sendiri supaya had bajet dikira dengan betul.</p>
          <textarea
            name="prices"
            rows={6}
            defaultValue={Object.entries(s.prices)
              .map(([m, [i, o]]) => `${m} ${i} ${o}`)
              .join("\n")}
          />
        </section>
        <button className="btn">Simpan</button>
      </form>

      <section className="card">
        <h2 className="font-semibold mb-2">Penggunaan (bulan ini USD {spent.toFixed(4)})</h2>
        <table>
          <thead>
            <tr>
              <th>Provider</th>
              <th>Model</th>
              <th>Panggilan</th>
              <th>Token in / out</th>
              <th>Kos (semua masa)</th>
            </tr>
          </thead>
          <tbody>
            {byTask.map((r) => (
              <tr key={`${r.provider}-${r.model}`}>
                <td>{r.provider}</td>
                <td>{r.model}</td>
                <td>{r._count}</td>
                <td>
                  {r._sum.inputTokens} / {r._sum.outputTokens}
                </td>
                <td>USD {(r._sum.costUsd ?? 0).toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
