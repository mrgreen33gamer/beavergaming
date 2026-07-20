"use client";

import { useCallback, useEffect, useState } from "react";
import { subscribeBalance, notifyBalanceChanged } from "@/lib/platform/balanceBus";
import { initialGarage, normalizeGarage, type GarageState } from "./content/cars/garage";

const ENDPOINT = "/api/games/crash-course/garage";

interface GarageResponse extends GarageState {
  balance: number;
  ok?: boolean;
  reason?: string;
}

export interface UseGarageResult {
  owned: string[];
  selected: string;
  balance: number;
  /** Returns true when the purchase went through. */
  buy: (carId: string) => Promise<boolean>;
  select: (carId: string) => Promise<void>;
}

/**
 * Client view of the server-authoritative garage. The route owns the truth
 * (spend + ownership); this hook mirrors it and keeps the shop balance live as
 * runs earn tokens (via balanceBus) and as purchases spend them.
 */
export function useGarage(): UseGarageResult {
  const [state, setState] = useState<GarageState>(initialGarage());
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch(ENDPOINT, { credentials: "include" });
        if (!res.ok) return;
        const data = (await res.json()) as GarageResponse;
        if (!active) return;
        setState(normalizeGarage(data));
        if (typeof data.balance === "number") setBalance(data.balance);
      } catch {
        // Offline: keep the starter-only defaults so the intro still renders.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Earnings from a completed run are published here by useCartridge; mirror
  // them so the shop can afford newly-earned tokens without a reload.
  useEffect(() => subscribeBalance(setBalance), []);

  const buy = useCallback(async (carId: string): Promise<boolean> => {
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "buy", carId }),
      });
      const data = (await res.json()) as GarageResponse;
      setState(normalizeGarage(data));
      if (typeof data.balance === "number") {
        setBalance(data.balance);
        notifyBalanceChanged(data.balance); // keep shell chrome in step
      }
      return Boolean(data.ok);
    } catch {
      return false;
    }
  }, []);

  const select = useCallback(async (carId: string): Promise<void> => {
    // Optimistic: only if already owned (the route enforces this too).
    setState((s) => (s.owned.includes(carId) ? { ...s, selected: carId } : s));
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "select", carId }),
      });
      const data = (await res.json()) as GarageResponse;
      setState(normalizeGarage(data));
    } catch {
      // Keep the optimistic selection; it re-syncs on next load.
    }
  }, []);

  return { owned: state.owned, selected: state.selected, balance, buy, select };
}
