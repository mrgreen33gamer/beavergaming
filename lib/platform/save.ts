import type { StorageAdapter } from "./storage/types";
import { LEGACY_HIGH_SCORE_KEYS } from "./legacyKeys";

const HIGH_SCORE_SCOPE = "highscore";
const STATE_SCOPE = "state";

/** Read a game's pre-platform high score, if one exists. */
function readLegacyHighScore(gameId: string): number {
  if (typeof window === "undefined") return 0;
  const key = LEGACY_HIGH_SCORE_KEYS[gameId];
  if (!key) return 0;
  const raw = localStorage.getItem(key);
  if (raw === null) return 0;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/**
 * One save API for all games, replacing 41 hand-rolled localStorage blocks.
 * Games reach this only through CartridgeHost — never directly.
 */
export class SaveApi {
  constructor(private storage: StorageAdapter) {}

  async getHighScore(gameId: string): Promise<number> {
    const stored = await this.storage.get<number>(HIGH_SCORE_SCOPE, gameId);
    const legacy = readLegacyHighScore(gameId);
    return Math.max(stored ?? 0, legacy);
  }

  /** Returns true when this beats the existing record. */
  async setHighScore(gameId: string, score: number): Promise<boolean> {
    if (!Number.isFinite(score) || score <= 0) return false;
    const current = await this.getHighScore(gameId);
    if (score <= current) return false;
    await this.storage.set(HIGH_SCORE_SCOPE, gameId, score);
    return true;
  }

  async getState<T>(gameId: string, key: string): Promise<T | null> {
    return this.storage.get<T>(STATE_SCOPE, `${gameId}:${key}`);
  }

  async setState(gameId: string, key: string, value: unknown): Promise<void> {
    return this.storage.set(STATE_SCOPE, `${gameId}:${key}`, value);
  }
}
