import { db } from "./db";
import { publishers } from "./platforms";

/** Publish every target of a post that isn't published yet. Safe to call again to retry failures. */
export async function publishPost(postId: string) {
  const post = await db.post.findUniqueOrThrow({
    where: { id: postId },
    include: { media: true, targets: { include: { account: true } } },
  });
  await db.post.update({ where: { id: postId }, data: { status: "PUBLISHING" } });

  for (const target of post.targets) {
    if (target.status === "PUBLISHED") continue;
    await db.postTarget.update({ where: { id: target.id }, data: { status: "PUBLISHING", error: null } });
    try {
      const result = await publishers[target.account.platform].publish(target.account, { caption: post.caption, media: post.media });
      await db.postTarget.update({
        where: { id: target.id },
        data: { status: "PUBLISHED", externalId: result.externalId, permalink: result.permalink, publishedAt: new Date() },
      });
    } catch (err) {
      await db.postTarget.update({
        where: { id: target.id },
        data: { status: "FAILED", error: err instanceof Error ? err.message : String(err) },
      });
    }
  }

  const targets = await db.postTarget.findMany({ where: { postId } });
  const ok = targets.filter((t) => t.status === "PUBLISHED").length;
  const status = ok === targets.length ? "PUBLISHED" : ok === 0 ? "FAILED" : "PARTIAL";
  await db.post.update({ where: { id: postId }, data: { status } });
  return status;
}

/** Push a new caption to platforms that allow editing. Returns platforms that couldn't be edited. */
export async function editPublishedCaption(postId: string, caption: string) {
  const post = await db.post.update({
    where: { id: postId },
    data: { caption },
    include: { targets: { include: { account: true } } },
  });
  const skipped: string[] = [];
  for (const t of post.targets) {
    if (t.status !== "PUBLISHED" || !t.externalId) continue;
    const pub = publishers[t.account.platform];
    if (!pub.edit) {
      skipped.push(t.account.name);
      continue;
    }
    await pub.edit(t.account, t.externalId, caption);
  }
  return skipped;
}

/** Delete from platforms where possible, then locally. Returns accounts that must be deleted by hand. */
export async function deletePost(postId: string) {
  const post = await db.post.findUniqueOrThrow({ where: { id: postId }, include: { targets: { include: { account: true } } } });
  const manual: string[] = [];
  for (const t of post.targets) {
    if (t.status !== "PUBLISHED" || !t.externalId) continue;
    const pub = publishers[t.account.platform];
    if (!pub.remove) {
      manual.push(t.account.name);
      continue;
    }
    await pub.remove(t.account, t.externalId);
  }
  await db.post.delete({ where: { id: postId } });
  return manual;
}
