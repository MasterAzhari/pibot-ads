import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  APP_URL: z.string().url().default("http://localhost:3000"),
  /** 32+ chars, used for session cookies and token encryption */
  APP_SECRET: z.string().min(32),
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string().min(8),
  UPLOAD_DIR: z.string().default("./uploads"),

  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  META_GRAPH_VERSION: z.string().default("v24.0"),
  THREADS_APP_ID: z.string().optional(),
  THREADS_APP_SECRET: z.string().optional(),

  TIKTOK_CLIENT_KEY: z.string().optional(),
  TIKTOK_CLIENT_SECRET: z.string().optional(),
  /** Unaudited TikTok apps can only post SELF_ONLY */
  TIKTOK_PRIVACY_LEVEL: z.string().default("SELF_ONLY"),
  TIKTOK_ADS_APP_ID: z.string().optional(),
  TIKTOK_ADS_SECRET: z.string().optional(),

  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  LLAMA_API_KEY: z.string().optional(),
  LLAMA_BASE_URL: z.string().default("https://api.llama.com/compat/v1/"),
});

let cached: z.infer<typeof schema> | undefined;

export function env() {
  cached ??= schema.parse(process.env);
  return cached;
}

export function requireEnv<K extends keyof ReturnType<typeof env>>(key: K): NonNullable<ReturnType<typeof env>[K]> {
  const value = env()[key];
  if (value === undefined || value === "") throw new Error(`${String(key)} is not set in .env`);
  return value as NonNullable<ReturnType<typeof env>[K]>;
}
