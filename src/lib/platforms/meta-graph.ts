import { env, requireEnv } from "../env";
import { requestJson } from "../http";

export const graphUrl = (path: string) => `https://graph.facebook.com/${env().META_GRAPH_VERSION}/${path.replace(/^\//, "")}`;

export const graph = {
  get: <T = any>(path: string, token: string, query: Record<string, any> = {}) =>
    requestJson<T>(graphUrl(path), { query: { ...query, access_token: token } }),
  post: <T = any>(path: string, token: string, form: Record<string, any> = {}) =>
    requestJson<T>(graphUrl(path), {
      method: "POST",
      form: Object.fromEntries(
        Object.entries({ ...form, access_token: token }).map(([k, v]) => [k, typeof v === "object" && v !== null ? JSON.stringify(v) : v]),
      ),
    }),
  delete: <T = any>(path: string, token: string) => requestJson<T>(graphUrl(path), { method: "DELETE", query: { access_token: token } }),
};

/** Permissions for Pages, Instagram publishing and the Marketing API in one login. */
export const META_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "instagram_basic",
  "instagram_content_publish",
  "business_management",
  "ads_management",
  "ads_read",
].join(",");

export function metaAuthorizeUrl(state: string) {
  const u = new URL(`https://www.facebook.com/${env().META_GRAPH_VERSION}/dialog/oauth`);
  u.searchParams.set("client_id", requireEnv("META_APP_ID"));
  u.searchParams.set("redirect_uri", `${env().APP_URL}/api/oauth/meta/callback`);
  u.searchParams.set("state", state);
  u.searchParams.set("scope", META_SCOPES);
  return u.toString();
}

/** code -> long-lived (~60 day) user token */
export async function metaExchangeCode(code: string) {
  const short = await requestJson<{ access_token: string }>(graphUrl("oauth/access_token"), {
    query: {
      client_id: requireEnv("META_APP_ID"),
      client_secret: requireEnv("META_APP_SECRET"),
      redirect_uri: `${env().APP_URL}/api/oauth/meta/callback`,
      code,
    },
  });
  const long = await requestJson<{ access_token: string; expires_in?: number }>(graphUrl("oauth/access_token"), {
    query: {
      grant_type: "fb_exchange_token",
      client_id: requireEnv("META_APP_ID"),
      client_secret: requireEnv("META_APP_SECRET"),
      fb_exchange_token: short.access_token,
    },
  });
  return long;
}
