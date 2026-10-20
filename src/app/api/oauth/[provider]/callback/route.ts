import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, readState, verifySessionToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { env } from "@/lib/env";
import { graph, metaExchangeCode } from "@/lib/platforms/meta-graph";
import { threadsExchangeCode } from "@/lib/platforms/threads";
import { tiktokExchangeCode, tiktokUser } from "@/lib/platforms/tiktok";
import { tiktokAdsExchange } from "@/lib/ads/tiktok";
import type { Platform } from "@prisma/client";

async function upsertAccount(platform: Platform, externalId: string, data: { name: string; avatarUrl?: string; accessToken: string; refreshToken?: string; tokenExpiresAt?: Date; meta?: object }) {
  const row = {
    name: data.name,
    avatarUrl: data.avatarUrl,
    accessToken: encrypt(data.accessToken),
    refreshToken: data.refreshToken ? encrypt(data.refreshToken) : null,
    tokenExpiresAt: data.tokenExpiresAt ?? null,
    meta: data.meta ?? {},
  };
  await db.account.upsert({
    where: { platform_externalId: { platform, externalId } },
    create: { platform, externalId, ...row },
    update: row,
  });
}

async function connectMeta(code: string) {
  const { access_token: userToken } = await metaExchangeCode(code);
  const pages = await graph.get("me/accounts", userToken, {
    fields: "id,name,access_token,picture{url},instagram_business_account{id,username,profile_picture_url}",
    limit: 100,
  });
  let first: { pageId: string; instagramUserId?: string } | undefined;
  for (const p of pages.data as any[]) {
    await upsertAccount("FACEBOOK", p.id, { name: p.name, avatarUrl: p.picture?.data?.url, accessToken: p.access_token });
    const ig = p.instagram_business_account;
    if (ig) {
      await upsertAccount("INSTAGRAM", ig.id, {
        name: `@${ig.username}`,
        avatarUrl: ig.profile_picture_url,
        accessToken: p.access_token,
        meta: { pageId: p.id },
      });
    }
    first ??= { pageId: p.id, instagramUserId: ig?.id };
  }

  const adAccounts = await graph.get("me/adaccounts", userToken, { fields: "account_id,name,currency", limit: 100 });
  for (const a of adAccounts.data as any[]) {
    const externalId = `act_${a.account_id}`;
    const existing = await db.adAccount.findUnique({ where: { network_externalId: { network: "META", externalId } } });
    await db.adAccount.upsert({
      where: { network_externalId: { network: "META", externalId } },
      create: { network: "META", externalId, name: a.name, currency: a.currency, accessToken: encrypt(userToken), meta: first ?? {} },
      // keep the page the owner already picked
      update: { name: a.name, currency: a.currency, accessToken: encrypt(userToken), meta: (existing?.meta as object) ?? first ?? {} },
    });
  }
  return `${pages.data.length} page, ${adAccounts.data.length} ad account`;
}

async function connectThreads(code: string) {
  const t = await threadsExchangeCode(code);
  await upsertAccount("THREADS", t.me.id, {
    name: `@${t.me.username}`,
    avatarUrl: t.me.threads_profile_picture_url,
    accessToken: t.access_token,
    tokenExpiresAt: new Date(Date.now() + t.expires_in * 1000),
  });
  return "Threads";
}

async function connectTiktok(code: string) {
  const t = await tiktokExchangeCode(code);
  const user = await tiktokUser(t.access_token);
  await upsertAccount("TIKTOK", t.open_id, {
    name: user.display_name,
    avatarUrl: user.avatar_url,
    accessToken: t.access_token,
    refreshToken: t.refresh_token,
    tokenExpiresAt: new Date(Date.now() + t.expires_in * 1000),
  });
  return "TikTok";
}

async function connectTiktokAds(code: string) {
  const { accessToken, advertisers } = await tiktokAdsExchange(code);
  for (const a of advertisers) {
    await db.adAccount.upsert({
      where: { network_externalId: { network: "TIKTOK", externalId: String(a.advertiser_id) } },
      create: { network: "TIKTOK", externalId: String(a.advertiser_id), name: a.name, currency: a.currency, accessToken: encrypt(accessToken) },
      update: { name: a.name, currency: a.currency, accessToken: encrypt(accessToken) },
    });
  }
  return `${advertisers.length} TikTok ad account`;
}

export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const url = new URL(req.url);
  const back = (q: string) => NextResponse.redirect(`${env().APP_URL}/accounts?${q}`);
  if (!(await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value))) return NextResponse.redirect(`${env().APP_URL}/login`);

  try {
    const state = await readState(url.searchParams.get("state"));
    if (state.provider !== provider) throw new Error("state mismatch");
    // TikTok Business returns auth_code; everyone else returns code
    const code = url.searchParams.get("code") ?? url.searchParams.get("auth_code");
    if (!code) throw new Error(url.searchParams.get("error_description") ?? url.searchParams.get("error") ?? "No code returned");
    const handlers: Record<string, (c: string) => Promise<string>> = {
      meta: connectMeta,
      threads: connectThreads,
      tiktok: connectTiktok,
      "tiktok-ads": connectTiktokAds,
    };
    const done = await handlers[provider](code);
    return back(`connected=${encodeURIComponent(done)}`);
  } catch (err) {
    return back(`error=${encodeURIComponent(err instanceof Error ? err.message : String(err))}`);
  }
}
