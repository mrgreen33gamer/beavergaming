"use client";

import { useEffect, useState } from "react";
import { getStorage } from "@/lib/platform/storage";
import { Economy } from "@/lib/platform/economy";
import { getPlayerId } from "@/lib/platform/player";
import { subscribeBalance } from "@/lib/platform/balanceBus";

/** Header readout of the player's B-Token balance. */
export default function TokenBalance() {
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    let active = true;
    const economy = new Economy(getStorage(), getPlayerId());
    void economy.getBalance().then((b) => {
      if (active) setBalance(b);
    });
    const unsub = subscribeBalance((b) => {
      if (active) setBalance(b);
    });
    return () => {
      active = false;
      unsub();
    };
  }, []);

  return (
    <span
      aria-label={`${balance} B-Tokens`}
      className="flex items-center gap-1 font-[family-name:var(--font-mono)] text-base text-[var(--accent)]"
    >
      <span aria-hidden="true">🪙</span>
      <span className="sr-only">B-Tokens:</span>
      <span>{balance}</span>
    </span>
  );
}
