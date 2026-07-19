import type { LedgerEntry, LedgerReason, StorageAdapter } from "./storage/types";
import { GLOBAL_DAILY_CAP, rateFor, rewardForEvent } from "./earnRates";

function utcDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Owns the B-Token ledger. Games never construct or reach this — they report
 * through CartridgeHost and the platform decides what a report is worth.
 */
export class Economy {
  constructor(
    private storage: StorageAdapter,
    private playerId: string,
    private now: () => Date = () => new Date(),
  ) {}

  async getBalance(): Promise<number> {
    const log = await this.storage.readLedger(this.playerId);
    // balanceAfter on the last entry makes this O(1) once the log is loaded.
    return log.length === 0 ? 0 : log[log.length - 1].balanceAfter;
  }

  /** Tokens earned today, optionally scoped to one game. Spends excluded. */
  async earnedToday(gameId?: string): Promise<number> {
    const today = utcDay(this.now());
    const log = await this.storage.readLedger(this.playerId);
    return log
      .filter((e) => e.delta > 0)
      .filter((e) => utcDay(new Date(e.createdAt)) === today)
      .filter((e) => (gameId === undefined ? true : e.gameId === gameId))
      .reduce((sum, e) => sum + e.delta, 0);
  }

  /**
   * Grant tokens for a reported score, clamped by per-game and global caps.
   * Returns the amount actually granted.
   */
  async applyScore(gameId: string, score: number): Promise<number> {
    if (!Number.isFinite(score) || score <= 0) return 0;
    const rate = rateFor(gameId);
    const wanted = Math.floor(score * rate.tokensPerPoint);
    return this.grant(gameId, wanted, "score");
  }

  /** Grant a flat reward for a known event. Unknown events grant nothing. */
  async applyEvent(gameId: string, event: string): Promise<number> {
    const wanted = rewardForEvent(event);
    return this.grant(gameId, wanted, "event");
  }

  /** Spend tokens. Returns false when unaffordable or invalid. */
  async spend(
    amount: number,
    reason: LedgerReason,
    gameId: string | null = null,
  ): Promise<boolean> {
    if (!Number.isFinite(amount) || amount <= 0) return false;
    const balance = await this.getBalance();
    if (amount > balance) return false;
    await this.append(gameId, -amount, reason, balance - amount);
    return true;
  }

  /** Clamp a desired grant against both caps, then append. */
  private async grant(
    gameId: string,
    wanted: number,
    reason: LedgerReason,
  ): Promise<number> {
    if (wanted <= 0) return 0;

    const rate = rateFor(gameId);
    const gameRemaining = rate.dailyCap - (await this.earnedToday(gameId));
    const globalRemaining = GLOBAL_DAILY_CAP - (await this.earnedToday());
    const granted = Math.max(0, Math.min(wanted, gameRemaining, globalRemaining));
    if (granted === 0) return 0;

    const balance = await this.getBalance();
    await this.append(gameId, granted, reason, balance + granted);
    return granted;
  }

  private async append(
    gameId: string | null,
    delta: number,
    reason: LedgerReason,
    balanceAfter: number,
  ): Promise<void> {
    const createdAt = this.now().toISOString();
    const entry: LedgerEntry = {
      id: crypto.randomUUID(),
      playerId: this.playerId,
      gameId,
      delta,
      reason,
      balanceAfter,
      createdAt,
    };
    await this.storage.appendLedger(entry);
  }
}
