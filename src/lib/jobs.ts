import { db } from "./db";
import { decrypt, encrypt } from "./crypto";
import { adsNetworks } from "./ads";
import { analyseCampaigns, type CampaignStats } from "./ai/tasks";
import { publishPost } from "./publish";
import { threadsRefresh } from "./platforms/threads";

/** Claim and publish scheduled posts whose time has come. */
export async function runDuePosts() {
  const due = await db.post.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: new Date() } },
    select: { id: true },
    take: 10,
  });
  for (const { id } of due) {
    // Claim atomically so two workers never publish the same post.
    const claimed = await db.post.updateMany({ where: { id, status: "SCHEDULED" }, data: { status: "PUBLISHING" } });
    if (claimed.count) await publishPost(id);
  }
  return due.length;
}

export async function syncAllAds(days = 7) {
  const accounts = await db.adAccount.findMany();
  const errors: string[] = [];
  for (const account of accounts) {
    try {
      await adsNetworks[account.network].syncCampaigns(account);
      await adsNetworks[account.network].syncInsights(account, days);
    } catch (err) {
      errors.push(`${account.name}: ${err instanceof Error ? err.message : err}`);
    }
  }
  return errors;
}

export async function collectStats(days = 7): Promise<CampaignStats[]> {
  const since = new Date(Date.now() - days * 86400_000);
  const campaigns = await db.campaign.findMany({
    include: { adAccount: true, insights: { where: { date: { gte: since } }, orderBy: { date: "asc" } } },
  });
  return campaigns
    .filter((c) => c.insights.length || c.status === "ACTIVE")
    .map((c) => ({
      id: c.id,
      name: c.name,
      network: c.adAccount.network,
      status: c.status,
      currency: c.adAccount.currency,
      dailyBudget: c.dailyBudget,
      days: c.insights.map((i) => ({
        date: i.date.toISOString().slice(0, 10),
        spend: i.spend,
        impressions: i.impressions,
        clicks: i.clicks,
        videoViews: i.videoViews,
        conversions: i.conversions,
      })),
    }));
}

/** Sync numbers, ask the AI for advice, store each suggestion as PENDING for the owner to approve. */
export async function runDailyAnalysis() {
  await syncAllAds(7);
  const stats = await collectStats(7);
  if (!stats.length) return null;
  const result = await analyseCampaigns(stats);
  const known = new Set(stats.map((s) => s.id));
  for (const r of result.recommendations) {
    const campaignId = r.campaignId && known.has(r.campaignId) ? r.campaignId : null;
    await db.recommendation.create({
      data: {
        campaignId,
        kind: campaignId ? r.kind : "INFO",
        title: r.title,
        reason: r.reason,
        action: r.kind === "SET_BUDGET" && r.newDailyBudget ? { dailyBudget: r.newDailyBudget } : {},
      },
    });
  }
  await db.setting.upsert({
    where: { key: "lastAnalysis" },
    create: { key: "lastAnalysis", value: { summary: result.summary, at: new Date().toISOString() } },
    update: { value: { summary: result.summary, at: new Date().toISOString() } },
  });
  return result;
}

/** Runs only after the owner presses Approve. */
export async function executeRecommendation(id: string) {
  const rec = await db.recommendation.findUniqueOrThrow({ where: { id }, include: { campaign: { include: { adAccount: true } } } });
  if (rec.status !== "PENDING") throw new Error("This suggestion was already handled");
  if (!rec.campaign || rec.kind === "INFO") {
    await db.recommendation.update({ where: { id }, data: { status: "APPROVED", decidedAt: new Date() } });
    return;
  }
  const { campaign } = rec;
  const net = adsNetworks[campaign.adAccount.network];
  try {
    if (rec.kind === "PAUSE") await net.setActive(campaign.adAccount, campaign, false);
    else if (rec.kind === "RESUME") await net.setActive(campaign.adAccount, campaign, true);
    else if (rec.kind === "SET_BUDGET") {
      const amount = Number((rec.action as { dailyBudget?: number }).dailyBudget);
      if (!amount || amount <= 0) throw new Error("Invalid new budget");
      await net.setDailyBudget(campaign.adAccount, campaign, amount);
    }
    await db.recommendation.update({ where: { id }, data: { status: "EXECUTED", decidedAt: new Date(), result: "OK" } });
  } catch (err) {
    await db.recommendation.update({
      where: { id },
      data: { status: "FAILED", decidedAt: new Date(), result: err instanceof Error ? err.message : String(err) },
    });
    throw err;
  }
}

/** Threads long-lived tokens expire after 60 days; refresh those under 10 days left. */
export async function refreshTokens() {
  const soon = new Date(Date.now() + 10 * 86400_000);
  const accounts = await db.account.findMany({ where: { platform: "THREADS", tokenExpiresAt: { lte: soon } } });
  for (const a of accounts) {
    try {
      const t = await threadsRefresh(decrypt(a.accessToken));
      await db.account.update({
        where: { id: a.id },
        data: { accessToken: encrypt(t.access_token), tokenExpiresAt: new Date(Date.now() + t.expires_in * 1000) },
      });
    } catch (err) {
      console.error(`[tokens] Threads ${a.name}:`, err);
    }
  }
}
