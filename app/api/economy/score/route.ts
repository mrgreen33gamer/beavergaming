import { NextResponse } from "next/server";
import { grantForRequest } from "@/lib/platform/server/grant";
import { getServerEconomy } from "@/lib/platform/server/getServerEconomy";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { gameId?: string; score?: number; runId?: string };
    const gameId = typeof body.gameId === "string" ? body.gameId : "";
    const score = typeof body.score === "number" ? body.score : NaN;
    if (!gameId || !Number.isFinite(score)) {
      return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }

    // High score tracking is deliberately independent of earning: a guest
    // still gets a leaderboard, they just do not get paid for it.
    const { save } = await getServerEconomy();
    const isRecord = await save.setHighScore(gameId, score);

    const outcome = await grantForRequest(gameId, (economy) =>
      economy.applyScore(gameId, score),
      typeof body.runId === "string" ? body.runId : undefined,
    );

    return NextResponse.json({ ...outcome, isRecord });
  } catch (err) {
    const message = err instanceof Error ? err.message : "economy error";
    if (message.includes("not implemented")) {
      return NextResponse.json(
        { error: "mongo_not_ready" },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
