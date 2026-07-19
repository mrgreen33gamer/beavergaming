"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CartridgeHost } from "./cartridge";
import { getStorage } from "./storage";
import { Economy } from "./economy";
import { SaveApi } from "./save";
import { getPlayerId } from "./player";
import { subscribeGamePause } from "./pauseBus";
import { notifyBalanceChanged } from "./balanceBus";

export interface UseCartridgeResult {
  /** Pass this to game code. It is the entire trusted surface. */
  host: CartridgeHost;
  highScore: number;
  balance: number;
  /** Tokens granted by the most recent report — for "+5 B-Tokens" toasts. */
  lastAward: number;
}

/**
 * Prefer the server economy API (authoritative rates + httpOnly session).
 * Fall back to client Economy when offline or API is unavailable.
 */
async function postScore(
  gameId: string,
  score: number,
): Promise<{ granted: number; balance: number; isRecord: boolean } | null> {
  try {
    const res = await fetch("/api/economy/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ gameId, score }),
    });
    if (!res.ok) return null;
    return (await res.json()) as {
      granted: number;
      balance: number;
      isRecord: boolean;
    };
  } catch {
    return null;
  }
}

async function postEvent(
  gameId: string,
  name: string,
): Promise<{ granted: number; balance: number } | null> {
  try {
    const res = await fetch("/api/economy/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ gameId, name }),
    });
    if (!res.ok) return null;
    return (await res.json()) as { granted: number; balance: number };
  } catch {
    return null;
  }
}

async function fetchServerBalance(): Promise<number | null> {
  try {
    const res = await fetch("/api/economy/balance", { credentials: "include" });
    if (!res.ok) return null;
    const data = (await res.json()) as { balance: number | null };
    return typeof data.balance === "number" ? data.balance : null;
  } catch {
    return null;
  }
}

/**
 * Adopting the platform from a canvas game is three lines:
 *
 *   const { host, highScore } = useCartridge("pong");
 *   ...
 *   host.reportScore(finalScore);
 */
export function useCartridge(gameId: string): UseCartridgeResult {
  const [highScore, setHighScore] = useState(0);
  const [balance, setBalance] = useState(0);
  const [lastAward, setLastAward] = useState(0);

  const pauseCbs = useRef<Array<() => void>>([]);
  const resumeCbs = useRef<Array<() => void>>([]);

  const { economy, save } = useMemo(() => {
    const storage = getStorage();
    return {
      economy: new Economy(storage, getPlayerId()),
      save: new SaveApi(storage),
    };
  }, []);

  const publishBalance = useCallback((b: number) => {
    setBalance(b);
    notifyBalanceChanged(b);
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const [hs, serverBal, clientBal] = await Promise.all([
        save.getHighScore(gameId),
        fetchServerBalance(),
        economy.getBalance(),
      ]);
      if (!active) return;
      setHighScore(hs);
      // Prefer server balance when the API is up.
      publishBalance(serverBal ?? clientBal);
    })();
    return () => {
      active = false;
    };
  }, [gameId, save, economy, publishBalance]);

  useEffect(() => {
    return subscribeGamePause((paused) => {
      const list = paused ? pauseCbs.current : resumeCbs.current;
      for (const cb of list) {
        try {
          cb();
        } catch {
          // ignore game callback errors
        }
      }
    });
  }, []);

  const reportScore = useCallback(
    (score: number) => {
      void (async () => {
        const remote = await postScore(gameId, score);
        if (remote) {
          if (remote.isRecord) setHighScore(score);
          setLastAward(remote.granted);
          publishBalance(remote.balance);
          // Mirror high score into client save for offline reads / legacy.
          if (remote.isRecord) await save.setHighScore(gameId, score);
          return;
        }
        // Offline / API down — client authority (Phase 1 fallback).
        const isRecord = await save.setHighScore(gameId, score);
        if (isRecord) setHighScore(score);
        const granted = await economy.applyScore(gameId, score);
        setLastAward(granted);
        if (granted > 0) publishBalance(await economy.getBalance());
      })();
    },
    [gameId, save, economy, publishBalance],
  );

  const reportEvent = useCallback(
    (name: string, value?: number) => {
      void value;
      void (async () => {
        const remote = await postEvent(gameId, name);
        if (remote) {
          setLastAward(remote.granted);
          publishBalance(remote.balance);
          return;
        }
        const granted = await economy.applyEvent(gameId, name);
        setLastAward(granted);
        if (granted > 0) publishBalance(await economy.getBalance());
      })();
    },
    [gameId, economy, publishBalance],
  );

  const host = useMemo<CartridgeHost>(
    () => ({
      reportScore,
      reportEvent,
      saveState: (key, value) => save.setState(gameId, key, value),
      loadState: <T,>(key: string) => save.getState<T>(gameId, key),
      onPause: (cb) => {
        pauseCbs.current.push(cb);
      },
      onResume: (cb) => {
        resumeCbs.current.push(cb);
      },
    }),
    [gameId, reportScore, reportEvent, save],
  );

  return { host, highScore, balance, lastAward };
}
