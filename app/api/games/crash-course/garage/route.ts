import { NextResponse } from "next/server";
import { getServerEconomy } from "@/lib/platform/server/getServerEconomy";
import { getCar } from "@/app/games/crash-course/content/cars";
import {
  normalizeGarage,
  addOwned,
  selectCar,
  initialGarage,
  type GarageState,
} from "@/app/games/crash-course/content/cars/garage";
import type { SaveApi } from "@/lib/platform/save";

const GAME_ID = "crash-course";
const STATE_KEY = "garage";

async function loadGarage(save: SaveApi, stateKey: string): Promise<GarageState> {
  const raw = await save.getState<GarageState>(GAME_ID, stateKey);
  return normalizeGarage(raw ?? initialGarage());
}

function fail(err: unknown) {
  const message = err instanceof Error ? err.message : "economy error";
  if (message.includes("not implemented")) {
    return NextResponse.json({ error: "mongo_not_ready" }, { status: 503 });
  }
  // Do not leak internal/Mongo error detail to the client.
  console.error("crash-course garage route error:", err);
  return NextResponse.json({ error: "garage error" }, { status: 500 });
}

export async function GET() {
  try {
    const { economy, save, playerId } = await getServerEconomy();
    const stateKey = `${playerId}:${STATE_KEY}`;
    const [garage, balance] = await Promise.all([
      loadGarage(save, stateKey),
      economy.getBalance(),
    ]);
    return NextResponse.json({ ...garage, balance });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: Request) {
  let body: { action?: string; carId?: string };
  try {
    body = (await req.json()) as { action?: string; carId?: string };
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const action = body.action;
  const carId = typeof body.carId === "string" ? body.carId : "";
  if (!carId || (action !== "buy" && action !== "select")) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  try {
    const { economy, save, playerId } = await getServerEconomy();
    // Namespace the persisted garage by player so ownership never leaks
    // across accounts/guests — SaveApi's own key has no player scoping.
    const stateKey = `${playerId}:${STATE_KEY}`;
    let garage = await loadGarage(save, stateKey);

    if (action === "select") {
      if (!garage.owned.includes(carId)) {
        return NextResponse.json(
          { ok: false, reason: "not_owned", ...garage, balance: await economy.getBalance() },
        );
      }
      garage = selectCar(garage, carId);
      await save.setState(GAME_ID, stateKey, garage);
      return NextResponse.json({ ok: true, ...garage, balance: await economy.getBalance() });
    }

    // action === "buy" — price is taken from the trusted registry, never the client.
    const car = getCar(carId);
    if (car.id !== carId) {
      // getCar fell back to the starter → unknown id.
      return NextResponse.json(
        { ok: false, reason: "invalid_car", ...garage, balance: await economy.getBalance() },
        { status: 400 },
      );
    }
    // Already owned (or the free starter): idempotent no-op, never charged twice.
    if (garage.owned.includes(carId) || car.price <= 0) {
      garage = addOwned(garage, carId);
      await save.setState(GAME_ID, stateKey, garage);
      return NextResponse.json({ ok: true, ...garage, balance: await economy.getBalance() });
    }

    const paid = await economy.spend(car.price, "purchase", GAME_ID);
    if (!paid) {
      return NextResponse.json(
        { ok: false, reason: "insufficient", ...garage, balance: await economy.getBalance() },
      );
    }
    garage = addOwned(garage, carId);
    await save.setState(GAME_ID, stateKey, garage);
    return NextResponse.json({ ok: true, ...garage, balance: await economy.getBalance() });
  } catch (err) {
    return fail(err);
  }
}
