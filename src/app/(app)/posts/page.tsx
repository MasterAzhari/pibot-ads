import Link from "next/link";
import { db } from "@/lib/db";
import { PLATFORM_LABEL, publishers } from "@/lib/platforms";
import { fmtDateTime, STATUS_LABEL } from "@/components/format";
import { PostActions } from "./PostActions";

export const dynamic = "force-dynamic";

export default async function PostsPage() {
  const posts = await db.post.findMany({
    orderBy: [{ scheduledAt: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }],
    include: { media: true, targets: { include: { account: true } } },
    take: 100,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Post & jadual</h1>
        <Link href="/compose" className="btn">
          + Post baru
        </Link>
      </div>
      {!posts.length && <p className="muted">Belum ada post.</p>}
      <div className="space-y-3">
        {posts.map((p) => (
          <div key={p.id} className="card space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="badge">{STATUS_LABEL[p.status]}</span>
              <span className="muted">{p.scheduledAt ? `Jadual: ${fmtDateTime(p.scheduledAt)}` : `Dibuat ${fmtDateTime(p.createdAt)}`}</span>
              {p.media && <span className="muted">· {p.media.mimeType.startsWith("video/") ? "🎬" : "🖼️"} {p.media.filename}</span>}
            </div>
            <p className="whitespace-pre-line text-sm">{p.caption}</p>
            <div className="flex flex-wrap gap-2">
              {p.targets.map((t) => (
                <span key={t.id} className="badge" title={t.error ?? ""}>
                  {PLATFORM_LABEL[t.account.platform]} {t.account.name}: {STATUS_LABEL[t.status]}
                  {t.permalink && (
                    <a href={t.permalink} target="_blank" className="underline ml-1">
                      buka
                    </a>
                  )}
                </span>
              ))}
            </div>
            {p.targets.filter((t) => t.error).map((t) => (
              <p key={t.id} className="text-xs text-red-500">
                {t.account.name}: {t.error}
              </p>
            ))}
            <PostActions
              id={p.id}
              status={p.status}
              caption={p.caption}
              noEdit={p.targets.filter((t) => t.status === "PUBLISHED" && !publishers[t.account.platform].edit).map((t) => t.account.name)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
