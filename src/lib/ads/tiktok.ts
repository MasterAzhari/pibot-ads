import type { AdAccount, Campaign } from "@prisma/client";
import { db } from "../db";
import { decrypt } from "../crypto";
import { env, requireEnv } from "../env";
import { requestJson } from "../http";
import { isVideo, publicMediaUrl } from "../media";
import { isoDate, type AdsNetwork, type Objective } from "./types";

const API = "https://business-api.tiktok.com/open_api/v1.3";

async function call(account: AdAccount | string, method: "GET" | "POST", path: string, params: Record<string, unknown>) {
  const accessToken = typeof account === "string" ? account : decrypt(account.accessToken);
  const res =
    method === "GET"
      ? await requestJson(`${API}/${path}`, {
          headers: { "Access-Token": accessToken },
          // TikTok wants arrays/objects JSON-encoded in the query string
          query: Object.fromEntries(Object.entries(params).map(([k, v]) => [k, typeof v === "object" ? JSON.stringify(v) : (v as any)])),
        })
      : await requestJson(`${API}/${path}`, { method: "POST", headers: { "Access-Token": accessToken }, json: params });
  if (res.code !== 0) throw new Error(`TikTok Ads: ${res.message} (${res.code})`);
  return res.data;
}

export function tiktokAdsAuthorizeUrl(state: string) {
  const u = new URL("https://business-api.tiktok.com/portal/auth");
  u.searchParams.set("app_id", requireEnv("TIKTOK_ADS_APP_ID"));
  u.searchParams.set("state", state);
  u.searchParams.set("redirect_uri", `${env().APP_URL}/api/oauth/tiktok-ads/callback`);
  return u.toString();
}

export async function tiktokAdsExchange(authCode: string) {
  const res = await requestJson(`${API}/oauth2/access_token/`, {
    method: "POST",
    json: { app_id: requireEnv("TIKTOK_ADS_APP_ID"), secret: requireEnv("TIKTOK_ADS_SECRET"), auth_code: authCode },
  });
  if (res.code !== 0) throw new Error(`TikTok Ads: ${res.message}`);
  const { access_token, advertiser_ids } = res.data as { access_token: string; advertiser_ids: string[] };
  const info = await call(access_token, "GET", "advertiser/info/", { advertiser_ids, fields: ["name", "currency"] });
  return { accessToken: access_token, advertisers: info.list as { advertiser_id: string; name: string; currency: string }[] };
}

// TikTok location_ids are GeoNames ids.
const COUNTRY_LOCATION: Record<string, string> = {
  MY: "1733045",
  SG: "1880251",
  ID: "1643084",
  BN: "1820814",
  TH: "1605651",
};

const AGE_GROUPS: [string, number, number][] = [
  ["AGE_18_24", 18, 24],
  ["AGE_25_34", 25, 34],
  ["AGE_35_44", 35, 44],
  ["AGE_45_54", 45, 54],
  ["AGE_55_100", 55, 100],
];

const OBJECTIVES: Record<Objective, { objective_type: string; optimization_goal: string; billing_event: string }> = {
  TRAFFIC: { objective_type: "TRAFFIC", optimization_goal: "CLICK", billing_event: "CPC" },
  AWARENESS: { objective_type: "REACH", optimization_goal: "REACH", billing_event: "CPM" },
  VIDEO_VIEWS: { objective_type: "VIDEO_VIEWS", optimization_goal: "ENGAGED_VIEW", billing_event: "CPV" },
  // TikTok's ENGAGEMENT objective is for profile follows; video views is the closest match for post engagement.
  ENGAGEMENT: { objective_type: "VIDEO_VIEWS", optimization_goal: "ENGAGED_VIEW", billing_event: "CPV" },
};

const adv = (a: AdAccount) => a.externalId;
const adgroupIds = (c: Campaign) => ((c.meta as { adgroupIds?: string[] }).adgroupIds ?? []) as string[];

async function identityId(account: AdAccount) {
  const meta = account.meta as { identityId?: string };
  if (meta.identityId) return meta.identityId;
  const data = await call(account, "POST", "identity/create/", { advertiser_id: adv(account), display_name: account.name.slice(0, 40) });
  await db.adAccount.update({ where: { id: account.id }, data: { meta: { ...meta, identityId: data.identity_id } } });
  return data.identity_id as string;
}

export const tiktokAds: AdsNetwork = {
  async syncCampaigns(account) {
    const data = await call(account, "GET", "campaign/get/", { advertiser_id: adv(account), page_size: 100 });
    for (const c of data.list as any[]) {
      const existing = await db.campaign.findUnique({
        where: { adAccountId_externalId: { adAccountId: account.id, externalId: String(c.campaign_id) } },
      });
      const fields = {
        name: c.campaign_name,
        objective: c.objective_type,
        status: c.operation_status === "ENABLE" ? "ACTIVE" : "PAUSED",
        lastSyncedAt: new Date(),
      };
      if (existing) await db.campaign.update({ where: { id: existing.id }, data: fields });
      else
        await db.campaign.create({
          data: {
            adAccountId: account.id,
            externalId: String(c.campaign_id),
            dailyBudget: c.budget_mode === "BUDGET_MODE_DAY" ? Number(c.budget) : null,
            ...fields,
          },
        });
    }
  },

  async syncInsights(account, days) {
    const data = await call(account, "GET", "report/integrated/get/", {
      advertiser_id: adv(account),
      report_type: "BASIC",
      data_level: "AUCTION_CAMPAIGN",
      dimensions: ["campaign_id", "stat_time_day"],
      metrics: ["spend", "impressions", "reach", "clicks", "video_play_actions", "conversion"],
      start_date: isoDate(new Date(Date.now() - days * 86400_000)),
      end_date: isoDate(new Date()),
      page_size: 1000,
    });
    for (const row of data.list as any[]) {
      const campaign = await db.campaign.findUnique({
        where: { adAccountId_externalId: { adAccountId: account.id, externalId: String(row.dimensions.campaign_id) } },
      });
      if (!campaign) continue;
      const m = row.metrics;
      const values = {
        spend: Number(m.spend ?? 0),
        impressions: Number(m.impressions ?? 0),
        reach: Number(m.reach ?? 0),
        clicks: Number(m.clicks ?? 0),
        videoViews: Number(m.video_play_actions ?? 0),
        conversions: Number(m.conversion ?? 0),
      };
      const date = new Date(String(row.dimensions.stat_time_day).slice(0, 10));
      await db.insightDaily.upsert({
        where: { campaignId_date: { campaignId: campaign.id, date } },
        create: { campaignId: campaign.id, date, ...values },
        update: values,
      });
    }
  },

  async setActive(account, campaign, active) {
    await call(account, "POST", "campaign/status/update/", {
      advertiser_id: adv(account),
      campaign_ids: [campaign.externalId],
      operation_status: active ? "ENABLE" : "DISABLE",
    });
    await db.campaign.update({ where: { id: campaign.id }, data: { status: active ? "ACTIVE" : "PAUSED" } });
  },

  // Budget lives on the ad group (min ~USD 20/day) rather than the campaign (min ~USD 50/day), which is cheaper to start with.
  async setDailyBudget(account, campaign, amount) {
    const ids = adgroupIds(campaign);
    if (!ids.length) throw new Error("Kempen ini tiada ad group yang direkod; ubah bajet di TikTok Ads Manager");
    await call(account, "POST", "adgroup/budget/update/", {
      advertiser_id: adv(account),
      budget: ids.map((adgroup_id) => ({ adgroup_id, budget: amount / ids.length })),
    });
    await db.campaign.update({ where: { id: campaign.id }, data: { dailyBudget: amount } });
  },

  async searchInterests(account, query) {
    const data = await call(account, "GET", "tool/interest_category/", { advertiser_id: adv(account), version: 2 });
    const q = query.toLowerCase();
    return (data.interest_categories as any[])
      .filter((c) => String(c.interest_category_name).toLowerCase().includes(q))
      .slice(0, 15)
      .map((c) => ({ id: String(c.interest_category_id), name: c.interest_category_name }));
  },

  async createCampaign(account, input) {
    const media = await db.media.findUniqueOrThrow({ where: { id: input.mediaId } });
    if (!isVideo(media)) throw new Error("Iklan TikTok perlukan video");
    const o = OBJECTIVES[input.objective];
    const advertiser_id = adv(account);
    // Validate everything local before the first remote call so a bad input never leaves an orphan campaign.
    const location_ids = input.countries.map((c) => COUNTRY_LOCATION[c]).filter(Boolean);
    if (!location_ids.length) throw new Error(`Negara belum dipetakan untuk TikTok: ${input.countries.join(", ")}`);

    const campaign = await call(account, "POST", "campaign/create/", {
      advertiser_id,
      campaign_name: input.name,
      objective_type: o.objective_type,
      budget_mode: "BUDGET_MODE_INFINITE",
      operation_status: "DISABLE",
    });

    const age_groups = AGE_GROUPS.filter(([, lo, hi]) => hi >= input.ageMin && lo <= input.ageMax).map(([g]) => g);
    const now = new Date(Date.now() + 10 * 60_000).toISOString().replace("T", " ").slice(0, 19);

    const adgroup = await call(account, "POST", "adgroup/create/", {
      advertiser_id,
      campaign_id: campaign.campaign_id,
      adgroup_name: `${input.name} – audience`,
      promotion_type: "WEBSITE",
      placement_type: "PLACEMENT_TYPE_NORMAL",
      placements: ["PLACEMENT_TIKTOK"],
      location_ids,
      age_groups,
      gender: input.gender === "ALL" ? "GENDER_UNLIMITED" : `GENDER_${input.gender}`,
      interest_category_ids: input.interests.map((i) => i.id),
      budget_mode: "BUDGET_MODE_DAY",
      budget: input.dailyBudget,
      schedule_type: "SCHEDULE_FROM_NOW",
      schedule_start_time: now,
      optimization_goal: o.optimization_goal,
      billing_event: o.billing_event,
      bid_type: "BID_TYPE_NO_BID",
      pacing: "PACING_MODE_SMOOTH",
      // The DISABLE'd campaign is the single on/off switch.
      operation_status: "ENABLE",
    });

    const uploaded = await call(account, "POST", "file/video/ad/upload/", {
      advertiser_id,
      upload_type: "UPLOAD_BY_URL",
      video_url: publicMediaUrl(media),
      file_name: `${Date.now()}-${media.filename}`.slice(0, 100),
    });
    const videoId = (Array.isArray(uploaded) ? uploaded[0] : uploaded).video_id as string;
    const info = await call(account, "GET", "file/video/ad/info/", { advertiser_id, video_ids: [videoId] });
    const cover = await call(account, "POST", "file/image/ad/upload/", {
      advertiser_id,
      upload_type: "UPLOAD_BY_URL",
      image_url: info.list[0].video_cover_url,
    });

    await call(account, "POST", "ad/create/", {
      advertiser_id,
      adgroup_id: adgroup.adgroup_id,
      creatives: [
        {
          ad_name: `${input.name} – ad`,
          ad_format: "SINGLE_VIDEO",
          identity_type: "CUSTOMIZED_USER",
          identity_id: await identityId(account),
          video_id: videoId,
          image_ids: [cover.image_id],
          ad_text: input.primaryText.slice(0, 100),
          call_to_action: input.cta,
          landing_page_url: input.link,
        },
      ],
    });

    const row = await db.campaign.create({
      data: {
        adAccountId: account.id,
        externalId: String(campaign.campaign_id),
        name: input.name,
        objective: o.objective_type,
        status: "PAUSED",
        dailyBudget: input.dailyBudget,
        meta: { adgroupIds: [String(adgroup.adgroup_id)], input } as any,
      },
    });
    return row.id;
  },
};
