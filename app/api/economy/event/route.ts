import { NextResponse } from "next/server";
import { grantForRequest } from "@/lib/platform/server/grant";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { gameId?: string; name?: string; runId?: string };
    const gameId = typeof body.gameId === "string" ? body.gameId : "";
    const name = typeof body.name === "string" ? body.name : "";
    if (!gameId || !name) {
      return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }

    const outcome = await grantForRequest(gameId, (economy) =>
      economy.applyEvent(gameId, name),
      typeof body.runId === "string" ? body.runId : undefined,
    );

    return NextResponse.json(outcome);
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
