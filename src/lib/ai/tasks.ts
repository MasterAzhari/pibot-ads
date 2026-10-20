import { askJson } from ".";

const MARKETER =
  "Anda pakar pemasaran media sosial untuk pasaran Malaysia (Facebook, Instagram, Threads, TikTok). " +
  "Tulis dalam Bahasa Melayu santai yang sesuai dengan jenama, kecuali diminta lain.";

export type CaptionIdea = { caption: string; hashtags: string[] };

export function suggestCaptions(brief: string, platforms: string[]) {
  return askJson<{ options: CaptionIdea[] }>(
    "caption",
    "light",
    MARKETER,
    `Buat 3 pilihan caption untuk post ini.\nPlatform: ${platforms.join(", ") || "semua"}\nBrief: ${brief}\n\n` +
      `Format: {"options":[{"caption":"...","hashtags":["#..."]}]}. Hook kuat di baris pertama, CTA jelas, maksimum 8 hashtag.`,
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

export function planVideo(brief: string, lengthSeconds: number) {
  return askJson<VideoPlan>(
    "video",
    "light",
    MARKETER + " Anda juga penulis skrip video pendek 9:16 untuk TikTok dan Reels.",
    `Rancang video ${lengthSeconds} saat untuk: ${brief}\n\n` +
      `Format: {"hook":"ayat 3 saat pertama","scenes":[{"seconds":"0-3","visual":"...","voiceover":"...","onScreenText":"..."}],` +
      `"cta":"...","caption":"...","tips":["tip penggambaran / suntingan"]}`,
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
    MARKETER + " Anda pakar targeting Meta Ads dan TikTok Ads.",
    `Cadangkan audience untuk iklan.\nProduk/servis: ${product}\nObjektif: ${goal}\n\n` +
      `Format: {"countries":["MY"],"ageMin":18,"ageMax":45,"gender":"ALL|MALE|FEMALE",` +
      `"interestKeywords":["kata kunci minat dalam BAHASA INGGERIS, 3-8 item, sesuai untuk carian interest Meta/TikTok"],` +
      `"advantageAudience":true,"reasoning":"kenapa, ringkas","customAudienceIdeas":["cth: orang yang tonton 50% video kita 30 hari lepas"]}`,
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
    MARKETER +
      " Anda menganalisis prestasi iklan setiap hari dan memberi cadangan yang boleh dibuat. " +
      "Pemilik akan approve setiap cadangan sebelum dilaksanakan. Bersikap berhati-hati dengan duit: " +
      "jangan cadang naik bajet lebih 30% sehari, dan jangan buat keputusan atas data kurang 3 hari kecuali spend tinggi tanpa klik.",
    `Data 7 hari lepas (JSON):\n${JSON.stringify(campaigns)}\n\n` +
      `Kira sendiri CTR, CPC, CPM, kos per tontonan. Format: {"summary":"ringkasan 2-4 ayat",` +
      `"recommendations":[{"campaignId":"id dari data atau null","kind":"PAUSE|RESUME|SET_BUDGET|INFO",` +
      `"newDailyBudget":20,"title":"tajuk pendek","reason":"sebab dengan nombor"}]}. Maksimum 6 cadangan.`,
    4000,
  );
}
