import { createHash } from "node:crypto";
import { db } from "../db";
import { getAiSettings, getSetting, setSetting, type AiProviderId } from "../settings";
import { callProvider, hasKey } from "./providers";

export type Tier = "light" | "heavy";

const CACHE_DAYS = 7;

export async function monthSpendUsd() {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const agg = await db.aiUsage.aggregate({ _sum: { costUsd: true }, where: { createdAt: { gte: start } } });
  return agg._sum.costUsd ?? 0;
}

/**
 * One completion with: monthly budget cap, response cache, and provider fallback.
 * Returns raw text; use askJson for structured answers.
 */
export async function ask(task: string, tier: Tier, system: string, prompt: string, maxTokens = 2000) {
  const settings = await getAiSettings();
  const spent = await monthSpendUsd();
  if (spent >= settings.monthlyBudgetUsd) {
    throw new Error(`This month's AI budget (USD ${settings.monthlyBudgetUsd}) is used up. Raise the limit in Settings.`);
  }

  const order = [settings[tier], ...settings.fallback.filter((p) => p !== settings[tier])] as AiProviderId[];
  const candidates = order.filter((p) => hasKey(p) && settings.models[p]?.[tier]);
  if (!candidates.length) throw new Error("No AI provider has both an API key and a model. Check .env and AI Settings.");

  const errors: string[] = [];
  for (const provider of candidates) {
    const model = settings.models[provider][tier];
    const cacheKey = `aicache:${createHash("sha256").update([provider, model, system, prompt].join("\u0000")).digest("hex")}`;
    const cached = await getSetting<{ text?: string; at?: number }>(cacheKey, {});
    if (cached.text && cached.at && Date.now() - cached.at < CACHE_DAYS * 86400_000) return cached.text;

    try {
      const res = await callProvider(provider, { model, system, prompt, maxTokens, heavy: tier === "heavy" });
      const [pin, pout] = settings.prices[model] ?? [0, 0];
      await db.aiUsage.create({
        data: {
          provider,
          model,
          task,
          inputTokens: res.inputTokens,
          outputTokens: res.outputTokens,
          costUsd: (res.inputTokens * pin + res.outputTokens * pout) / 1_000_000,
        },
      });
      await setSetting(cacheKey, { text: res.text, at: Date.now() });
      return res.text;
    } catch (err) {
      errors.push(`${provider}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw new Error(`All AI providers failed. ${errors.join(" | ")}`);
}

/** Models sometimes wrap JSON in prose or code fences; take the outermost object. */
export function parseJson<T>(text: string): T {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("AI did not return valid JSON");
  return JSON.parse(text.slice(start, end + 1)) as T;
}

export async function askJson<T>(task: string, tier: Tier, system: string, prompt: string, maxTokens = 2000) {
  return parseJson<T>(await ask(task, tier, `${system}\n\nReply with ONE JSON object only, no other text.`, prompt, maxTokens));
}
