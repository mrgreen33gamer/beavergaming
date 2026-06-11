"use client";

import type { Building, BuildingType } from "./types";
import { SLOT_POSITIONS, SLOT_RADIUS, WIDTH, HEIGHT } from "./constants";
import { BUILDING_SPECS } from "./specs";

type Props = {
  slot: number;
  building: Building | null;
  currency: number;
  onBuild: (t: BuildingType) => void;
  onSell: () => void;
  onClose: () => void;
};

export default function SlotMenu({
  slot,
  building,
  currency,
  onBuild,
  onSell,
  onClose,
}: Props) {
  const pos = SLOT_POSITIONS[slot];
  // Smart positioning so menu never goes off the canvas edge.
  const showBelow = pos.y < HEIGHT / 2;
  const showLeft = pos.x > WIDTH * 0.65;
  const showRight = pos.x < WIDTH * 0.35;

  let translateX = "-50%";
  if (showLeft) translateX = "-100%";
  if (showRight) translateX = "0%";

  const translateY = showBelow
    ? `calc(${SLOT_RADIUS}px + 8px)`
    : `calc(-100% - ${SLOT_RADIUS}px - 8px)`;

  return (
    <div
      className="absolute z-30"
      style={{
        left: `${(pos.x / WIDTH) * 100}%`,
        top: `${(pos.y / HEIGHT) * 100}%`,
        transform: `translate(${translateX}, ${translateY})`,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-[var(--surface)] border-2 border-[var(--border)] rounded-lg shadow-2xl p-2 min-w-[230px]">
        {building ? (
          <>
            <div className="font-[family-name:var(--font-mono)] text-base text-[var(--muted)] mb-1 px-2 pt-1">
              {BUILDING_SPECS[building.type].emoji} {BUILDING_SPECS[building.type].label}
            </div>
            <button
              onClick={onSell}
              className="w-full text-left px-2 py-2 rounded bg-[var(--surface-2)] hover:bg-[var(--danger)]/30 transition-colors font-[family-name:var(--font-mono)] text-base"
            >
              💰 Sell{" "}
              <span className="text-[var(--accent-hot)] float-right">
                +${Math.floor(BUILDING_SPECS[building.type].cost / 2)}
              </span>
            </button>
          </>
        ) : (
          <>
            <div className="font-[family-name:var(--font-mono)] text-base text-[var(--muted)] mb-1 px-2 pt-1">
              Build at slot {slot + 1}
            </div>
            {(["barracks", "factory", "hangar"] as BuildingType[]).map((t) => {
              const spec = BUILDING_SPECS[t];
              const can = currency >= spec.cost;
              return (
                <button
                  key={t}
                  onClick={() => can && onBuild(t)}
                  disabled={!can}
                  className={`w-full text-left px-2 py-2 my-0.5 rounded font-[family-name:var(--font-mono)] text-base ${
                    can
                      ? "bg-[var(--surface-2)] hover:bg-[var(--accent)]/25 cursor-pointer"
                      : "bg-[var(--surface-2)] opacity-50 cursor-not-allowed"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span>
                      {spec.emoji} {spec.label}
                    </span>
                    <span className={can ? "text-[var(--accent-hot)]" : "text-[var(--danger)]"}>
                      ${spec.cost}
                    </span>
                  </div>
                </button>
              );
            })}
          </>
        )}
        <button
          onClick={onClose}
          className="w-full text-center px-2 py-1 mt-1 text-sm font-[family-name:var(--font-mono)] text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          cancel
        </button>
      </div>
    </div>
  );
}
