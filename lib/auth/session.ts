import { randomBytes } from "node:crypto";
import type { AuthStore, Session, User } from "./types";

export const SESSION_COOKIE = "bg_session";
export const SESSION_TTL_DAYS = 30;

/**
 * 32 random bytes, stored server-side and looked up on every request.
 *
 * Opaque rather than a JWT: sessions must be revocable the instant a password
 * changes, and a signed token that stays valid until it expires cannot do
 * that. The lookup cost is one indexed query.
 */
function newSessionId(): string {
  return randomBytes(32).toString("base64url");
}

export async function createSession(
  store: AuthStore,
  userId: string,
  now: () => Date = () => new Date(),
): Promise<Session> {
  const created = now();
  const expires = new Date(created.getTime() + SESSION_TTL_DAYS * 86_400_000);
  const session: Session = {
    id: newSessionId(),
    userId,
    createdAt: created.toISOString(),
    expiresAt: expires.toISOString(),
  };
  await store.createSession(session);
  return session;
}

/**
 * Resolves a session id to its user, or null when the session is unknown or
 * expired. Expired sessions are deleted on read so they do not linger if the
 * database TTL index is slow or absent.
 */
export async function resolveSession(
  store: AuthStore,
  sessionId: string | undefined,
  now: () => Date = () => new Date(),
): Promise<{ session: Session; user: User } | null> {
  if (!sessionId) return null;

  const session = await store.findSession(sessionId);
  if (!session) return null;

  if (new Date(session.expiresAt).getTime() <= now().getTime()) {
    await store.deleteSession(session.id);
    return null;
  }

  const user = await store.findUserById(session.userId);
  if (!user) {
    // Orphaned session — the account is gone.
    await store.deleteSession(session.id);
    return null;
  }

  return { session, user };
}

export async function destroySession(
  store: AuthStore,
  sessionId: string | undefined,
): Promise<void> {
  if (sessionId) await store.deleteSession(sessionId);
}

/** Cookie attributes shared by every set-session response. */
export function sessionCookieOptions(expiresAt: string) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(expiresAt),
  };
}
