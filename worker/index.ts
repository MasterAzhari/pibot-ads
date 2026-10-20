// Background worker: publishes scheduled posts, syncs ad stats, and runs the daily AI review.
// Polls Postgres instead of using a queue service, so the VPS only needs the app + db containers.
import { db } from "../src/lib/db";
import { refreshTokens, runDailyAnalysis, runDuePosts, syncAllAds } from "../src/lib/jobs";
import { getSetting, setSetting } from "../src/lib/settings";

const POST_INTERVAL_MS = 30_000;
const ADS_SYNC_INTERVAL_MS = 3 * 60 * 60_000;
/** Malaysia time hour to run the daily AI review */
const DAILY_HOUR_MYT = Number(process.env.DAILY_ANALYSIS_HOUR ?? 8);

let stopping = false;

async function every(name: string, ms: number, fn: () => Promise<unknown>) {
  while (!stopping) {
    try {
      await fn();
    } catch (err) {
      console.error(`[${name}]`, err);
    }
    await new Promise((r) => setTimeout(r, ms));
  }
}

async function dailyIfDue() {
  const now = new Date();
  const myt = new Date(now.getTime() + 8 * 3600_000);
  const today = myt.toISOString().slice(0, 10);
  const last = await getSetting<{ day?: string; done?: boolean; attempts?: number }>("worker:daily", {});
  if (myt.getUTCHours() < DAILY_HOUR_MYT) return;
  const attempts = last.day === today ? (last.attempts ?? 0) : 0;
  // Retry a failed run on the next tick, but give up after 3 tries so a broken key doesn't loop all day.
  if ((last.day === today && last.done) || attempts >= 3) return;
  await setSetting("worker:daily", { day: today, done: false, attempts: attempts + 1 });
  console.log("[daily] running AI analysis");
  await refreshTokens();
  await runDailyAnalysis();
  await setSetting("worker:daily", { day: today, done: true, attempts: attempts + 1 });
}

async function main() {
  console.log("pibot-ads worker started");
  for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => (stopping = true));
  await Promise.all([
    every("posts", POST_INTERVAL_MS, runDuePosts),
    every("ads-sync", ADS_SYNC_INTERVAL_MS, () => syncAllAds(3)),
    every("daily", 10 * 60_000, dailyIfDue),
  ]);
  await db.$disconnect();
}

main();
