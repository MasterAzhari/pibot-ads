import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { env } from "./env";

const COOKIE = "pibot_session";

function secret() {
  return new TextEncoder().encode(env().APP_SECRET);
}

function same(a: string, b: string) {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function checkCredentials(email: string, password: string) {
  const e = env();
  return same(email.trim().toLowerCase(), e.ADMIN_EMAIL.toLowerCase()) && same(password, e.ADMIN_PASSWORD);
}

export async function createSession(email: string) {
  const token = await new SignJWT({ email }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("30d").sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: env().APP_URL.startsWith("https"),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function verifySessionToken(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as { email: string };
  } catch {
    return null;
  }
}

export async function requireUser() {
  const user = await verifySessionToken((await cookies()).get(COOKIE)?.value);
  if (!user) redirect("/login");
  return user;
}

export const SESSION_COOKIE = COOKIE;

/** Short-lived signed value for OAuth `state`, so callbacks can't be forged. */
export async function signState(data: Record<string, string>) {
  return new SignJWT(data).setProtectedHeader({ alg: "HS256" }).setExpirationTime("15m").sign(secret());
}

export async function readState(state: string | null) {
  if (!state) throw new Error("missing state");
  const { payload } = await jwtVerify(state, secret());
  return payload as Record<string, string>;
}
