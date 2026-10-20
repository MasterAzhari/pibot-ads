import type { Platform } from "@prisma/client";
import { facebook } from "./facebook";
import { instagram } from "./instagram";
import { threads } from "./threads";
import { tiktok } from "./tiktok";
import type { Publisher } from "./types";

export const publishers: Record<Platform, Publisher> = {
  FACEBOOK: facebook,
  INSTAGRAM: instagram,
  THREADS: threads,
  TIKTOK: tiktok,
};

export const PLATFORM_LABEL: Record<Platform, string> = {
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  THREADS: "Threads",
  TIKTOK: "TikTok",
};
