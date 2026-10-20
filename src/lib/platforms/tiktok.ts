import type { Account } from "@prisma/client";
import { db } from "../db";
import { decrypt, encrypt } from "../crypto";
import { env, requireEnv } from "../env";
import { poll, requestJson } from "../http";
import { isImage, isVideo, publicMediaUrl, readMedia } from "../media";
import type { Publisher } from "./types";

const API = "https://open.tiktokapis.com/v2";

export function tiktokAuthorizeUrl(state: string) {
  const u = new URL("https://www.tiktok.com/v2/auth/authorize/");
  u.searchParams.set("client_key", requireEnv("TIKTOK_CLIENT_KEY"));
  u.searchParams.set("scope", "user.info.basic,video.publish,video.upload");
  u.searchParams.set("response_type", "code");
  u.searchParams.set("redirect_uri", `${env().APP_URL}/api/oauth/tiktok/callback`);
  u.searchParams.set("state", state);
  return u.toString();
}

type TokenResponse = { access_token: string; refresh_token: string; expires_in: number; open_id: string };

export async function tiktokToken(form: Record<string, string>) {
  const data = await requestJson<TokenResponse & { error?: string; error_description?: string }>(`${API}/oauth/token/`, {
    method: "POST",
    form: { client_key: requireEnv("TIKTOK_CLIENT_KEY"), client_secret: requireEnv("TIKTOK_CLIENT_SECRET"), ...form },
  });
  if (data.error) throw new Error(`TikTok: ${data.error_description ?? data.error}`);
  return data;
}

export const tiktokExchangeCode = (code: string) =>
  tiktokToken({ code, grant_type: "authorization_code", redirect_uri: `${env().APP_URL}/api/oauth/tiktok/callback` });

export async function tiktokUser(token: string) {
  const res = await requestJson(`${API}/user/info/`, {
    headers: { Authorization: `Bearer ${token}` },
    query: { fields: "open_id,display_name,avatar_url" },
  });
  return res.data.user as { open_id: string; display_name: string; avatar_url?: string };
}

/** Access tokens live 24h; refresh on demand and store the new pair. */
async function freshToken(account: Account) {
  if (account.tokenExpiresAt && account.tokenExpiresAt.getTime() > Date.now() + 5 * 60_000) return decrypt(account.accessToken);
  if (!account.refreshToken) throw new Error("TikTok token expired, please reconnect the account");
  const t = await tiktokToken({ grant_type: "refresh_token", refresh_token: decrypt(account.refreshToken) });
  await db.account.update({
    where: { id: account.id },
    data: {
      accessToken: encrypt(t.access_token),
      refreshToken: encrypt(t.refresh_token),
      tokenExpiresAt: new Date(Date.now() + t.expires_in * 1000),
    },
  });
  return t.access_token;
}

async function tt(token: string, path: string, json: unknown) {
  const res = await requestJson(`${API}/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    json,
  });
  if (res.error?.code && res.error.code !== "ok") throw new Error(`TikTok: ${res.error.message || res.error.code}`);
  return res.data;
}

// TikTok rules: chunks 5–64MB, last chunk may be bigger; files under 64MB go in one chunk.
function chunking(size: number) {
  const MAX = 64 * 1024 * 1024;
  if (size <= MAX) return { chunkSize: size, count: 1 };
  const chunkSize = 10 * 1024 * 1024;
  return { chunkSize, count: Math.floor(size / chunkSize) };
}

export const tiktok: Publisher = {
  async publish(account, { caption, media }) {
    if (!media) throw new Error("TikTok needs a video or image");
    const token = await freshToken(account);
    const post_info = {
      title: caption.slice(0, 2200),
      privacy_level: env().TIKTOK_PRIVACY_LEVEL,
      disable_comment: false,
    };

    let publishId: string;
    if (isVideo(media)) {
      // FILE_UPLOAD avoids needing domain verification that PULL_FROM_URL requires.
      const { buffer, size } = await readMedia(media);
      const { chunkSize, count } = chunking(size);
      const init = await tt(token, "post/publish/video/init/", {
        post_info,
        source_info: { source: "FILE_UPLOAD", video_size: size, chunk_size: chunkSize, total_chunk_count: count },
      });
      publishId = init.publish_id;
      for (let i = 0; i < count; i++) {
        const start = i * chunkSize;
        const end = i === count - 1 ? size : start + chunkSize;
        const res = await fetch(init.upload_url, {
          method: "PUT",
          headers: {
            "Content-Type": media.mimeType,
            "Content-Length": String(end - start),
            "Content-Range": `bytes ${start}-${end - 1}/${size}`,
          },
          body: buffer.subarray(start, end),
        });
        if (!res.ok) throw new Error(`TikTok upload failed (${res.status})`);
      }
    } else if (isImage(media)) {
      // Photo posts only support PULL_FROM_URL, so ads.pibot.io must be verified in the TikTok dev portal.
      const init = await tt(token, "post/publish/content/init/", {
        post_info: { ...post_info, description: caption },
        source_info: { source: "PULL_FROM_URL", photo_images: [publicMediaUrl(media)], photo_cover_index: 0 },
        post_mode: "DIRECT_POST",
        media_type: "PHOTO",
      });
      publishId = init.publish_id;
    } else {
      throw new Error("File type not supported by TikTok");
    }

    const status = await poll(
      async () => {
        const s = await tt(token, "post/publish/status/fetch/", { publish_id: publishId });
        if (s.status === "FAILED") throw new Error(`TikTok failed: ${s.fail_reason ?? "unknown"}`);
        return s.status === "PUBLISH_COMPLETE" ? s : undefined;
      },
      { intervalMs: 5000, timeoutMs: 15 * 60_000 },
    );
    const postId = status.publicaly_available_post_id?.[0];
    return { externalId: postId ? String(postId) : publishId };
  },
};
