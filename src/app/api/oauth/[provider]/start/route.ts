import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, signState, verifySessionToken } from "@/lib/auth";
import { metaAuthorizeUrl } from "@/lib/platforms/meta-graph";
import { threadsAuthorizeUrl } from "@/lib/platforms/threads";
import { tiktokAuthorizeUrl } from "@/lib/platforms/tiktok";
import { tiktokAdsAuthorizeUrl } from "@/lib/ads/tiktok";

const URLS: Record<string, (state: string) => string> = {
  meta: metaAuthorizeUrl,
  threads: threadsAuthorizeUrl,
  tiktok: tiktokAuthorizeUrl,
  "tiktok-ads": tiktokAdsAuthorizeUrl,
};

export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!(await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value))) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  const build = URLS[provider];
  if (!build) return new Response("Provider tidak dikenali", { status: 404 });
  return NextResponse.redirect(build(await signState({ provider })));
}
