import "server-only";

import { getAuthStore } from "@/lib/auth/server";
import { getCurrentUser } from "@/lib/auth/server";
import { Economy } from "@/lib/platform/economy";
import { earnMultiplier, levelFromXp, rankFor, xpForTokens } from "@/lib/platform/progression";
import { getServerAdapter, resolveGuestId } from "./getServerEconomy";

export interface GrantOutcome {
  granted: number;
  balance: number;
  /** Present when nothing was granted for a reason worth telling the player. */
  reason?: "account_required";
  signedIn: boolean;
  xp: number;
  level: number;
  rank: string;
  leveledUpTo?: number;
}

/**
 * The single place tokens are granted from a request.
 *
 * Both economy routes go through here so the account gate, the rank
 * multiplier and the XP award cannot drift apart — which they would if each
 * route re-implemented them.
 */
export async function grantForRequest(
  gameId: string,
  apply: (economy: Economy) => Promise<number>,
  /**
   * Identifies one run. The client sends the same value on the normal fetch
   * and on the unload beacon, so a run whose response was lost in transit is
   * retried without being paid twice.
   */
  runId?: string,
): Promise<GrantOutcome> {
  const user = await getCurrentUser();
  const storage = getServerAdapter();

  if (!user) {
    // Guests play everything and earn nothing. This is not an error — being
    // signed out is a normal state — so it returns 200 with a reason the UI
    // can explain, rather than a failure the game has to handle.
    const guestId = await resolveGuestId();
    const balance = await new Economy(storage, guestId).getBalance();
    return {
      granted: 0,
      balance,
      reason: "account_required",
      signedIn: false,
      xp: 0,
      level: 1,
      rank: rankFor(1).name,
    };
  }

  const levelBefore = levelFromXp(user.xp ?? 0);
  const economy = new Economy(
    storage,
    user.id,
    () => new Date(),
    earnMultiplier(levelBefore),
  );

  // Idempotency check happens after the economy is built but before any
  // grant, so a duplicate costs one read and never touches the ledger.
  if (runId) {
    const seen = await storage.get<boolean>("grant-run", `${user.id}:${runId}`);
    if (seen) {
      const level = levelFromXp(user.xp ?? 0);
      return {
        granted: 0,
        balance: await economy.getBalance(),
        signedIn: true,
        xp: user.xp ?? 0,
        level,
        rank: rankFor(level).name,
      };
    }
  }

  const granted = await apply(economy);
  if (runId) await storage.set("grant-run", `${user.id}:${runId}`, true);
  const balance = await economy.getBalance();

  let xp = user.xp ?? 0;
  if (granted > 0) {
    // XP is derived from tokens actually granted, after caps — so it inherits
    // every anti-farming property the token economy already has.
    xp = await getAuthStore().addXp(user.id, xpForTokens(granted));
  }

  const level = levelFromXp(xp);
  return {
    granted,
    balance,
    signedIn: true,
    xp,
    level,
    rank: rankFor(level).name,
    leveledUpTo: level > levelBefore ? level : undefined,
  };
}
