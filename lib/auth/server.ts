import "server-only";

import { cookies } from "next/headers";
import { MemoryAuthStore } from "./memoryStore";
import { MongoAuthStore } from "./mongoStore";
import { SESSION_COOKIE, resolveSession } from "./session";
import type { AuthStore, User } from "./types";

let cached: AuthStore | null = null;

/**
 * Mongo when configured, in-memory otherwise, mirroring how the economy picks
 * its storage adapter. The in-memory fallback keeps local development and
 * preview deploys working without a database; accounts simply do not survive
 * a restart there.
 */
export function getAuthStore(): AuthStore {
  if (cached) return cached;
  const uri = process.env.MONGODB_URI?.trim();
  cached = uri ? new MongoAuthStore(uri) : new MemoryAuthStore();
  return cached;
}

/** The signed-in user, or null. Never throws. */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const jar = await cookies();
    const sid = jar.get(SESSION_COOKIE)?.value;
    const resolved = await resolveSession(getAuthStore(), sid);
    return resolved?.user ?? null;
  } catch {
    return null;
  }
}

/** Public shape safe to send to the browser — never includes the hash. */
export function publicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    emailVerified: user.emailVerified,
  };
}
