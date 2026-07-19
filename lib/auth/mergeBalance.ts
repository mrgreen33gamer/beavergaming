import type { LedgerEntry, StorageAdapter } from "@/lib/platform/storage/types";

export type MergeResult =
  | { status: "merged"; amount: number }
  | { status: "already_merged"; amount: 0 }
  | { status: "nothing_to_merge"; amount: 0 };

function balanceOf(log: LedgerEntry[]): number {
  return log.length === 0 ? 0 : log[log.length - 1].balanceAfter;
}

/**
 * Deterministic ids are what make this operation idempotent.
 *
 * The obvious implementation — "check a merged flag, then credit" — has a
 * window where a crash between the credit and the flag write lets a retry
 * credit the balance twice. Deriving the entry id from the guest id instead
 * means the ledger itself records whether the merge happened, so the check
 * and the effect cannot disagree.
 */
function creditId(guestId: string): string {
  return `merge-in-${guestId}`;
}

function debitId(guestId: string): string {
  return `merge-out-${guestId}`;
}

/**
 * Moves a guest's token balance onto an account at sign-up or sign-in.
 *
 * The ledger is append-only and stays that way: past entries are never
 * re-keyed or rewritten. The transfer is expressed as two new entries — a
 * debit zeroing the guest and a matching credit on the account — so the
 * history of how those tokens were earned remains intact and auditable under
 * the guest id.
 */
export async function mergeGuestBalance(
  storage: StorageAdapter,
  guestId: string,
  accountId: string,
  now: () => Date = () => new Date(),
): Promise<MergeResult> {
  if (!guestId || !accountId || guestId === accountId) {
    return { status: "nothing_to_merge", amount: 0 };
  }

  const accountLog = await storage.readLedger(accountId);
  if (accountLog.some((e) => e.id === creditId(guestId))) {
    return { status: "already_merged", amount: 0 };
  }

  const guestLog = await storage.readLedger(guestId);
  const amount = balanceOf(guestLog);
  if (amount <= 0) {
    return { status: "nothing_to_merge", amount: 0 };
  }

  const createdAt = now().toISOString();

  // Debit the guest first. If the process dies between the two writes the
  // tokens are missing rather than duplicated, and the guest ledger is not a
  // durable identity — losing a few free tokens beats minting them.
  if (!guestLog.some((e) => e.id === debitId(guestId))) {
    await storage.appendLedger({
      id: debitId(guestId),
      playerId: guestId,
      gameId: null,
      delta: -amount,
      reason: "adjustment",
      balanceAfter: 0,
      createdAt,
    });
  }

  await storage.appendLedger({
    id: creditId(guestId),
    playerId: accountId,
    gameId: null,
    delta: amount,
    reason: "adjustment",
    balanceAfter: balanceOf(accountLog) + amount,
    createdAt,
  });

  return { status: "merged", amount };
}
