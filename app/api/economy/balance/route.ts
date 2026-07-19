import { NextResponse } from "next/server";
import { getServerEconomy } from "@/lib/platform/server/getServerEconomy";

export async function GET() {
  try {
    const { economy } = await getServerEconomy();
    const balance = await economy.getBalance();
    return NextResponse.json({ balance });
  } catch (err) {
    const message = err instanceof Error ? err.message : "economy error";
    // Mongo stub throws until Phase 2 is implemented — fall back signal.
    if (message.includes("not implemented")) {
      return NextResponse.json(
        { balance: null, reason: "mongo_not_ready" },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
