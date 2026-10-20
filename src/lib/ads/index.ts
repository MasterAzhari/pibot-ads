import type { AdNetwork } from "@prisma/client";
import { metaAds } from "./meta";
import { tiktokAds } from "./tiktok";
import type { AdsNetwork } from "./types";

export const adsNetworks: Record<AdNetwork, AdsNetwork> = { META: metaAds, TIKTOK: tiktokAds };

export { type NewCampaignInput, type Objective, type Interest } from "./types";
