import { NextResponse } from "next/server";
import { getServerEconomy } from "@/lib/platform/server/getServerEconomy";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { gameId?: string; score?: number };
    const gameId = typeof body.gameId === "string" ? body.gameId : "";
    const score = typeof body.score === "number" ? body.score : NaN;
    if (!gameId || !Number.isFinite(score)) {
      return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }

    const { economy, save } = await getServerEconomy();
    const isRecord = await save.setHighScore(gameId, score);
    const granted = await economy.applyScore(gameId, score);
    const balance = await economy.getBalance();
    return NextResponse.json({ granted, balance, isRecord });
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
