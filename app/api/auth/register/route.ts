import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthStore, publicUser } from "@/lib/auth/server";
import { hashPassword, validatePassword } from "@/lib/auth/password";
import { createSession, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth/session";
import { issueToken } from "@/lib/auth/tokens";
import { mergeGuestBalance } from "@/lib/auth/mergeBalance";
import { DuplicateEmailError } from "@/lib/auth/types";
import { getServerAdapter, resolveGuestId } from "@/lib/platform/server/getServerEconomy";
import { sendEmail, siteUrl, verifyEmailTemplate } from "@/lib/email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  let body: { email?: string; password?: string; displayName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const displayName = (body.displayName ?? "").trim().slice(0, 40) || email.split("@")[0];

  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  const pwError = validatePassword(password);
  if (pwError) {
    return NextResponse.json({ error: pwError }, { status: 400 });
  }

  const store = getAuthStore();
  let user;
  try {
    user = await store.createUser({
      email,
      passwordHash: await hashPassword(password),
      displayName,
      emailVerified: false,
      xp: 0,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    if (err instanceof DuplicateEmailError) {
      // Registration is the one place enumeration cannot be fully avoided —
      // the address genuinely cannot be reused. Keep the wording neutral and
      // point at recovery rather than confirming account state outright.
      return NextResponse.json(
        { error: "That email can't be used. If it's yours, try signing in or resetting your password." },
        { status: 409 },
      );
    }
    console.error("[auth/register]", err);
    return NextResponse.json({ error: "Could not create the account." }, { status: 500 });
  }

  // Carry the guest's tokens onto the new account before the session flips
  // the active ledger over.
  let merged = 0;
  try {
    const guestId = await resolveGuestId();
    const result = await mergeGuestBalance(getServerAdapter(), guestId, user.id);
    merged = result.amount;
  } catch (err) {
    // A failed merge must not fail the signup; the account is already valid.
    console.error("[auth/register] balance merge failed", err);
  }

  const session = await createSession(store, user.id);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, session.id, sessionCookieOptions(session.expiresAt));

  try {
    const token = await issueToken(store, user.id, "verify");
    const tpl = verifyEmailTemplate(user.displayName, `${siteUrl()}/verify/${token.id}`);
    await sendEmail({ ...tpl, to: user.email });
  } catch (err) {
    console.error("[auth/register] verification email failed", err);
  }

  return NextResponse.json({ user: publicUser(user), mergedTokens: merged });
}
