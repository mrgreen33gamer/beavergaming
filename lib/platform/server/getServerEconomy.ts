import { cookies } from "next/headers";
import { Economy } from "@/lib/platform/economy";
import { SaveApi } from "@/lib/platform/save";
import { selectAdapter } from "@/lib/platform/storage";
import { MemoryAdapter } from "./memoryAdapter";
import type { StorageAdapter } from "@/lib/platform/storage/types";

const COOKIE = "bg_sid";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

let cachedAdapter: StorageAdapter | null = null;

function getServerAdapter(): StorageAdapter {
  if (cachedAdapter) return cachedAdapter;
  const uri = process.env.MONGODB_URI;
  if (uri) {
    cachedAdapter = selectAdapter({ MONGODB_URI: uri });
  } else {
    cachedAdapter = new MemoryAdapter();
  }
  return cachedAdapter;
}

export async function resolveServerPlayerId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(COOKIE)?.value;
  if (existing && /^anon-[a-z0-9]+$/i.test(existing)) {
    return existing;
  }
  const id = `anon-${Math.random().toString(36).slice(2, 12)}`;
  jar.set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
  return id;
}

export async function getServerEconomy(): Promise<{
  economy: Economy;
  save: SaveApi;
  playerId: string;
}> {
  const playerId = await resolveServerPlayerId();
  const storage = getServerAdapter();
  return {
    economy: new Economy(storage, playerId),
    save: new SaveApi(storage),
    playerId,
  };
}
