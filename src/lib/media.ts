import { mkdir, writeFile, stat, readFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { db } from "./db";
import { env } from "./env";

export async function saveUpload(file: File) {
  const dir = path.resolve(env().UPLOAD_DIR);
  await mkdir(dir, { recursive: true });
  const ext = path.extname(file.name).toLowerCase().replace(/[^.a-z0-9]/g, "") || "";
  const name = `${Date.now()}-${randomBytes(6).toString("hex")}${ext}`;
  await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return db.media.create({
    data: { filename: file.name, mimeType: file.type || "application/octet-stream", size: file.size, path: name },
  });
}

export function mediaFilePath(rel: string) {
  const dir = path.resolve(env().UPLOAD_DIR);
  const full = path.resolve(dir, rel);
  if (!full.startsWith(dir + path.sep)) throw new Error("Path tidak sah");
  return full;
}

/**
 * Public URL the platforms fetch media from (IG, Threads, Meta ads, TikTok ads all pull by URL).
 * Served by src/app/media/[file]/route.ts without login, so names are random.
 */
export function publicMediaUrl(media: { path: string }) {
  return `${env().APP_URL.replace(/\/$/, "")}/media/${encodeURIComponent(media.path)}`;
}

export async function readMedia(media: { path: string }) {
  const full = mediaFilePath(media.path);
  return { buffer: await readFile(full), size: (await stat(full)).size };
}

export const isVideo = (m: { mimeType: string }) => m.mimeType.startsWith("video/");
export const isImage = (m: { mimeType: string }) => m.mimeType.startsWith("image/");
