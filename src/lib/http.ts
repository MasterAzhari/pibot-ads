export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: unknown,
  ) {
    super(message);
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

export function withQuery(url: string, query?: Query) {
  if (!query) return url;
  const u = new URL(url);
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
  return u.toString();
}

/** fetch + JSON + readable errors from Meta/TikTok style error bodies */
export async function requestJson<T = any>(
  url: string,
  init: RequestInit & { query?: Query; json?: unknown; form?: Query } = {},
): Promise<T> {
  const { query, json, form, headers, ...rest } = init;
  const h = new Headers(headers);
  let body = rest.body;
  if (json !== undefined) {
    h.set("Content-Type", "application/json");
    body = JSON.stringify(json);
  } else if (form) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(form)) if (v !== undefined && v !== null) params.set(k, String(v));
    body = params;
  }
  const target = withQuery(url, query);
  let res: Response;
  try {
    res = await fetch(target, { ...rest, headers: h, body });
  } catch (err) {
    throw new Error(`Tak dapat sambung ke ${new URL(target).host}: ${err instanceof Error ? err.message : err}`);
  }
  const text = await res.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg = data?.error?.message ?? data?.error?.error_user_msg ?? data?.message ?? text.slice(0, 300);
    throw new ApiError(`${res.status}: ${msg}`, res.status, data);
  }
  return data as T;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Poll until check() returns a value, or give up. */
export async function poll<T>(check: () => Promise<T | undefined>, { intervalMs = 5000, timeoutMs = 10 * 60_000 } = {}) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const result = await check();
    if (result !== undefined) return result;
    await sleep(intervalMs);
  }
  throw new Error("Masa menunggu tamat (timeout)");
}
