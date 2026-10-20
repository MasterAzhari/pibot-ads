import { db } from "./db";

export type AiProviderId = "anthropic" | "openai" | "llama";

export type AiSettings = {
  /** Provider for light tasks: captions, hashtags, short scripts */
  light: AiProviderId;
  /** Provider for heavy tasks: audience, performance analysis */
  heavy: AiProviderId;
  models: Record<AiProviderId, { light: string; heavy: string }>;
  /** If the main provider fails or has no key, try these in order */
  fallback: AiProviderId[];
  monthlyBudgetUsd: number;
  /** Language for customer-facing content (captions, scripts, ad text). Dashboard text stays English. */
  contentLanguage: string;
  /** USD per 1M tokens, [input, output]. Unlisted models count as 0, so fill in OpenAI/Llama yourself. */
  prices: Record<string, [number, number]>;
};

export const DEFAULT_AI_SETTINGS: AiSettings = {
  light: "anthropic",
  heavy: "anthropic",
  models: {
    anthropic: { light: "claude-haiku-5-5", heavy: "claude-opus-5-5" },
    openai: { light: "", heavy: "" },
    llama: { light: "Llama-4-Scout-17B-16E-Instruct-FP8", heavy: "Llama-4-Maverick-17B-128E-Instruct-FP8" },
  },
  fallback: ["anthropic", "openai", "llama"],
  monthlyBudgetUsd: 10,
  contentLanguage: "Bahasa Melayu (casual Malaysian)",
  prices: {
    "claude-haiku-5-5": [0.1, 0.5],
    "claude-sonnet-5-5": [2, 10],
    "claude-opus-5-5": [4, 20],
  },
};

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.setting.findUnique({ where: { key } });
  return row ? ({ ...fallback, ...(row.value as object) } as T) : fallback;
}

export async function setSetting(key: string, value: unknown) {
  await db.setting.upsert({ where: { key }, create: { key, value: value as any }, update: { value: value as any } });
}

export const getAiSettings = () => getSetting<AiSettings>("ai", DEFAULT_AI_SETTINGS);
