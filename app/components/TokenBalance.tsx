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

    void (async () => {
      // Prefer server ledger when available.
      try {
        const res = await fetch("/api/economy/balance", {
          credentials: "include",
        });
        if (res.ok) {
          const data = (await res.json()) as { balance: number | null };
          if (active && typeof data.balance === "number") {
            setBalance(data.balance);
            return;
          }
        }
      } catch {
        // fall through to client
      }
      const b = await economy.getBalance();
      if (active) setBalance(b);
    })();

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
      title="B-Tokens are free-play currency. Server ledger when online; this device as fallback."
      className="flex items-center gap-1 font-[family-name:var(--font-mono)] text-base text-[var(--accent)]"
    >
      <span aria-hidden="true">🪙</span>
      <span className="sr-only">B-Tokens:</span>
      <span>{balance}</span>
    </span>
  );
}
