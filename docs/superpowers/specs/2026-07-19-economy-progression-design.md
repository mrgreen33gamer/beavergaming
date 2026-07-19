# Beaver Gaming — Economy, Progression, and Ranks

**Date:** 2026-07-19
**Status:** Approved design, pending implementation plan

## Context

B-Tokens already exist. `lib/platform/earnRates.ts` owns all rate configuration,
`Economy` applies per-game and global daily caps, and games report through
`CartridgeHost` without any ability to mint currency. That trust boundary is
sound and this work does not change it.

What is missing: only 4 of 43 games have tuned rates, earning is open to
guests, players cannot see what a game pays, coins can be lost on disconnect,
and there is no progression.

This spec covers four subsystems, to be built in order.

| | Subsystem | Nature |
|---|---|---|
| **A** | Per-game payout tuning | Configuration, low risk |
| **B** | Account-gated earning + disconnect resilience | Touches the live economy |
| **C** | Earnings and payout display | UI |
| **D** | EXP, levels, ranks | New subsystem |

---

## Decisions taken

1. **Accounts are required to earn.** Guests may play everything and earn
   nothing.
2. **Rank boosts the earn rate modestly and never raises daily caps.**
3. **All four are specified together, implemented A → C → B → D.**

### Consequence: existing guest balances are honoured

Real guest ledger entries exist, earned under the previous rules where guests
earned freely. Gating earning must not confiscate them.

The anon→account merge (`lib/auth/mergeBalance.ts`) is therefore **kept**, not
deleted. New guest earning stops; balances already earned still transfer when
that person signs up. A rules change must not take tokens from someone who
earned them under the old rules.

---

## Subsystem A — Per-game payout tuning

### Problem

`DEFAULT_RATE` is 0.01 tokens per point with a 200/day cap. Only asteroids,
breakout, apple-shooter and dam-rush override it. Score scales differ by orders
of magnitude across the catalogue, so an hour of Asteroids and an hour of
Minesweeper pay wildly different amounts for the same effort.

### Approach

Normalise on **tokens per minute of competent play**, targeting roughly
**8–12 tokens/minute**, so no game is the obvious farm.

Games fall into three shapes, each earning differently:

- **Score-scaling** (Asteroids, Breakout, Tetris): tune `tokensPerPoint`
  against a realistic 5-minute score.
- **Discrete completion** (Minesweeper, Sokoban, Slide Puzzle): pay via
  `EVENT_REWARDS`, since score is not meaningful.
- **Collectible** (Helicopter gems, coins): the game already converts pickups
  into score, so these tune as score-scaling. No new mechanism is required —
  the platform continues to price the reported score, not the pickup.

`EVENT_REWARDS` gains entries for the events games actually emit. Unknown
events remain worth zero, which is the existing safety property.

### Deliverable

Every one of the 43 games has either an explicit `GAME_RATES` entry or a
documented reason for using the default. A test asserts no game silently
relies on the default, mirroring the guard used for cover art.

---

## Subsystem B — Account-gated earning and disconnect resilience

### Gating

Earning requires a session. The check lives **server-side** in the economy API
routes, never in game code:

- `POST /api/economy/score` and `/event` resolve the current user. With no
  account, they return `{ granted: 0, balance, reason: "account_required" }`
  with HTTP 200 — not an error, because not being signed in is a normal state.
- Guests keep playing, keep scores and saves locally, and see their high
  scores. Only token granting is withheld.

`resolveServerPlayerId()` already returns the account id when signed in and the
guest cookie otherwise, so the gate is a single check at the API boundary.

### Disconnect resilience

Today a game reports its score once, typically at game over. A player who
closes the tab or drops connection mid-run loses everything earned in that run.

Two changes:

1. **Session-scoped incremental reporting.** Reports carry a client-generated
   `sessionId` and the run's current cumulative score. The server records the
   highest score already granted for that session and grants only the
   difference. Reporting the same score twice grants nothing.
2. **Flush on exit.** The cartridge host reports on `pagehide` and on
   `visibilitychange → hidden`, using `navigator.sendBeacon` so the request
   survives teardown.

This makes reports idempotent *and* recoverable: a game may report every few
seconds without double-granting, and a disconnect costs at most the seconds
since the last report.

Session records live in a `sessions_score` collection keyed by
`{playerId, sessionId, gameId}` with a TTL index, so they expire rather than
accumulating.

### Anti-farming

The existing caps remain the primary defence and are unchanged:

- 200 B-Tokens per game per UTC day
- 500 B-Tokens across all games per UTC day

Added:

- Rate limiting on the economy endpoints, per account.
- Rank multipliers are applied **server-side only**, after which caps are
  applied — a boosted rate can never exceed the cap.
- Requiring an account raises the cost of farming via throwaway identities,
  though only modestly on its own.

Note that email verification is currently issued but **not enforced** — an
unverified account can do everything a verified one can. Gating earning on
`emailVerified` would meaningfully raise that cost, and the flag and flow
already exist to support it. It is deliberately left out of this spec as a
separate decision, because it trades signup friction for farming resistance
and that trade should be made explicitly rather than smuggled in here.

---

## Subsystem C — Earnings and payout display

Players cannot currently see what a game pays or what they earned.

**In-game, via `GameShell`:** a payout panel showing this game's rate, its
daily cap, progress against that cap, and tokens earned this session. This sits
with the existing pause/mute/fullscreen controls, so it arrives for every game
without per-game work.

**On award:** a transient "+N B-Tokens" indicator. `useCartridge` already
exposes `lastAward` for exactly this and nothing renders it yet.

**For guests:** the same panel states plainly that an account is required to
earn, with a link to register. This is the honest place to make the case for
signing up — at the moment the player has just earned something and cannot keep
it.

---

## Subsystem D — EXP, levels, and ranks

### EXP

EXP is granted alongside tokens at **10 XP per token granted**. Deriving it
from *granted* tokens (post-cap) rather than reported score means EXP inherits
every anti-farming property the token economy already has, for free. Daily
maximum is therefore 5,000 XP.

### Level curve

```
xpForLevel(L) = 50 + 9 * (L - 1)      // XP to go from L to L+1
```

Level 2 costs 50 XP; level 1000 costs ~9,041. Cumulative to level 1000 is
approximately **4.55M XP**, or ~910 days at the daily maximum. Hard, clearly
achievable with sustained play, and impossible to shortcut — which matches the
intent of "really hard to get to but achievable through enough time".

### Ranks

Levels group into ten named ranks, so progress is legible without reading a
number:

| Rank | Levels |
|---|---|
| Rookie | 1–9 |
| Bronze | 10–49 |
| Silver | 50–99 |
| Gold | 100–199 |
| Platinum | 200–349 |
| Diamond | 350–499 |
| Master | 500–699 |
| Grandmaster | 700–849 |
| Legend | 850–949 |
| Beaver Lord | 950–1000 |

### Rank multiplier

```
multiplier(level) = 1 + 0.25 * (level - 1) / 999
```

A linear ramp to **+25%** at level 1000. Applied server-side to the desired
grant *before* caps are enforced, so the caps continue to bind exactly as they
do today.

This is deliberately modest. "Higher rank earns faster" plus "EXP comes from
earning" is a compounding loop, and the only thing preventing it from becoming
a farming incentive is that the daily ceiling never moves. A player at level
1000 reaches the daily cap sooner; they cannot exceed it.

### Storage

Level and EXP live on the user document, updated in the same server-side path
that grants tokens. Guests have no EXP, consistent with earning requiring an
account.

---

## Testing

Test-first for anything that touches value:

- Rate normalisation: every game maps to a rate; none silently uses the default.
- Session-scoped granting: repeated reports of the same score grant once;
  increasing scores grant only the delta; out-of-order reports never grant
  negatively.
- Gating: no session grants zero and returns `account_required`; a session
  grants normally.
- Caps still bind at maximum rank multiplier — the property that makes ranks
  safe.
- Level curve: monotonic, level 1000 reachable, cumulative total within the
  intended range.
- Rank boundaries: every level 1–1000 maps to exactly one rank.

---

## Sequencing

1. **A — payout tuning.** Visible, safe, no behaviour change beyond amounts.
2. **C — display.** Makes A legible and sets up the signup case.
3. **B — gating and disconnect resilience.** A real behaviour change; ships
   once players can see what they are being told about.
4. **D — EXP and ranks.** Largest, and depends on the grant path built in B.

Each ships as its own reviewable change set.

## Out of scope

Spending B-Tokens. The design keeps a spend path open — `Economy.spend()`
already exists and the ledger records `purchase` and `exchange` reasons — but
no store, catalogue, or pricing is specified here.
