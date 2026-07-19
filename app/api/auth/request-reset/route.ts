import { NextResponse } from "next/server";
import { getAuthStore } from "@/lib/auth/server";
import { issueToken } from "@/lib/auth/tokens";
import { resetEmailTemplate, sendEmail, siteUrl } from "@/lib/email";

/**
 * Always reports success, whether or not the address is registered. Telling
 * the caller "no such account" would turn this endpoint into a free
 * membership oracle.
 */
export async function POST(req: Request) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const generic = NextResponse.json({
    ok: true,
    message: "If that email has an account, a reset link is on its way.",
  });

  if (!email) return generic;

  try {
    const store = getAuthStore();
    const user = await store.findUserByEmail(email);
    if (user) {
      const token = await issueToken(store, user.id, "reset");
      const tpl = resetEmailTemplate(user.displayName, `${siteUrl()}/reset/${token.id}`);
      await sendEmail({ ...tpl, to: user.email });
    }
  } catch (err) {
    // Still returns the generic response — a failure here must not reveal
    // whether the address exists.
    console.error("[auth/request-reset]", err);
  }

  return generic;
}
