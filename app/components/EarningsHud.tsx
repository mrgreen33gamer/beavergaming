"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { subscribeAward, type Award } from "@/lib/platform/awardBus";

interface Summary {
  signedIn: boolean;
  balance: number;
  earnedToday: number;
  globalCap: number;
  gameCap: number | null;
  earnedTodayGame: number;
  tokensPerPoint: number | null;
  level: number;
  rank: string;
  earnMultiplier: number;
}

/**
 * Shows what a game pays and what this session earned.
 *
 * Until now the economy was completely invisible — tokens were granted with
 * no indication any of it existed. This is deliberately part of the shell
 * rather than each game, so all 43 get it without touching game code.
 */
export default function EarningsHud({ gameId }: { gameId: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [sessionEarned, setSessionEarned] = useState(0);
  const [toast, setToast] = useState<Award | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/economy/summary?gameId=${encodeURIComponent(gameId)}`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const data = (await res.json()) as Summary;
        if (active) setSummary(data);
      } catch {
        // Decoration — never break a game over a failed panel fetch.
      }
    };
    void load();

    const unsubscribe = subscribeAward((award) => {
      if (!active || award.gameId !== gameId) return;
      if (award.granted > 0) setSessionEarned((n) => n + award.granted);
      setToast(award);
      void load();
      window.setTimeout(() => {
        if (active) setToast(null);
      }, 4000);
    });

    return () => {
      // Both matter: unsubscribing stops new awards, and the flag stops the
      // in-flight fetch and the toast timer from setting state after unmount.
      active = false;
      unsubscribe();
    };
  }, [gameId]);

  const capPct =
    summary?.gameCap && summary.gameCap > 0
      ? Math.min(100, Math.round((summary.earnedTodayGame / summary.gameCap) * 100))
      : 0;

  return (
    <>
      {/* Award toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none absolute left-1/2 top-4 z-30 -translate-x-1/2 rounded-lg border px-4 py-2 text-center"
          style={{
            background: "rgba(26,14,10,0.94)",
            borderColor: toast.granted > 0 ? "var(--crt-green)" : "var(--border)",
          }}
        >
          {toast.granted > 0 ? (
            <p className="t-body text-[var(--crt-green)]">+{toast.granted} B-Tokens</p>
          ) : toast.reason === "account_required" ? (
            <p className="t-body text-[var(--muted)]">
              Sign in to keep what you earn
            </p>
          ) : (
            <p className="t-body text-[var(--muted)]">Daily cap reached</p>
          )}
          {toast.leveledUpTo && (
            <p className="t-caption text-[var(--accent)]">
              Level {toast.leveledUpTo} · {toast.rank}
            </p>
          )}
        </div>
      )}

      {/* Panel toggle, sitting with the other shell controls */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="pixel-edge t-body rounded bg-[var(--surface-2)] px-3 py-1"
      >
        🪙 {sessionEarned > 0 ? `+${sessionEarned}` : "Earnings"}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-72 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-left shadow-xl">
          {!summary ? (
            <p className="t-caption text-[var(--muted)]">Loading…</p>
          ) : !summary.signedIn ? (
            <>
              <p className="t-body mb-2 text-[var(--foreground)]">
                You&apos;re playing as a guest
              </p>
              <p className="t-caption mb-3 text-[var(--muted)]">
                Everything is playable without an account, but B-Tokens are only
                kept for signed-in players.
              </p>
              <Link
                href="/register"
                className="cta t-display-sm inline-block rounded bg-[var(--accent)] px-4 py-2 text-[var(--background)]"
              >
                CREATE FREE ACCOUNT
              </Link>
            </>
          ) : (
            <>
              <dl className="space-y-2">
                <div className="flex justify-between gap-3">
                  <dt className="t-caption text-[var(--muted)]">This session</dt>
                  <dd className="t-body text-[var(--crt-green)]">+{sessionEarned}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="t-caption text-[var(--muted)]">Balance</dt>
                  <dd className="t-body text-[var(--accent)]">🪙 {summary.balance}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="t-caption text-[var(--muted)]">Rank</dt>
                  <dd className="t-body text-[var(--foreground)]">
                    {summary.rank} · Lv {summary.level}
                  </dd>
                </div>
                {/* Only once it rounds to a visible figure — the ramp is
                    gradual, and "+0%" reads as broken rather than as early. */}
                {Math.round((summary.earnMultiplier - 1) * 100) >= 1 && (
                  <div className="flex justify-between gap-3">
                    <dt className="t-caption text-[var(--muted)]">Rank bonus</dt>
                    <dd className="t-body text-[var(--crt-green)]">
                      +{Math.round((summary.earnMultiplier - 1) * 100)}%
                    </dd>
                  </div>
                )}
              </dl>

              {summary.gameCap !== null && (
                <div className="mt-4">
                  <div className="mb-1 flex justify-between">
                    <span className="t-caption text-[var(--muted)]">Today, this game</span>
                    <span className="t-caption text-[var(--muted)]">
                      {summary.earnedTodayGame}/{summary.gameCap}
                    </span>
                  </div>
                  <div
                    className="h-2 overflow-hidden rounded border border-[var(--border)] bg-[var(--surface-2)]"
                    role="progressbar"
                    aria-valuenow={capPct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Daily cap progress for this game"
                  >
                    <div
                      className="h-full bg-[var(--accent)]"
                      style={{ width: `${capPct}%` }}
                    />
                  </div>
                  <p className="t-caption mt-2 text-[var(--muted)]">
                    {summary.earnedToday}/{summary.globalCap} across all games today.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
