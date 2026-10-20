import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { env } from "../env";
import type { AiProviderId } from "../settings";

export type CompletionRequest = { model: string; system: string; prompt: string; maxTokens: number; heavy: boolean };
export type CompletionResult = { text: string; inputTokens: number; outputTokens: number };

export const PROVIDER_LABEL: Record<AiProviderId, string> = {
  anthropic: "Claude (Anthropic)",
  openai: "OpenAI",
  llama: "Meta Llama",
};

let anthropic: Anthropic | undefined;
let openai: OpenAI | undefined;
let llama: OpenAI | undefined;

export function hasKey(id: AiProviderId) {
  const e = env();
  return Boolean({ anthropic: e.ANTHROPIC_API_KEY, openai: e.OPENAI_API_KEY, llama: e.LLAMA_API_KEY }[id]);
}

async function callAnthropic(req: CompletionRequest): Promise<CompletionResult> {
  anthropic ??= new Anthropic({ apiKey: env().ANTHROPIC_API_KEY });
  const res = await anthropic.messages.create({
    model: req.model,
    max_tokens: req.maxTokens,
    system: req.system,
    messages: [{ role: "user", content: req.prompt }],
    // Light tasks don't need deep thinking; keeping effort low keeps them cheap.
    output_config: { effort: req.heavy ? "medium" : "low" },
  });
  if (res.stop_reason === "refusal") throw new Error("Claude menolak permintaan ini");
  const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  return { text, inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens };
}

// OpenAI and Meta's Llama API share the chat-completions shape; Llama is called directly at api.llama.com.
async function callOpenAiCompatible(client: OpenAI, req: CompletionRequest): Promise<CompletionResult> {
  const res = await client.chat.completions.create({
    model: req.model,
    max_completion_tokens: req.maxTokens,
    messages: [
      { role: "system", content: req.system },
      { role: "user", content: req.prompt },
    ],
  });
  return {
    text: res.choices[0]?.message?.content ?? "",
    inputTokens: res.usage?.prompt_tokens ?? 0,
    outputTokens: res.usage?.completion_tokens ?? 0,
  };
}

export function callProvider(id: AiProviderId, req: CompletionRequest) {
  switch (id) {
    case "anthropic":
      return callAnthropic(req);
    case "openai":
      openai ??= new OpenAI({ apiKey: env().OPENAI_API_KEY });
      return callOpenAiCompatible(openai, req);
    case "llama":
      llama ??= new OpenAI({ apiKey: env().LLAMA_API_KEY, baseURL: env().LLAMA_BASE_URL });
      return callOpenAiCompatible(llama, req);
  }
}
