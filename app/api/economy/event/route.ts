import { NextResponse } from "next/server";
import { getServerEconomy } from "@/lib/platform/server/getServerEconomy";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { gameId?: string; name?: string };
    const gameId = typeof body.gameId === "string" ? body.gameId : "";
    const name = typeof body.name === "string" ? body.name : "";
    if (!gameId || !name) {
      return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }

    const { economy } = await getServerEconomy();
    const granted = await economy.applyEvent(gameId, name);
    const balance = await economy.getBalance();
    return NextResponse.json({ granted, balance });
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
