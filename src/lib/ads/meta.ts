import type { AdAccount } from "@prisma/client";
import { db } from "../db";
import { decrypt } from "../crypto";
import { poll } from "../http";
import { isVideo, publicMediaUrl, readMedia } from "../media";
import { graph } from "../platforms/meta-graph";
import { isoDate, type AdsNetwork, type Objective } from "./types";

const act = (a: AdAccount) => (a.externalId.startsWith("act_") ? a.externalId : `act_${a.externalId}`);
const token = (a: AdAccount) => decrypt(a.accessToken);
// Meta budgets are in the currency's minor unit (sen for MYR).
const toMinor = (n: number) => Math.round(n * 100);

const OBJECTIVES: Record<Objective, { objective: string; optimization_goal: string; destination_type?: string }> = {
  TRAFFIC: { objective: "OUTCOME_TRAFFIC", optimization_goal: "LINK_CLICKS", destination_type: "WEBSITE" },
  AWARENESS: { objective: "OUTCOME_AWARENESS", optimization_goal: "REACH" },
  ENGAGEMENT: { objective: "OUTCOME_ENGAGEMENT", optimization_goal: "POST_ENGAGEMENT", destination_type: "ON_POST" },
  VIDEO_VIEWS: { objective: "OUTCOME_ENGAGEMENT", optimization_goal: "THRUPLAY" },
};

const CONVERSION_ACTIONS = new Set(["purchase", "lead", "onsite_conversion.messaging_conversation_started_7d"]);

export const metaAds: AdsNetwork = {
  async syncCampaigns(account) {
    const res = await graph.get(`${act(account)}/campaigns`, token(account), {
      fields: "id,name,objective,effective_status,daily_budget",
      limit: 200,
    });
    for (const c of res.data as any[]) {
      const data = {
        name: c.name,
        objective: c.objective,
        status: c.effective_status,
        dailyBudget: c.daily_budget ? Number(c.daily_budget) / 100 : null,
        lastSyncedAt: new Date(),
      };
      await db.campaign.upsert({
        where: { adAccountId_externalId: { adAccountId: account.id, externalId: c.id } },
        create: { adAccountId: account.id, externalId: c.id, ...data },
        update: data,
      });
    }
  },

  async syncInsights(account, days) {
    const since = new Date(Date.now() - days * 86400_000);
    const res = await graph.get(`${act(account)}/insights`, token(account), {
      level: "campaign",
      fields: "campaign_id,spend,impressions,reach,clicks,actions",
      time_increment: 1,
      time_range: JSON.stringify({ since: isoDate(since), until: isoDate(new Date()) }),
      limit: 500,
    });
    for (const row of res.data as any[]) {
      const campaign = await db.campaign.findUnique({
        where: { adAccountId_externalId: { adAccountId: account.id, externalId: row.campaign_id } },
      });
      if (!campaign) continue;
      const actions: { action_type: string; value: string }[] = row.actions ?? [];
      const sum = (pred: (t: string) => boolean) => actions.filter((a) => pred(a.action_type)).reduce((s, a) => s + Number(a.value), 0);
      const data = {
        spend: Number(row.spend ?? 0),
        impressions: Number(row.impressions ?? 0),
        reach: Number(row.reach ?? 0),
        clicks: Number(row.clicks ?? 0),
        videoViews: sum((t) => t === "video_view"),
        conversions: sum((t) => CONVERSION_ACTIONS.has(t)),
      };
      const date = new Date(row.date_start);
      await db.insightDaily.upsert({
        where: { campaignId_date: { campaignId: campaign.id, date } },
        create: { campaignId: campaign.id, date, ...data },
        update: data,
      });
    }
  },

  async setActive(account, campaign, active) {
    await graph.post(campaign.externalId, token(account), { status: active ? "ACTIVE" : "PAUSED" });
    await db.campaign.update({ where: { id: campaign.id }, data: { status: active ? "ACTIVE" : "PAUSED" } });
  },

  async setDailyBudget(account, campaign, amount) {
    await graph.post(campaign.externalId, token(account), { daily_budget: toMinor(amount) });
    await db.campaign.update({ where: { id: campaign.id }, data: { dailyBudget: amount } });
  },

  async searchInterests(account, query) {
    const res = await graph.get("search", token(account), { type: "adinterest", q: query, limit: 15 });
    return (res.data as any[]).map((i) => ({ id: String(i.id), name: i.name, audienceSize: i.audience_size_upper_bound ?? i.audience_size }));
  },

  async createCampaign(account, input) {
    const t = token(account);
    const meta = account.meta as { pageId?: string; instagramUserId?: string };
    if (!meta.pageId) throw new Error("Pilih FB Page untuk ad account ini dulu (halaman Iklan → Tetapan)");
    const media = await db.media.findUniqueOrThrow({ where: { id: input.mediaId } });
    const o = OBJECTIVES[input.objective];

    // Campaign budget (CBO) so one number controls spend.
    const campaign = await graph.post(`${act(account)}/campaigns`, t, {
      name: input.name,
      objective: o.objective,
      status: "PAUSED",
      special_ad_categories: [],
      daily_budget: toMinor(input.dailyBudget),
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    });

    const targeting: Record<string, unknown> = {
      geo_locations: { countries: input.countries },
      age_min: input.ageMin,
      // With Advantage+ audience Meta treats age as a suggestion and requires age_max 65.
      age_max: input.advantageAudience ? 65 : input.ageMax,
      targeting_automation: { advantage_audience: input.advantageAudience ? 1 : 0 },
    };
    if (input.gender !== "ALL") targeting.genders = [input.gender === "MALE" ? 1 : 2];
    if (input.interests.length) targeting.flexible_spec = [{ interests: input.interests.map(({ id, name }) => ({ id, name })) }];
    // No publisher_platforms = Advantage+ placements: FB, IG, Threads, Messenger, Audience Network.

    const adset = await graph.post(`${act(account)}/adsets`, t, {
      name: `${input.name} – audience`,
      campaign_id: campaign.id,
      billing_event: "IMPRESSIONS",
      optimization_goal: o.optimization_goal,
      ...(o.destination_type ? { destination_type: o.destination_type } : {}),
      targeting,
      // Child objects start ACTIVE; the PAUSED campaign is the single on/off switch.
      status: "ACTIVE",
      start_time: new Date().toISOString(),
    });

    const cta = { type: input.cta, value: { link: input.link } };
    let object_story_spec: Record<string, unknown>;
    if (isVideo(media)) {
      const video = await graph.post(`${act(account)}/advideos`, t, { file_url: publicMediaUrl(media), name: media.filename });
      await poll(
        async () => {
          const v = await graph.get(video.id, t, { fields: "status" });
          if (v.status?.video_status === "error") throw new Error("Meta gagal proses video");
          return v.status?.video_status === "ready" ? true : undefined;
        },
        { intervalMs: 10_000, timeoutMs: 20 * 60_000 },
      );
      const thumbs = await graph.get(`${video.id}/thumbnails`, t);
      object_story_spec = {
        page_id: meta.pageId,
        video_data: {
          video_id: video.id,
          message: input.primaryText,
          title: input.headline,
          image_url: thumbs.data?.[0]?.uri,
          call_to_action: cta,
        },
      };
    } else {
      const { buffer } = await readMedia(media);
      const img = await graph.post(`${act(account)}/adimages`, t, { bytes: buffer.toString("base64") });
      const hash = (Object.values(img.images ?? {})[0] as { hash: string } | undefined)?.hash;
      if (!hash) throw new Error("Meta tak pulangkan image hash");
      object_story_spec = {
        page_id: meta.pageId,
        link_data: { image_hash: hash, link: input.link, message: input.primaryText, name: input.headline, call_to_action: cta },
      };
    }
    if (meta.instagramUserId) object_story_spec.instagram_user_id = meta.instagramUserId;

    const creative = await graph.post(`${act(account)}/adcreatives`, t, { name: `${input.name} – creative`, object_story_spec });
    await graph.post(`${act(account)}/ads`, t, {
      name: `${input.name} – ad`,
      adset_id: adset.id,
      creative: { creative_id: creative.id },
      status: "ACTIVE",
    });

    const row = await db.campaign.create({
      data: {
        adAccountId: account.id,
        externalId: campaign.id,
        name: input.name,
        objective: o.objective,
        status: "PAUSED",
        dailyBudget: input.dailyBudget,
        meta: { adsetIds: [adset.id], input } as any,
      },
    });
    return row.id;
  },
};
