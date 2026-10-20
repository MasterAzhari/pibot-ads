import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { db } from "@/lib/db";
import { mediaFilePath } from "@/lib/media";

// Public on purpose: Meta and TikTok download media from this URL. File names are random.
export async function GET(req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const media = await db.media.findFirst({ where: { path: file } });
  if (!media) return new Response("Not found", { status: 404 });
  const full = mediaFilePath(media.path);
  const { size } = await stat(full);

  const range = req.headers.get("range")?.match(/bytes=(\d*)-(\d*)/);
  const headers: Record<string, string> = { "Content-Type": media.mimeType, "Accept-Ranges": "bytes", "Cache-Control": "public, max-age=86400" };
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    const stream = Readable.toWeb(createReadStream(full, { start, end })) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }
  return new Response(Readable.toWeb(createReadStream(full)) as ReadableStream, { headers: { ...headers, "Content-Length": String(size) } });
}
