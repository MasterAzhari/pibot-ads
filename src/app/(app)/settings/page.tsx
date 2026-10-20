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
      <h1 className="text-2xl font-semibold">AI settings</h1>
      {saved && <div className="card text-sm">✓ Saved</div>}
      <form action={saveAiSettings} className="space-y-4">
        <section className="card space-y-3">
          <h2 className="font-semibold">Providers & models</h2>
          <p className="text-xs muted">API keys go in the server .env file (ANTHROPIC_API_KEY, OPENAI_API_KEY, LLAMA_API_KEY). The system calls each provider directly.</p>
          <table>
            <thead>
              <tr>
                <th>Provider</th>
                <th>Key</th>
                <th>Light model (captions, scripts)</th>
                <th>Heavy model (audience, analysis)</th>
                <th>Fallback</th>
              </tr>
            </thead>
            <tbody>
              {PROVIDERS.map((p) => (
                <tr key={p}>
                  <td>{PROVIDER_LABEL[p]}</td>
                  <td>{hasKey(p) ? "✓" : <span className="muted">missing</span>}</td>
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
              <label>Main provider: light tasks</label>
              <select name="light" defaultValue={s.light}>
                {PROVIDERS.map((p) => (
                  <option key={p} value={p}>
                    {PROVIDER_LABEL[p]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Main provider: heavy tasks</label>
              <select name="heavy" defaultValue={s.heavy}>
                {PROVIDERS.map((p) => (
                  <option key={p} value={p}>
                    {PROVIDER_LABEL[p]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Monthly AI budget (USD)</label>
              <input type="number" step="0.5" min={0} name="monthlyBudgetUsd" defaultValue={s.monthlyBudgetUsd} />
            </div>
          </div>
          <div>
            <label>Language for captions, scripts and ad text</label>
            <input name="contentLanguage" defaultValue={s.contentLanguage} placeholder="e.g. English, Bahasa Melayu, Manglish" />
          </div>
        </section>

        <section className="card space-y-2">
          <h2 className="font-semibold">Model prices (USD per 1M tokens)</h2>
          <p className="text-xs muted">One line per model: name, input price, output price. Fill in OpenAI/Llama prices yourself so the budget limit is counted correctly.</p>
          <textarea
            name="prices"
            rows={6}
            defaultValue={Object.entries(s.prices)
              .map(([m, [i, o]]) => `${m} ${i} ${o}`)
              .join("\n")}
          />
        </section>
        <button className="btn">Save</button>
      </form>

      <section className="card">
        <h2 className="font-semibold mb-2">Usage (this month USD {spent.toFixed(4)})</h2>
        <table>
          <thead>
            <tr>
              <th>Provider</th>
              <th>Model</th>
              <th>Calls</th>
              <th>Token in / out</th>
              <th>Cost (all time)</th>
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
