import { decrypt } from "../crypto";
import { isImage, isVideo, publicMediaUrl } from "../media";
import { graph } from "./meta-graph";
import type { Publisher } from "./types";

// FB Page posting with a Page access token (non-expiring when derived from a long-lived user token).
export const facebook: Publisher = {
  async publish(account, { caption, media }) {
    const token = decrypt(account.accessToken);
    const pageId = account.externalId;
    let id: string;
    if (media && isVideo(media)) {
      ({ id } = await graph.post(`${pageId}/videos`, token, { file_url: publicMediaUrl(media), description: caption }));
    } else if (media && isImage(media)) {
      const res = await graph.post(`${pageId}/photos`, token, { url: publicMediaUrl(media), caption });
      id = res.post_id ?? res.id;
    } else {
      ({ id } = await graph.post(`${pageId}/feed`, token, { message: caption }));
    }
    let permalink: string | undefined;
    try {
      permalink = (await graph.get(id, token, { fields: "permalink_url" })).permalink_url;
    } catch {
      // videos are still processing; the link appears later
    }
    return { externalId: id, permalink };
  },
  async edit(account, externalId, caption) {
    await graph.post(externalId, decrypt(account.accessToken), { message: caption });
  },
  async remove(account, externalId) {
    await graph.delete(externalId, decrypt(account.accessToken));
  },
};
