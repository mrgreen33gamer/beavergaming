import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthStore } from "@/lib/auth/server";
import { hashPassword, validatePassword } from "@/lib/auth/password";
import { checkToken, consumeToken } from "@/lib/auth/tokens";
import { SESSION_COOKIE } from "@/lib/auth/session";

export async function POST(req: Request) {
  let body: { token?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const token = (body.token ?? "").trim();
  const password = body.password ?? "";

  const pwError = validatePassword(password);
  if (pwError) return NextResponse.json({ error: pwError }, { status: 400 });

  const store = getAuthStore();
  const check = await checkToken(store, token, "reset");
  if (!check.ok) {
    return NextResponse.json(
      { error: "That reset link is invalid or has expired. Request a new one." },
      { status: 400 },
    );
  }

  await store.updateUser(check.token.userId, {
    passwordHash: await hashPassword(password),
    // Completing a reset proves control of the mailbox.
    emailVerified: true,
  });

  // Consume only after the password actually changed, so a failure mid-way
  // leaves the link usable rather than burning it.
  await consumeToken(store, check.token.id);

  // Anyone signed in with the old password is signed out — the whole point of
  // a reset is to lock out whoever prompted it.
  await store.deleteSessionsForUser(check.token.userId);
  (await cookies()).delete(SESSION_COOKIE);

  return NextResponse.json({ ok: true });
}
