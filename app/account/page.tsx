import { redirect } from "next/navigation";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import SignOutButton from "@/app/components/SignOutButton";
import { getCurrentUser } from "@/lib/auth/server";
import { getServerEconomy } from "@/lib/platform/server/getServerEconomy";
import { levelProgress, rankFor, earnMultiplier, MAX_LEVEL } from "@/lib/platform/progression";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { economy } = await getServerEconomy();
  const balance = await economy.getBalance();

  const { level, intoLevel, needed } = levelProgress(user.xp ?? 0);
  const rank = rankFor(level);
  const bonus = Math.round((earnMultiplier(level) - 1) * 100);
  const pct = needed > 0 ? Math.min(100, Math.round((intoLevel / needed) * 100)) : 100;

  return (
    <>
      <Header />
      <main className="flex-1 max-w-3xl mx-auto px-6 py-12 w-full">
        <h1 className="t-display-lg text-[var(--accent)] mb-8">YOUR ACCOUNT</h1>

        <dl className="rounded-lg border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
          <div className="flex justify-between items-baseline gap-4 p-5">
            <dt className="t-label text-[var(--muted)]">Display name</dt>
            <dd className="t-body text-[var(--foreground)]">{user.displayName}</dd>
          </div>
          <div className="flex justify-between items-baseline gap-4 p-5">
            <dt className="t-label text-[var(--muted)]">Email</dt>
            <dd className="t-body text-[var(--foreground)] text-right break-all">
              {user.email}
              {!user.emailVerified && (
                <span className="t-caption block text-[var(--accent-hot)]">
                  unconfirmed — check your inbox
                </span>
              )}
            </dd>
          </div>
          <div className="flex justify-between items-baseline gap-4 p-5">
            <dt className="t-label text-[var(--muted)]">B-Tokens</dt>
            <dd className="t-body text-[var(--accent)]">🪙 {balance}</dd>
          </div>
          <div className="p-5">
            <div className="flex justify-between items-baseline gap-4">
              <dt className="t-label text-[var(--muted)]">Rank</dt>
              <dd className="t-body text-[var(--foreground)]">
                {rank.name} · Level {level}
                {bonus >= 1 && (
                  <span className="t-caption block text-[var(--crt-green)]">
                    +{bonus}% earn bonus
                  </span>
                )}
              </dd>
            </div>
            <div
              className="mt-3 h-2 overflow-hidden rounded border border-[var(--border)] bg-[var(--surface-2)]"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Progress to level ${Math.min(MAX_LEVEL, level + 1)}`}
            >
              <div className="h-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
            </div>
            <p className="t-caption mt-2 text-[var(--muted)]">
              {level >= MAX_LEVEL
                ? "Maximum level reached."
                : `${intoLevel} / ${needed} XP to level ${level + 1}`}
            </p>
          </div>
        </dl>

        <div className="mt-8 flex items-center gap-4 flex-wrap">
          <SignOutButton />
          <span className="t-caption text-[var(--muted)]">
            Signing out returns you to guest play — your account keeps its tokens.
          </span>
        </div>
      </main>
      <Footer />
    </>
  );
}
