import { randomBytes } from "node:crypto";
import type { AuthStore, AuthToken, AuthTokenType } from "./types";

/** Verification links are long-lived; reset links deliberately are not. */
export const TOKEN_TTL_MINUTES: Record<AuthTokenType, number> = {
  verify: 60 * 24 * 3, // 3 days
  reset: 60, // 1 hour
};

export async function issueToken(
  store: AuthStore,
  userId: string,
  type: AuthTokenType,
  now: () => Date = () => new Date(),
): Promise<AuthToken> {
  const created = now();
  const token: AuthToken = {
    id: randomBytes(32).toString("base64url"),
    userId,
    type,
    expiresAt: new Date(created.getTime() + TOKEN_TTL_MINUTES[type] * 60_000).toISOString(),
    usedAt: null,
  };
  await store.createToken(token);
  return token;
}

export type TokenFailure = "not_found" | "wrong_type" | "expired" | "used";

/**
 * Validates a token without consuming it. Callers consume via consumeToken so
 * that a token is only spent once the action it authorizes has succeeded.
 */
export async function checkToken(
  store: AuthStore,
  id: string,
  type: AuthTokenType,
  now: () => Date = () => new Date(),
): Promise<{ ok: true; token: AuthToken } | { ok: false; reason: TokenFailure }> {
  const token = await store.findToken(id);
  if (!token) return { ok: false, reason: "not_found" };
  if (token.type !== type) return { ok: false, reason: "wrong_type" };
  if (token.usedAt) return { ok: false, reason: "used" };
  if (new Date(token.expiresAt).getTime() <= now().getTime()) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true, token };
}

export async function consumeToken(store: AuthStore, id: string): Promise<void> {
  await store.markTokenUsed(id);
}
