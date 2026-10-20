"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveUpload } from "@/lib/media";
import { deletePost, editPublishedCaption, publishPost } from "@/lib/publish";
import { adsNetworks, type Interest, type NewCampaignInput } from "@/lib/ads";
import { planVideo, suggestAudience, suggestCaptions } from "@/lib/ai/tasks";
import { executeRecommendation, runDailyAnalysis, syncAllAds } from "@/lib/jobs";
import { DEFAULT_AI_SETTINGS, getAiSettings, setSetting, type AiProviderId } from "@/lib/settings";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

async function guard<T>(fn: () => Promise<T>): Promise<Result<T>> {
  await requireUser();
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** datetime-local value typed in Malaysia time (UTC+8) */
function parseMyt(value: string) {
  const d = new Date(`${value}:00+08:00`);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid date/time");
  return d;
}

// ---------- Posts ----------

export async function uploadMedia(formData: FormData) {
  return guard(async () => {
    const file = formData.get("file");
    if (!(file instanceof File) || !file.size) throw new Error("No file");
    const media = await saveUpload(file);
    return { id: media.id, mimeType: media.mimeType, filename: media.filename };
  });
}

export async function createPost(input: { caption: string; mediaId?: string; accountIds: string[]; mode: "draft" | "now" | "schedule"; scheduledAt?: string }) {
  return guard(async () => {
    if (!input.accountIds.length) throw new Error("Pick at least one account");
    if (!input.caption.trim() && !input.mediaId) throw new Error("Write a caption or choose media");
    const scheduledAt = input.mode === "schedule" ? parseMyt(input.scheduledAt ?? "") : null;
    if (scheduledAt && scheduledAt.getTime() < Date.now() - 60_000) throw new Error("Scheduled time is in the past");

    const post = await db.post.create({
      data: {
        caption: input.caption,
        mediaId: input.mediaId || null,
        scheduledAt,
        status: input.mode === "schedule" ? "SCHEDULED" : "DRAFT",
        targets: { create: input.accountIds.map((accountId) => ({ accountId })) },
      },
    });
    if (input.mode === "now") await publishPost(post.id);
    revalidatePath("/posts");
    return { id: post.id };
  });
}

export async function publishNowAction(postId: string) {
  const r = await guard(() => publishPost(postId));
  revalidatePath("/posts");
  return r;
}

export async function updateCaptionAction(postId: string, caption: string) {
  const r = await guard(async () => {
    const post = await db.post.findUniqueOrThrow({ where: { id: postId } });
    if (post.status === "DRAFT" || post.status === "SCHEDULED") {
      await db.post.update({ where: { id: postId }, data: { caption } });
      return [] as string[];
    }
    return editPublishedCaption(postId, caption);
  });
  revalidatePath("/posts");
  return r;
}

export async function rescheduleAction(postId: string, when: string) {
  const r = await guard(async () => {
    await db.post.update({ where: { id: postId }, data: { scheduledAt: parseMyt(when), status: "SCHEDULED" } });
  });
  revalidatePath("/posts");
  return r;
}

export async function deletePostAction(postId: string) {
  const r = await guard(() => deletePost(postId));
  revalidatePath("/posts");
  return r;
}

// ---------- Accounts ----------

export async function disconnectAccount(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id"));
  const kind = String(formData.get("kind"));
  if (kind === "ad") await db.adAccount.delete({ where: { id } });
  else await db.account.delete({ where: { id } });
  revalidatePath("/accounts");
}

export async function setAdAccountPage(formData: FormData) {
  await requireUser();
  const adAccountId = String(formData.get("adAccountId"));
  const pageAccountId = String(formData.get("pageAccountId"));
  const page = await db.account.findUniqueOrThrow({ where: { id: pageAccountId } });
  const ig = await db.account.findMany({ where: { platform: "INSTAGRAM" } });
  const linked = ig.find((a) => (a.meta as { pageId?: string }).pageId === page.externalId);
  const ad = await db.adAccount.findUniqueOrThrow({ where: { id: adAccountId } });
  await db.adAccount.update({
    where: { id: adAccountId },
    data: { meta: { ...(ad.meta as object), pageId: page.externalId, instagramUserId: linked?.externalId } },
  });
  revalidatePath("/accounts");
}

// ---------- AI ----------

export async function aiCaptions(brief: string, platforms: string[]) {
  return guard(async () => (await suggestCaptions(brief, platforms)).options);
}

export async function aiVideoPlan(brief: string, seconds: number) {
  return guard(() => planVideo(brief, seconds));
}

export async function aiAudience(adAccountId: string, product: string, goal: string) {
  return guard(async () => {
    const account = await db.adAccount.findUniqueOrThrow({ where: { id: adAccountId } });
    const suggestion = await suggestAudience(product, goal);
    // Turn the AI's keywords into real interest ids the ad network accepts.
    const interests: Interest[] = [];
    for (const kw of suggestion.interestKeywords.slice(0, 8)) {
      try {
        const [hit] = await adsNetworks[account.network].searchInterests(account, kw);
        if (hit && !interests.some((i) => i.id === hit.id)) interests.push(hit);
      } catch {
        // keyword had no match; skip it
      }
    }
    return { suggestion, interests };
  });
}

export async function searchInterestsAction(adAccountId: string, query: string) {
  return guard(async () => {
    const account = await db.adAccount.findUniqueOrThrow({ where: { id: adAccountId } });
    return adsNetworks[account.network].searchInterests(account, query);
  });
}

export async function saveAiSettings(formData: FormData) {
  await requireUser();
  const current = await getAiSettings();
  const providers: AiProviderId[] = ["anthropic", "openai", "llama"];
  const models = { ...DEFAULT_AI_SETTINGS.models };
  for (const p of providers) {
    models[p] = { light: String(formData.get(`${p}_light`) ?? "").trim(), heavy: String(formData.get(`${p}_heavy`) ?? "").trim() };
  }
  const prices: Record<string, [number, number]> = {};
  for (const line of String(formData.get("prices") ?? "").split("\n")) {
    const [model, input, output] = line.split(/[\s,]+/).filter(Boolean);
    if (model && !Number.isNaN(Number(input)) && !Number.isNaN(Number(output))) prices[model] = [Number(input), Number(output)];
  }
  await setSetting("ai", {
    ...current,
    light: formData.get("light") as AiProviderId,
    heavy: formData.get("heavy") as AiProviderId,
    fallback: providers.filter((p) => formData.get(`fallback_${p}`) === "on"),
    monthlyBudgetUsd: Number(formData.get("monthlyBudgetUsd") ?? 10),
    contentLanguage: String(formData.get("contentLanguage") ?? "").trim() || DEFAULT_AI_SETTINGS.contentLanguage,
    models,
    prices,
  });
  revalidatePath("/settings");
  redirect("/settings?saved=1");
}

// ---------- Ads ----------

export async function syncAdsAction() {
  const r = await guard(() => syncAllAds(7));
  revalidatePath("/ads");
  return r;
}

export async function runAnalysisAction() {
  const r = await guard(async () => {
    const res = await runDailyAnalysis();
    if (!res) throw new Error("No campaigns to analyse yet");
    return res.summary;
  });
  revalidatePath("/ads");
  return r;
}

export async function toggleCampaign(campaignId: string, active: boolean) {
  const r = await guard(async () => {
    const c = await db.campaign.findUniqueOrThrow({ where: { id: campaignId }, include: { adAccount: true } });
    await adsNetworks[c.adAccount.network].setActive(c.adAccount, c, active);
  });
  revalidatePath("/ads");
  return r;
}

export async function setBudgetAction(campaignId: string, amount: number) {
  const r = await guard(async () => {
    if (!(amount > 0)) throw new Error("Invalid budget");
    const c = await db.campaign.findUniqueOrThrow({ where: { id: campaignId }, include: { adAccount: true } });
    await adsNetworks[c.adAccount.network].setDailyBudget(c.adAccount, c, amount);
  });
  revalidatePath("/ads");
  return r;
}

export async function decideRecommendation(id: string, approve: boolean) {
  const r = await guard(async () => {
    if (approve) await executeRecommendation(id);
    else await db.recommendation.update({ where: { id }, data: { status: "REJECTED", decidedAt: new Date() } });
  });
  revalidatePath("/ads");
  return r;
}

export async function createCampaignAction(adAccountId: string, input: NewCampaignInput) {
  return guard(async () => {
    const account = await db.adAccount.findUniqueOrThrow({ where: { id: adAccountId } });
    if (!input.name.trim()) throw new Error("Campaign name is required");
    if (!(input.dailyBudget > 0)) throw new Error("Daily budget is required");
    if (!input.link.startsWith("http")) throw new Error("Destination link must start with http");
    return adsNetworks[account.network].createCampaign(account, input);
  });
}
