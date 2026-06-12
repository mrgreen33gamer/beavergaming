"use client";

import type { Building, BuildingType } from "./types";
import { SLOT_POSITIONS, SLOT_RADIUS, W, H } from "./constants";
import { BUILDING_SPECS, UPGRADE_MULT } from "./specs";

type Props = {
  slot: number;
  building: Building | null;
  currency: number;
  isMobile: boolean;
  onBuild: (t: BuildingType) => void;
  onUpgrade: () => void;
  onSell: () => void;
  onClose: () => void;
};

const ALL_TYPES: BuildingType[] = [
  "barracks", "sniper-nest", "tank-factory", "mech-bay",
  "hangar", "drone-hive", "artillery-post", "flame-bunker",
  "radar-tower", "repair-depot",
];

export default function SlotMenu({
  slot, building, currency, isMobile,
  onBuild, onUpgrade, onSell, onClose,
}: Props) {
  const pos = SLOT_POSITIONS[slot];

  // Mobile: bottom sheet. Desktop: positioned popup.
  if (isMobile) {
    return (
      <div
        className="absolute inset-x-0 bottom-0 z-40"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#1a2418] border-t-2 border-[#3a5a30] rounded-t-xl shadow-2xl p-3 max-h-[55vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="font-[family-name:var(--font-mono)] text-base text-[#8a9a78]">
              {building ? `${BUILDING_SPECS[building.type].icon} ${BUILDING_SPECS[building.type].label} Lv${building.level}` : `Slot ${slot + 1}`}
            </span>
            <button onClick={onClose} className="text-[#6a7a60] text-xl px-2">✕</button>
          </div>
          {building ? (
            <div className="flex gap-2">
              {building.level < 3 && (
                <UpgradeBtn building={building} currency={currency} onUpgrade={onUpgrade} />
              )}
              <SellBtn building={building} onSell={onSell} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              {ALL_TYPES.map((t) => (
                <BuildBtn key={t} type={t} currency={currency} onBuild={onBuild} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Desktop: positioned near slot
  const showBelow = pos.y < H / 2;
  const showLeft = pos.x > W * 0.65;
  const showRight = pos.x < W * 0.35;
  let translateX = "-50%";
  if (showLeft) translateX = "-100%";
  if (showRight) translateX = "0%";
  const translateY = showBelow
    ? `calc(${SLOT_RADIUS}px + 10px)`
    : `calc(-100% - ${SLOT_RADIUS}px - 10px)`;

  return (
    <div
      className="absolute z-40"
      style={{
        left: `${(pos.x / W) * 100}%`,
        top: `${(pos.y / H) * 100}%`,
        transform: `translate(${translateX}, ${translateY})`,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-[#1a2418] border-2 border-[#3a5a30] rounded-lg shadow-2xl p-2 min-w-[260px] max-h-[380px] overflow-y-auto">
        <div className="flex items-center justify-between mb-1 px-1">
          <span className="font-[family-name:var(--font-mono)] text-base text-[#8a9a78]">
            {building ? `${BUILDING_SPECS[building.type].icon} ${BUILDING_SPECS[building.type].label} Lv${building.level}` : `Build — Slot ${slot + 1}`}
          </span>
          <button onClick={onClose} className="text-[#6a7a60] hover:text-[#aaa] text-sm px-1">✕</button>
        </div>
        {building ? (
          <div className="space-y-1">
            {building.level < 3 && (
              <UpgradeBtn building={building} currency={currency} onUpgrade={onUpgrade} />
            )}
            <SellBtn building={building} onSell={onSell} />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1">
            {ALL_TYPES.map((t) => (
              <BuildBtn key={t} type={t} currency={currency} onBuild={onBuild} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BuildBtn({ type, currency, onBuild }: { type: BuildingType; currency: number; onBuild: (t: BuildingType) => void }) {
  const spec = BUILDING_SPECS[type];
  const can = currency >= spec.cost;
  return (
    <button
      onClick={() => can && onBuild(type)}
      disabled={!can}
      className={`text-left px-2 py-1.5 rounded font-[family-name:var(--font-mono)] text-sm transition-colors ${
        can ? "bg-[#2a3a22] hover:bg-[#3a5a30] cursor-pointer" : "bg-[#1e2a1a] opacity-40 cursor-not-allowed"
      }`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-base">{spec.icon}</span>
        <span className={can ? "text-[#b0ffa0]" : "text-[#aa4444]"}>
          ${spec.cost}
        </span>
      </div>
      <div className="text-xs text-[#7a8a70] leading-tight mt-0.5">{spec.label}</div>
      <div className="text-xs text-[#5a6a50] leading-tight">{spec.desc}</div>
    </button>
  );
}

function UpgradeBtn({ building, currency, onUpgrade }: { building: Building; currency: number; onUpgrade: () => void }) {
  const spec = BUILDING_SPECS[building.type];
  const cost = spec.upgradeCosts[building.level - 1];
  const can = currency >= cost;
  const mult = UPGRADE_MULT[building.level + 1];
  return (
    <button
      onClick={() => can && onUpgrade()}
      disabled={!can}
      className={`w-full text-left px-2 py-2 rounded font-[family-name:var(--font-mono)] text-sm ${
        can ? "bg-[#2a3a22] hover:bg-[#3a5a30] cursor-pointer" : "bg-[#1e2a1a] opacity-40 cursor-not-allowed"
      }`}
    >
      <div className="flex justify-between">
        <span>⬆ Upgrade to Lv{building.level + 1}</span>
        <span className={can ? "text-[#b0ffa0]" : "text-[#aa4444]"}>${cost}</span>
      </div>
      {mult && (
        <div className="text-xs text-[#6a8a60] mt-0.5">
          HP ×{mult.hp} · DMG ×{mult.dmg} · Rate ×{mult.rate.toFixed(2)}
          {mult.cap > 0 && ` · +${mult.cap} cap`}
        </div>
      )}
    </button>
  );
}

function SellBtn({ building, onSell }: { building: Building; onSell: () => void }) {
  const spec = BUILDING_SPECS[building.type];
  const totalInvested = spec.cost + spec.upgradeCosts.slice(0, building.level - 1).reduce((a, b) => a + b, 0);
  const refund = Math.floor(totalInvested / 2);
  return (
    <button
      onClick={onSell}
      className="w-full text-left px-2 py-2 rounded bg-[#2a1a18] hover:bg-[#4a2020] transition-colors font-[family-name:var(--font-mono)] text-sm"
    >
      💰 Sell <span className="text-[#ffd060] float-right">+${refund}</span>
    </button>
  );
}
