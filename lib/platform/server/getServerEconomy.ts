import { cookies } from "next/headers";
import { Economy } from "@/lib/platform/economy";
import { SaveApi } from "@/lib/platform/save";
import { selectServerAdapter } from "@/lib/platform/storage/selectServer";
import { getCurrentUser } from "@/lib/auth/server";
import { MemoryAdapter } from "./memoryAdapter";
import type { StorageAdapter } from "@/lib/platform/storage/types";

const COOKIE = "bg_sid";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

let cachedAdapter: StorageAdapter | null = null;

export function getServerAdapter(): StorageAdapter {
  if (cachedAdapter) return cachedAdapter;
  const uri = process.env.MONGODB_URI?.trim();
  if (uri) {
    cachedAdapter = selectServerAdapter({
      MONGODB_URI: uri,
      MONGODB_DB: process.env.MONGODB_DB ?? "beavergaming",
    });
  } else {
    cachedAdapter = new MemoryAdapter();
  }
  return cachedAdapter;
}

/** The anonymous guest id for this browser, minting one if absent. */
export async function resolveGuestId(): Promise<string> {
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

/**
 * The id the ledger is keyed by: the account id when signed in, otherwise the
 * guest cookie. Signing in therefore switches a player onto their account
 * ledger, which is what makes balances follow them across devices.
 *
 * The guest cookie is deliberately left in place on sign-in so signing out
 * returns to the same guest ledger rather than minting a fresh one.
 */
export async function resolveServerPlayerId(): Promise<string> {
  const user = await getCurrentUser();
  if (user) return user.id;
  return resolveGuestId();
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
