import { NextResponse } from "next/server";
import { getAuthStore } from "@/lib/auth/server";
import { checkToken, consumeToken } from "@/lib/auth/tokens";

export async function POST(req: Request) {
  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const store = getAuthStore();
  const check = await checkToken(store, (body.token ?? "").trim(), "verify");
  if (!check.ok) {
    return NextResponse.json(
      { error: "That confirmation link is invalid or has expired." },
      { status: 400 },
    );
  }

  await store.updateUser(check.token.userId, { emailVerified: true });
  await consumeToken(store, check.token.id);

  return NextResponse.json({ ok: true });
}
