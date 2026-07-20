"use client";

import { CARS } from "./content/cars";
import { buyable, isOwned } from "./content/cars/garage";
import type { UseGarageResult } from "./useGarage";

/**
 * Intro-screen shop. Each car is one of: SELECTED (active), OWNED (click to
 * select), BUYABLE (afford → BUY), or LOCKED (can't afford, greyed). Buying
 * spends real B-Tokens through the server route; selection is free.
 */
export default function Garage({ state }: { state: UseGarageResult }) {
  const { owned, selected, balance, buy, select } = state;
  const gstate = { owned, selected };

  return (
    <div className="w-full max-w-md">
      <div className="flex items-center justify-between mb-2 font-[family-name:var(--font-mono)] text-sm">
        <span className="text-[var(--muted)]">GARAGE</span>
        <span>
          <span className="text-[var(--muted)]">B </span>
          <span className="text-[var(--accent)]">{balance.toLocaleString()}</span>
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {CARS.map((car) => {
          const own = isOwned(gstate, car.id);
          const active = selected === car.id;
          const canBuy = buyable(gstate, car, balance);
          const locked = !own && !canBuy;
          return (
            <div
              key={car.id}
              className={`flex items-center justify-between gap-3 px-3 py-2 rounded border font-[family-name:var(--font-mono)] text-xs ${
                active
                  ? "border-[var(--accent)] bg-[var(--accent)]/10"
                  : "border-[var(--border)]"
              } ${locked ? "opacity-45" : ""}`}
            >
              <span className="flex items-center gap-2">
                <span
                  className="inline-block w-3 h-3 rounded-sm"
                  style={{ background: car.color }}
                />
                <span className="text-[var(--foreground)]">{car.name}</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="text-[var(--muted)]">
                  SPD {car.stats.topSpeed} · MAS {car.stats.mass} · DUR {car.stats.durability}
                </span>
                {active ? (
                  <span className="px-2 py-0.5 rounded bg-[var(--accent)] text-[var(--background)]">
                    ACTIVE
                  </span>
                ) : own ? (
                  <button
                    onClick={() => void select(car.id)}
                    className="pixel-edge px-2 py-0.5 rounded bg-[var(--crt-green)] text-[var(--background)]"
                  >
                    SELECT
                  </button>
                ) : (
                  <button
                    disabled={!canBuy}
                    onClick={() => void buy(car.id)}
                    className={`pixel-edge px-2 py-0.5 rounded ${
                      canBuy
                        ? "bg-[var(--accent-hot)] text-[var(--background)]"
                        : "bg-transparent border border-[var(--border)] text-[var(--muted)] cursor-not-allowed"
                    }`}
                  >
                    BUY {car.price.toLocaleString()}
                  </button>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
