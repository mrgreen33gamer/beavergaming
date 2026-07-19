import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthStore, publicUser } from "@/lib/auth/server";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth/session";
import { mergeGuestBalance } from "@/lib/auth/mergeBalance";
import { getServerAdapter, resolveGuestId } from "@/lib/platform/server/getServerEconomy";

/**
 * Verifying against a throwaway hash when the account does not exist keeps the
 * response time of "no such user" close to that of "wrong password", so the
 * endpoint does not leak which emails are registered.
 */
const DUMMY_HASH_PROMISE = hashPassword("timing-equalizer-not-a-real-password");

/** Small in-process limiter. Resets on cold start, which is acceptable here. */
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60_000;
const MAX_ATTEMPTS = 10;

function rateLimited(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

export async function POST(req: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimited(`${ip}:${email}`)) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a few minutes." },
      { status: 429 },
    );
  }

  const store = getAuthStore();
  const user = await store.findUserByEmail(email);

  const ok = user
    ? await verifyPassword(password, user.passwordHash)
    : (await verifyPassword(password, await DUMMY_HASH_PROMISE), false);

  if (!user || !ok) {
    // Deliberately identical for unknown email and wrong password.
    return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
  }

  let merged = 0;
  try {
    const guestId = await resolveGuestId();
    const result = await mergeGuestBalance(getServerAdapter(), guestId, user.id);
    merged = result.amount;
  } catch (err) {
    console.error("[auth/login] balance merge failed", err);
  }

  const session = await createSession(store, user.id);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, session.id, sessionCookieOptions(session.expiresAt));

  return NextResponse.json({ user: publicUser(user), mergedTokens: merged });
}
