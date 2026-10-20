import type { AdAccount, Campaign } from "@prisma/client";

export type Objective = "TRAFFIC" | "AWARENESS" | "ENGAGEMENT" | "VIDEO_VIEWS";

export type Interest = { id: string; name: string; audienceSize?: number };

export type NewCampaignInput = {
  name: string;
  objective: Objective;
  /** Daily budget, ad account currency, major units */
  dailyBudget: number;
  countries: string[];
  ageMin: number;
  ageMax: number;
  gender: "ALL" | "MALE" | "FEMALE";
  interests: Interest[];
  /** Let the network's own AI widen the audience (Meta Advantage+ audience) */
  advantageAudience: boolean;
  mediaId: string;
  primaryText: string;
  headline: string;
  link: string;
  /** e.g. LEARN_MORE, SHOP_NOW, CONTACT_US */
  cta: string;
};

export interface AdsNetwork {
  syncCampaigns(account: AdAccount): Promise<void>;
  syncInsights(account: AdAccount, days: number): Promise<void>;
  setActive(account: AdAccount, campaign: Campaign, active: boolean): Promise<void>;
  setDailyBudget(account: AdAccount, campaign: Campaign, amount: number): Promise<void>;
  searchInterests(account: AdAccount, query: string): Promise<Interest[]>;
  /** Everything is created PAUSED; the owner switches it on from the dashboard. */
  createCampaign(account: AdAccount, input: NewCampaignInput): Promise<string>;
}

export function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
