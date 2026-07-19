import { NextResponse } from "next/server";
import { getServerEconomy } from "@/lib/platform/server/getServerEconomy";
import { getCurrentUser } from "@/lib/auth/server";
import { GLOBAL_DAILY_CAP, rateFor } from "@/lib/platform/earnRates";
import { levelFromXp, rankFor, earnMultiplier } from "@/lib/platform/progression";

/**
 * Everything the in-game earnings panel needs, in one round trip: what this
 * game pays, how much of today's caps are already spent, and who the player
 * is. Kept server-side because rates and caps are platform-owned — a client
 * that could compute its own payout could argue about it.
 */
export async function GET(req: Request) {
  const gameId = new URL(req.url).searchParams.get("gameId") ?? "";

  try {
    const user = await getCurrentUser();
    const { economy } = await getServerEconomy();

    const [balance, earnedToday, earnedTodayGame] = await Promise.all([
      economy.getBalance(),
      economy.earnedToday(),
      gameId ? economy.earnedToday(gameId) : Promise.resolve(0),
    ]);

    const rate = gameId ? rateFor(gameId) : null;
    const xp = user?.xp ?? 0;
    const level = levelFromXp(xp);

    return NextResponse.json({
      signedIn: Boolean(user),
      balance,
      earnedToday,
      globalCap: GLOBAL_DAILY_CAP,
      gameCap: rate?.dailyCap ?? null,
      earnedTodayGame,
      tokensPerPoint: rate?.tokensPerPoint ?? null,
      xp,
      level,
      rank: rankFor(level).name,
      earnMultiplier: earnMultiplier(level),
    });
  } catch {
    // The panel is decoration; a failure here must never break a game.
    return NextResponse.json({ signedIn: false, balance: 0 }, { status: 200 });
  }
}
