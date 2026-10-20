import { askJson } from ".";
import { getAiSettings } from "../settings";

const MARKETER =
  "You are a social media marketing expert for the Malaysian market (Facebook, Instagram, Threads, TikTok).";

/** Customer-facing copy follows the owner's chosen language; notes for the owner are in English. */
async function contentRule() {
  const { contentLanguage } = await getAiSettings();
  return `Write customer-facing copy (captions, hooks, voiceover, on-screen text, ad text) in ${contentLanguage}. Write everything else in English.`;
}

export type CaptionIdea = { caption: string; hashtags: string[] };

export async function suggestCaptions(brief: string, platforms: string[]) {
  return askJson<{ options: CaptionIdea[] }>(
    "caption",
    "light",
    `${MARKETER} ${await contentRule()}`,
    `Write 3 caption options for this post.\nPlatforms: ${platforms.join(", ") || "all"}\nBrief: ${brief}\n\n` +
      `Format: {"options":[{"caption":"...","hashtags":["#..."]}]}. Strong hook on the first line, clear CTA, at most 8 hashtags.`,
    1500,
  );
}

export type VideoPlan = {
  hook: string;
  scenes: { seconds: string; visual: string; voiceover: string; onScreenText: string }[];
  cta: string;
  caption: string;
  tips: string[];
};

export async function planVideo(brief: string, lengthSeconds: number) {
  return askJson<VideoPlan>(
    "video",
    "light",
    `${MARKETER} You also write short 9:16 video scripts for TikTok and Reels. ${await contentRule()}`,
    `Plan a ${lengthSeconds}-second video for: ${brief}\n\n` +
      `Format: {"hook":"line for the first 3 seconds","scenes":[{"seconds":"0-3","visual":"...","voiceover":"...","onScreenText":"..."}],` +
      `"cta":"...","caption":"...","tips":["filming / editing tip"]}`,
    2500,
  );
}

export type AudienceSuggestion = {
  countries: string[];
  ageMin: number;
  ageMax: number;
  gender: "ALL" | "MALE" | "FEMALE";
  interestKeywords: string[];
  advantageAudience: boolean;
  reasoning: string;
  customAudienceIdeas: string[];
};

export function suggestAudience(product: string, goal: string) {
  return askJson<AudienceSuggestion>(
    "audience",
    "heavy",
    `${MARKETER} You specialise in Meta Ads and TikTok Ads targeting. Reply in English.`,
    `Suggest an ad audience.\nProduct/service: ${product}\nObjective: ${goal}\n\n` +
      `Format: {"countries":["MY"],"ageMin":18,"ageMax":45,"gender":"ALL|MALE|FEMALE",` +
      `"interestKeywords":["3-8 English interest keywords suited to Meta/TikTok interest search"],` +
      `"advantageAudience":true,"reasoning":"why, briefly","customAudienceIdeas":["e.g. people who watched 50% of our videos in the last 30 days"]}`,
    2000,
  );
}

export type CampaignStats = {
  id: string;
  name: string;
  network: string;
  status: string;
  currency: string;
  dailyBudget: number | null;
  days: { date: string; spend: number; impressions: number; clicks: number; videoViews: number; conversions: number }[];
};

export type AnalysisResult = {
  summary: string;
  recommendations: {
    campaignId: string | null;
    kind: "PAUSE" | "RESUME" | "SET_BUDGET" | "INFO";
    newDailyBudget?: number;
    title: string;
    reason: string;
  }[];
};

export function analyseCampaigns(campaigns: CampaignStats[]) {
  return askJson<AnalysisResult>(
    "analysis",
    "heavy",
    `${MARKETER} You review ad performance daily and give actionable recommendations in English. ` +
      "The owner approves every recommendation before it runs. Be careful with money: " +
      "never suggest raising a budget more than 30% in a day, and don't decide on fewer than 3 days of data unless spend is high with no clicks.",
    `Last 7 days of data (JSON):\n${JSON.stringify(campaigns)}\n\n` +
      `Work out CTR, CPC, CPM and cost per view yourself. Format: {"summary":"2-4 sentence summary",` +
      `"recommendations":[{"campaignId":"id from the data or null","kind":"PAUSE|RESUME|SET_BUDGET|INFO",` +
      `"newDailyBudget":20,"title":"short title","reason":"reason with numbers"}]}. At most 6 recommendations.`,
    4000,
  );
}
