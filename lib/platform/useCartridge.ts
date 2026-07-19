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
      const [hs, bal] = await Promise.all([
        save.getHighScore(gameId),
        economy.getBalance(),
      ]);
      if (!active) return;
      setHighScore(hs);
      publishBalance(bal);
    })();
    return () => {
      active = false;
    };
  }, [gameId, save, economy, publishBalance]);

  // Fan GameShell pause bus into host.onPause / onResume callbacks.
  useEffect(() => {
    return subscribeGamePause((paused) => {
      const list = paused ? pauseCbs.current : resumeCbs.current;
      for (const cb of list) {
        try {
          cb();
        } catch {
          // Game callbacks must not break the shell.
        }
      }
    });
  }, []);

  const reportScore = useCallback(
    (score: number) => {
      void (async () => {
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
      void value; // reserved for future weighted events
      void (async () => {
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
