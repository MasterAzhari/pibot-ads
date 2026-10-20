import { decrypt } from "../crypto";
import { env, requireEnv } from "../env";
import { poll, requestJson } from "../http";
import { isImage, isVideo, publicMediaUrl } from "../media";
import type { Publisher } from "./types";

const BASE = "https://graph.threads.net/v1.0";

const get = (path: string, token: string, query: Record<string, any> = {}) =>
  requestJson(`${BASE}/${path}`, { query: { ...query, access_token: token } });
const post = (path: string, token: string, form: Record<string, any> = {}) =>
  requestJson(`${BASE}/${path}`, { method: "POST", form: { ...form, access_token: token } });

export function threadsAuthorizeUrl(state: string) {
  const u = new URL("https://threads.net/oauth/authorize");
  u.searchParams.set("client_id", requireEnv("THREADS_APP_ID"));
  u.searchParams.set("redirect_uri", `${env().APP_URL}/api/oauth/threads/callback`);
  u.searchParams.set("scope", "threads_basic,threads_content_publish,threads_manage_replies");
  u.searchParams.set("response_type", "code");
  u.searchParams.set("state", state);
  return u.toString();
}

export async function threadsExchangeCode(code: string) {
  const short = await requestJson<{ access_token: string; user_id: string }>("https://graph.threads.net/oauth/access_token", {
    method: "POST",
    form: {
      client_id: requireEnv("THREADS_APP_ID"),
      client_secret: requireEnv("THREADS_APP_SECRET"),
      grant_type: "authorization_code",
      redirect_uri: `${env().APP_URL}/api/oauth/threads/callback`,
      code,
    },
  });
  const long = await requestJson<{ access_token: string; expires_in: number }>("https://graph.threads.net/access_token", {
    query: { grant_type: "th_exchange_token", client_secret: requireEnv("THREADS_APP_SECRET"), access_token: short.access_token },
  });
  const me = await get("me", long.access_token, { fields: "id,username,threads_profile_picture_url" });
  return { ...long, me };
}

/** Long-lived Threads tokens last 60 days; refresh before then. */
export async function threadsRefresh(token: string) {
  return requestJson<{ access_token: string; expires_in: number }>("https://graph.threads.net/refresh_access_token", {
    query: { grant_type: "th_refresh_token", access_token: token },
  });
}

export const threads: Publisher = {
  async publish(account, { caption, media }) {
    const token = decrypt(account.accessToken);
    const userId = account.externalId;
    const params: Record<string, string> = { text: caption, media_type: "TEXT" };
    if (media && isVideo(media)) Object.assign(params, { media_type: "VIDEO", video_url: publicMediaUrl(media) });
    else if (media && isImage(media)) Object.assign(params, { media_type: "IMAGE", image_url: publicMediaUrl(media) });

    const container = await post(`${userId}/threads`, token, params);
    if (params.media_type !== "TEXT") {
      await poll(async () => {
        const { status, error_message } = await get(container.id, token, { fields: "status,error_message" });
        if (status === "ERROR" || status === "EXPIRED") throw new Error(`Threads gagal proses media: ${error_message ?? status}`);
        return status === "FINISHED" ? true : undefined;
      });
    }
    const { id } = await post(`${userId}/threads_publish`, token, { creation_id: container.id });
    const { permalink } = await get(id, token, { fields: "permalink" });
    return { externalId: id, permalink };
  },
  async remove(account, externalId) {
    await requestJson(`${BASE}/${externalId}`, { method: "DELETE", query: { access_token: decrypt(account.accessToken) } });
  },
};
