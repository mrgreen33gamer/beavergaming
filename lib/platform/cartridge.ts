/**
 * The cartridge contract.
 *
 * This is the trust boundary between the platform and game code. Games are
 * treated as untrusted: they REPORT what happened, the platform DECIDES what
 * it is worth. Nothing here can mint currency or touch storage directly.
 *
 * See docs/superpowers/specs/2026-07-18-beaver-platform-sdk-design.md §4.2
 */

export type CartridgeRuntime = "canvas" | "godot";

export interface CartridgeMeta {
  /** Matches Game.slug in lib/games.ts */
  id: string;
  runtime: CartridgeRuntime;
  /** Set false when the game implements its own pause UI. */
  supportsPause?: boolean;
}

/** The entire surface a game may use. Passed in; never constructed by games. */
export interface CartridgeHost {
  /** Report a final or running score. Platform applies rates and caps. */
  reportScore(score: number): void;
  /** Report a named gameplay event, e.g. "level_cleared", "match_won". */
  reportEvent(name: string, value?: number): void;
  /** Persist game-specific state (not scores — use reportScore). */
  saveState(key: string, value: unknown): Promise<void>;
  loadState<T>(key: string): Promise<T | null>;
  onPause(cb: () => void): void;
  onResume(cb: () => void): void;
}

/** The allowed surface, as data, so it can be asserted at runtime. */
export const CARTRIDGE_HOST_METHODS = [
  "reportScore",
  "reportEvent",
  "saveState",
  "loadState",
  "onPause",
  "onResume",
] as const;

/**
 * Names that must never appear on CartridgeHost. If a future change adds one
 * of these, the boundary test fails and the economy stays safe.
 */
export const FORBIDDEN_HOST_METHODS = [
  "awardTokens",
  "setBalance",
  "appendLedger",
  "readLedger",
  "getStorage",
  "setEarnRate",
] as const;
