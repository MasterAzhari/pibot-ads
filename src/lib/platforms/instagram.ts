import { decrypt } from "../crypto";
import { poll } from "../http";
import { isVideo, publicMediaUrl } from "../media";
import { graph } from "./meta-graph";
import type { Publisher } from "./types";

// Instagram Graph API (IG business/creator linked to a FB Page). Token = the Page token.
// IG does not allow editing captions or deleting posts through the API.
export const instagram: Publisher = {
  async publish(account, { caption, media }) {
    if (!media) throw new Error("Instagram perlukan gambar atau video");
    const token = decrypt(account.accessToken);
    const igId = account.externalId;
    const container = isVideo(media)
      ? await graph.post(`${igId}/media`, token, { media_type: "REELS", video_url: publicMediaUrl(media), caption })
      : await graph.post(`${igId}/media`, token, { image_url: publicMediaUrl(media), caption });

    await poll(
      async () => {
        const { status_code } = await graph.get(container.id, token, { fields: "status_code" });
        if (status_code === "ERROR" || status_code === "EXPIRED") throw new Error(`Instagram gagal proses media (${status_code})`);
        return status_code === "FINISHED" ? true : undefined;
      },
      { intervalMs: 5000, timeoutMs: 15 * 60_000 },
    );

    const { id } = await graph.post(`${igId}/media_publish`, token, { creation_id: container.id });
    const { permalink } = await graph.get(id, token, { fields: "permalink" });
    return { externalId: id, permalink };
  },
};
