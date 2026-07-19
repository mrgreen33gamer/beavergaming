import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthStore } from "@/lib/auth/server";
import { destroySession, SESSION_COOKIE } from "@/lib/auth/session";

export async function POST() {
  const jar = await cookies();
  const sid = jar.get(SESSION_COOKIE)?.value;

  await destroySession(getAuthStore(), sid);
  jar.delete(SESSION_COOKIE);

  // The guest cookie is left intact, so signing out drops back to the same
  // guest ledger the player had before signing in.
  return NextResponse.json({ ok: true });
}
