# Beaver Platform SDK — Design

**Date:** 2026-07-18
**Status:** Approved for Phase 1
**Scope:** This spec covers **Phase 1 in full detail**. Phases 2–5 are roadmap
context only — each gets its own spec when reached.

---

## 1. Problem

`beavergaming` is a Next.js portal with 42 working HTML5-canvas games
(~23,000 LOC). The games work, but they share nothing:

| Concern | Current state |
|---|---|
| High scores | 41 of 42 games hand-roll their own `localStorage` logic |
| Game loop | 29 separate `requestAnimationFrame` implementations |
| Pause | 4 games |
| Fullscreen | 2 games |
| Loading screen | none |
| Audio | 4 `sound.ts` files + 5 inline `AudioContext` blocks |
| Accounts / persistence | none — fully static site, no backend |

There is also a live performance defect: `app/play/[slug]/page.tsx` statically
imports all 42 games, so **every visitor downloads all 42 games' code to play
one**.

The goal is a shared platform layer that unifies the existing games, supports
new 3D games built in an external engine, and eventually supports third-party
creators — all under one currency.

## 2. Non-goals

- **Not building a game engine.** Rejected explicitly: a basic custom engine is
  500–1,000 hours and would land behind where Godot starts today, for free.
  Ownership comes from the platform layer and (optionally) Godot's GDExtension
  C++ modules, not from writing a renderer.
- **Not rewriting the 42 canvas games.** They stay canvas/React permanently.
- **Not real-money purchases.** B-Tokens are earned only. This deliberately
  avoids payments, fraud, COPPA, and loot-box regulation.
- **Not multiplayer in Phase 1.**

## 3. Core insight: the portal is the platform, not the engine

The Next.js site stops being "where games live" and becomes the **host**.
Games become **cartridges** implementing one contract, regardless of what
they're built in.

```
┌─ PORTAL (Next.js)      loading screen · pause menu · profile · shop
├─ SDK (lib/platform/)   cartridge contract · storage · economy · audio
└─ CARTRIDGES            42 canvas games   │   Godot web exports
```

Canvas cartridges call the SDK directly. Godot cartridges call it over
`postMessage` across an iframe boundary. Both get the same loading screen,
pause menu, saves, and currency — written once.

## 4. Architecture

### 4.1 The cartridge contract

The contract is deliberately **narrow and untrusted**. A cartridge receives a
capability-scoped handle, never the raw ledger or storage.

```ts
// lib/platform/cartridge.ts
export type CartridgeRuntime = "canvas" | "godot";

export interface CartridgeMeta {
  id: string;                  // matches Game.slug in lib/games.ts
  runtime: CartridgeRuntime;
  supportsPause?: boolean;     // opt out of GameShell pause overlay
}

/** Handle passed INTO a game. This is the entire trusted surface. */
export interface CartridgeHost {
  reportScore(score: number): void;
  reportEvent(name: string, value?: number): void;
  saveState(key: string, value: unknown): Promise<void>;
  loadState<T>(key: string): Promise<T | null>;
  onPause(cb: () => void): void;
  onResume(cb: () => void): void;
}
```

Note what is **absent**: no `awardTokens`, no ledger access, no direct storage.

### 4.2 Trust boundary (critical)

Games **report**; the platform **decides**. This is the single most important
decision in the spec, because it is the one that cannot be retrofitted.

```ts
// ❌ game controls the money — unfixable once creators exist
platform.awardTokens(1000)

// ✅ game reports, platform applies rate + cap
host.reportScore(4200)
```

Rationale: Phase 5+ contemplates third-party creators. If a game can mint
currency, a creator publishes "Click Button → 1,000,000 B-Tokens" and the
economy dies immediately. Earn rates live in platform-owned config that
cartridge code cannot reach.

Phase 1 stores balances in `localStorage`, so a determined user can still edit
their own balance via DevTools. This is **accepted for Phase 1** — single
player, no real money, nothing to steal. What matters is that the *authority
boundary is already in the right place*, so Phase 2 makes it genuinely secure
without reopening a single game.

### 4.3 Storage adapter

All persistence goes through one interface so the backend can be swapped
without touching game code.

```ts
// lib/platform/storage/adapter.ts
export interface StorageAdapter {
  get<T>(scope: string, key: string): Promise<T | null>;
  set(scope: string, key: string, value: unknown): Promise<void>;
  appendLedger(entry: LedgerEntry): Promise<void>;
  readLedger(playerId: string): Promise<LedgerEntry[]>;
}
```

Selection is by environment, resolved once at startup:

| Condition | Adapter | Player identity |
|---|---|---|
| No `MONGODB_URI` | `LocalStorageAdapter` | anonymous device-local id |
| `MONGODB_URI` set | `MongoAdapter` | authenticated account |

Phase 1 ships `LocalStorageAdapter` and the `MongoAdapter` interface with a
stub. Supplying the env value in Phase 2 activates the real backend.

### 4.4 Economy

Two tiers. Hard currency is global and platform-authoritative; soft currency is
per-game and game-authoritative.

```
B-TOKENS (hard, global)              Earned by playing any game
   │                                 Authority: PLATFORM only
   │                                 Rate-capped per game + per day
   ▼  exchange (ONE-WAY)
PER-GAME CURRENCY (soft)             Earned inside that game
   e.g. Car Game "Credits"           Authority: that game
   │                                 Never converts back
   ▼
in-game purchases (skins, add-ons)
```

The exchange is one-way by design: it makes B-Tokens a genuine sink and
prevents laundering value between unrelated games.

**Phase 1 implements the hard-currency tier only.** Soft currency and the
exchange (`wallet.ts`) land in Phase 4 alongside the first game that needs
them. The two-tier structure is specified here so Phase 1's ledger and
`CartridgeHost` are shaped correctly, but no unused code ships.

**Ledger is append-only.** Every balance change is an entry with a reason:

```ts
export interface LedgerEntry {
  id: string;
  playerId: string;
  gameId: string | null;
  delta: number;              // + earn, − spend
  reason: "score" | "daily_bonus" | "purchase" | "exchange" | "adjustment";
  balanceAfter: number;
  createdAt: string;          // ISO-8601
}
```

Rationale: a derived balance is reconstructable and auditable, which is what
makes the Phase 2 localStorage → Mongo migration safe rather than a guess.

### 4.5 Earn rates

Platform-owned config. Not reachable from cartridge code — this is the file a
third-party creator must never be able to influence.

```ts
// lib/platform/earnRates.ts
export const DEFAULT_RATE = { tokensPerPoint: 0.01, dailyCap: 200 };
export const GAME_RATES: Record<string, { tokensPerPoint: number; dailyCap: number }> = {
  // per-game overrides — high-scoring games get lower rates
};
export const GLOBAL_DAILY_CAP = 500;
```

Both a per-game cap and a global daily cap apply; the global cap prevents
farming across many games.

### 4.6 Module inventory (Phase 1)

| Module | Responsibility |
|---|---|
| `lib/platform/cartridge.ts` | Contract types; `CartridgeHost` |
| `lib/platform/useCartridge.ts` | React hook — canvas games adopt in ~3 lines |
| `lib/platform/storage/adapter.ts` | `StorageAdapter` interface |
| `lib/platform/storage/localStorage.ts` | Phase 1 implementation |
| `lib/platform/storage/mongo.ts` | Phase 2 stub |
| `lib/platform/economy.ts` | Ledger, balance derivation, earn application |
| `lib/platform/earnRates.ts` | Platform-owned rate config |
| `lib/platform/save.ts` | Unified save/high-score API |
| `lib/platform/audio.ts` | Shared audio bus, master mute |
| `app/components/GameShell.tsx` | Loading screen, pause overlay, fullscreen |
| `app/components/GodotCartridge.tsx` | iframe + `postMessage` bridge (stub) |

Each module has one purpose and is independently testable. `economy.ts` and
`earnRates.ts` are separate specifically so rate policy can change without
touching ledger logic.

## 5. Data flow

```
game: host.reportScore(4200)
  → economy.applyScore(gameId, 4200)
      → earnRates lookup  → 42 tokens
      → cap check (per-game + global daily)  → clamped to 38
      → appendLedger({ delta: +38, reason: "score", ... })
  → storage adapter persists
  → portal HUD re-reads balance, updates
```

Games never touch storage or the ledger directly. That indirection is the whole
point: it is what lets Phase 2 swap the backend without reopening 42 games.

## 6. Migration strategy

Incremental, with no flag day.

1. **`GameShell` wraps all 42 games immediately.** They get the loading screen,
   pause overlay, and fullscreen with **zero changes to game code**.
2. **Code-split** `app/play/[slug]/page.tsx` using `next/dynamic`, replacing 42
   static imports. Large immediate load-time win.
3. **Games adopt `reportScore` one at a time**, at any pace. A game that hasn't
   migrated keeps its own `localStorage` high score and simply earns no tokens
   yet. Nothing breaks mid-migration.

## 7. Testing

- **Unit:** `economy.ts` (earn math, per-game cap, global cap, ledger append,
  balance derivation), `earnRates.ts` (fallback to default), storage adapters
  against a shared contract test suite.
- **Boundary:** assert `CartridgeHost` exposes no mint/ledger/storage surface —
  a regression guard on the trust boundary.
- **Smoke:** every game in `lib/games.ts` mounts inside `GameShell` without
  crashing, and its lazy chunk resolves.
- **Not tested:** internal game logic. Games are treated as black boxes.

## 8. Risks

| Risk | Mitigation |
|---|---|
| 4 games with custom pause logic conflict with `GameShell` | `supportsPause: false` opt-out in `CartridgeMeta` |
| Token rates feel wrong once played | All numbers in `earnRates.ts`; tuning is a one-file change |
| localStorage balances are user-editable in Phase 1 | Accepted — no real money, nothing to steal. Ledger is append-only so Phase 2 can validate or reset on migration |
| Godot web builds are 30–100 MB | Exactly why `GameShell` has a real loading screen. 3D targets desktop; mobile stays on canvas games |
| Mongo is wrong for realtime multiplayer | Acknowledged. Phase 5 adds a dedicated realtime layer; Mongo remains system of record |

## 9. Roadmap (later phases — not this spec)

| Phase | Scope |
|---|---|
| **1** | Platform SDK, `GameShell`, code-splitting. localStorage, anonymous player. |
| **2** | User accounts + MongoDB Atlas. Storage adapter swap; auth via Auth.js + Mongo adapter. Real server-side earn enforcement. |
| **3** | Shop v1 — portal cosmetics (profile badges, themes). Gives B-Tokens their first sink using only existing games. |
| **4** | First Godot 4 cartridge: 3D vehicle game. Per-game soft currency + one-way exchange. |
| **5** | Multiplayer. Dedicated realtime layer (Nakama or equivalent) alongside Mongo. |
| **later** | Open-source SDK; third-party creators. Only viable because the trust boundary exists from Phase 1. |

Each phase ships something usable on its own. Multiplayer is deliberately last —
it is where projects die, and it should land on a foundation that already works.

## 10. Phase 1 acceptance criteria

- [ ] All 42 games render inside `GameShell` with loading screen, pause, fullscreen
- [ ] `app/play/[slug]/page.tsx` lazy-loads a single game; bundle measured before/after
- [ ] `CartridgeHost` exposes no token-minting surface; enforced by test
- [ ] Ledger is append-only; balance derives from entries
- [ ] Per-game and global daily caps enforced, with unit tests
- [ ] At least 3 games migrated to `reportScore` as reference implementations
- [ ] Setting `MONGODB_URI` selects `MongoAdapter` (stub may throw "not implemented")
- [ ] Unmigrated games continue working untouched
