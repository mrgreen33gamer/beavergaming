# Beaver Platform SDK — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the platform layer that unifies 43 existing canvas games under a shared shell (loading screen, pause, fullscreen), a single save API, and a B-Token economy — with a trust boundary and storage adapter that make Phase 2 (accounts + MongoDB) a swap rather than a rewrite.

**Architecture:** Three layers. The **portal** (Next.js) hosts; the **SDK** (`lib/platform/`) owns contract, storage, and economy; **cartridges** (games) report events and never touch storage or the ledger. Games receive a capability-scoped `CartridgeHost` — deliberately with no token-minting surface — so third-party creators can be supported later without re-architecting.

**Tech Stack:** Next.js 16.2.6 (App Router), React 19.2.4, TypeScript 5 (strict), Tailwind v4, Vitest + Testing Library (added in Task 1).

## Global Constraints

- **TypeScript strict mode is on.** No `any`. No non-null assertions without justification.
- **Path alias:** `@/*` maps to repo root. Import as `@/lib/platform/...`.
- **All game components are `"use client"`.** SDK modules that touch browser APIs must be client-safe.
- **Never break an unmigrated game.** All 43 games must keep working at every commit.
- **Preserve existing localStorage keys.** Players have real high scores under inconsistent keys (`asteroids-highscore`, `lightsout-best`, `bc-best`, `airhockey-wins`). Migration must read legacy keys, never orphan them.
- **Games never mint currency.** `CartridgeHost` exposes no `awardTokens`. Earn rates live in `lib/platform/earnRates.ts`, unreachable from game code. This is the one constraint that cannot be retrofitted.
- **Currency is named B-Tokens** (BeaverTokens) in all user-facing copy.
- **Ledger is append-only.** Never mutate or delete an entry.
- **Commit after every task.**

---

### Task 1: Test infrastructure

**Files:**
- Modify: `package.json`
- Create: `vitest.config.mts`
- Create: `vitest.setup.ts`
- Test: `lib/platform/__tests__/smoke.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `npm test` (single run) and `npm run test:watch`. A `jsdom` environment with `localStorage` available. All later tasks depend on this.

- [ ] **Step 1: Install dev dependencies**

```bash
npm install -D vitest@^3 @vitejs/plugin-react@^5 jsdom@^26 @testing-library/react@^16 @testing-library/jest-dom@^6 @testing-library/user-event@^14
```

- [ ] **Step 2: Create `vitest.config.mts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    include: ["**/__tests__/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next"],
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
});
```

- [ ] **Step 3: Create `vitest.setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
  localStorage.clear();
});
```

- [ ] **Step 4: Add scripts to `package.json`**

Add to the `"scripts"` object:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Write the smoke test**

Create `lib/platform/__tests__/smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("test infrastructure", () => {
  it("runs tests", () => {
    expect(true).toBe(true);
  });

  it("provides a jsdom localStorage", () => {
    localStorage.setItem("k", "v");
    expect(localStorage.getItem("k")).toBe("v");
  });
});
```

- [ ] **Step 6: Run tests**

Run: `npm test`
Expected: PASS, 2 tests.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.mts vitest.setup.ts lib/platform/__tests__/smoke.test.ts
git commit -m "test: add vitest + testing-library infrastructure"
```

---

### Task 2: Cartridge contract and trust boundary

**Files:**
- Create: `lib/platform/cartridge.ts`
- Test: `lib/platform/__tests__/cartridge.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `type CartridgeRuntime = "canvas" | "godot"`
  - `interface CartridgeMeta { id: string; runtime: CartridgeRuntime; supportsPause?: boolean }`
  - `interface CartridgeHost` with methods `reportScore(score: number): void`, `reportEvent(name: string, value?: number): void`, `saveState(key: string, value: unknown): Promise<void>`, `loadState<T>(key: string): Promise<T | null>`, `onPause(cb: () => void): void`, `onResume(cb: () => void): void`
  - `const CARTRIDGE_HOST_METHODS: readonly string[]` — the exact allowed surface, used by the boundary test
  - `const FORBIDDEN_HOST_METHODS: readonly string[]` — names that must never appear

- [ ] **Step 1: Write the failing test**

Create `lib/platform/__tests__/cartridge.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  CARTRIDGE_HOST_METHODS,
  FORBIDDEN_HOST_METHODS,
} from "@/lib/platform/cartridge";

describe("cartridge trust boundary", () => {
  it("exposes exactly the allowed surface", () => {
    expect([...CARTRIDGE_HOST_METHODS].sort()).toEqual([
      "loadState",
      "onPause",
      "onResume",
      "reportEvent",
      "reportScore",
      "saveState",
    ]);
  });

  it("names no currency-minting method", () => {
    for (const forbidden of FORBIDDEN_HOST_METHODS) {
      expect(CARTRIDGE_HOST_METHODS).not.toContain(forbidden);
    }
  });

  it("forbids the specific mint surface we care about", () => {
    expect(FORBIDDEN_HOST_METHODS).toContain("awardTokens");
    expect(FORBIDDEN_HOST_METHODS).toContain("setBalance");
    expect(FORBIDDEN_HOST_METHODS).toContain("appendLedger");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- cartridge`
Expected: FAIL — cannot resolve `@/lib/platform/cartridge`.

- [ ] **Step 3: Write the implementation**

Create `lib/platform/cartridge.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- cartridge`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/platform/cartridge.ts lib/platform/__tests__/cartridge.test.ts
git commit -m "feat(platform): add cartridge contract and trust boundary"
```

---

### Task 3: Storage adapter interface and localStorage implementation

**Files:**
- Create: `lib/platform/storage/types.ts`
- Create: `lib/platform/storage/localStorage.ts`
- Test: `lib/platform/storage/__tests__/adapterContract.ts` (shared suite, not a test file itself)
- Test: `lib/platform/storage/__tests__/localStorage.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `interface LedgerEntry { id: string; playerId: string; gameId: string | null; delta: number; reason: LedgerReason; balanceAfter: number; createdAt: string }`
  - `type LedgerReason = "score" | "event" | "daily_bonus" | "purchase" | "exchange" | "adjustment"`
  - `interface StorageAdapter` with `get<T>(scope, key): Promise<T | null>`, `set(scope, key, value): Promise<void>`, `appendLedger(entry): Promise<void>`, `readLedger(playerId): Promise<LedgerEntry[]>`
  - `class LocalStorageAdapter implements StorageAdapter`
  - `function runAdapterContractTests(name: string, make: () => StorageAdapter): void`

- [ ] **Step 1: Write the failing test**

Create `lib/platform/storage/__tests__/adapterContract.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import type { StorageAdapter, LedgerEntry } from "@/lib/platform/storage/types";

function entry(over: Partial<LedgerEntry> = {}): LedgerEntry {
  return {
    id: "e1",
    playerId: "p1",
    gameId: "asteroids",
    delta: 10,
    reason: "score",
    balanceAfter: 10,
    createdAt: "2026-07-19T10:00:00.000Z",
    ...over,
  };
}

/** Shared behaviour every StorageAdapter must satisfy. */
export function runAdapterContractTests(name: string, make: () => StorageAdapter) {
  describe(`${name} — StorageAdapter contract`, () => {
    let adapter: StorageAdapter;
    beforeEach(() => {
      adapter = make();
    });

    it("returns null for a missing key", async () => {
      expect(await adapter.get("save", "nope")).toBeNull();
    });

    it("round-trips a value", async () => {
      await adapter.set("save", "k", { a: 1 });
      expect(await adapter.get<{ a: number }>("save", "k")).toEqual({ a: 1 });
    });

    it("isolates scopes", async () => {
      await adapter.set("save", "k", "one");
      await adapter.set("other", "k", "two");
      expect(await adapter.get("save", "k")).toBe("one");
      expect(await adapter.get("other", "k")).toBe("two");
    });

    it("starts with an empty ledger", async () => {
      expect(await adapter.readLedger("p1")).toEqual([]);
    });

    it("appends ledger entries in order", async () => {
      await adapter.appendLedger(entry({ id: "e1" }));
      await adapter.appendLedger(entry({ id: "e2", delta: 5, balanceAfter: 15 }));
      const log = await adapter.readLedger("p1");
      expect(log.map((e) => e.id)).toEqual(["e1", "e2"]);
    });

    it("separates ledgers by player", async () => {
      await adapter.appendLedger(entry({ id: "a", playerId: "p1" }));
      await adapter.appendLedger(entry({ id: "b", playerId: "p2" }));
      expect(await adapter.readLedger("p1")).toHaveLength(1);
      expect(await adapter.readLedger("p2")).toHaveLength(1);
    });
  });
}
```

Create `lib/platform/storage/__tests__/localStorage.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { LocalStorageAdapter } from "@/lib/platform/storage/localStorage";
import { runAdapterContractTests } from "./adapterContract";

runAdapterContractTests("LocalStorageAdapter", () => new LocalStorageAdapter());

describe("LocalStorageAdapter specifics", () => {
  it("survives corrupt JSON by returning null", async () => {
    localStorage.setItem("bg:save:broken", "{not json");
    const adapter = new LocalStorageAdapter();
    expect(await adapter.get("save", "broken")).toBeNull();
  });

  it("namespaces keys under bg:", async () => {
    const adapter = new LocalStorageAdapter();
    await adapter.set("save", "k", 1);
    expect(localStorage.getItem("bg:save:k")).toBe("1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- storage`
Expected: FAIL — cannot resolve `@/lib/platform/storage/localStorage`.

- [ ] **Step 3: Write the types**

Create `lib/platform/storage/types.ts`:

```ts
export type LedgerReason =
  | "score"
  | "event"
  | "daily_bonus"
  | "purchase"
  | "exchange"
  | "adjustment";

/** Append-only. Never mutate or delete an entry. */
export interface LedgerEntry {
  id: string;
  playerId: string;
  gameId: string | null;
  /** Positive to earn, negative to spend. */
  delta: number;
  reason: LedgerReason;
  /** Balance after this entry applied — makes reads O(1). */
  balanceAfter: number;
  /** ISO-8601 UTC. */
  createdAt: string;
}

/**
 * All persistence goes through this interface so the backend can be swapped
 * without touching game code. Phase 1 uses localStorage; Phase 2 swaps in
 * MongoDB by setting MONGODB_URI.
 */
export interface StorageAdapter {
  get<T>(scope: string, key: string): Promise<T | null>;
  set(scope: string, key: string, value: unknown): Promise<void>;
  appendLedger(entry: LedgerEntry): Promise<void>;
  readLedger(playerId: string): Promise<LedgerEntry[]>;
}
```

- [ ] **Step 4: Write the localStorage implementation**

Create `lib/platform/storage/localStorage.ts`:

```ts
import type { LedgerEntry, StorageAdapter } from "./types";

const PREFIX = "bg";

function ledgerKey(playerId: string) {
  return `${PREFIX}:ledger:${playerId}`;
}

/**
 * Phase 1 adapter. Balances are user-editable via DevTools — accepted,
 * because there is no real money and nothing to steal. The point of Phase 1
 * is that the authority boundary sits in the right place.
 */
export class LocalStorageAdapter implements StorageAdapter {
  async get<T>(scope: string, key: string): Promise<T | null> {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(`${PREFIX}:${scope}:${key}`);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      // Corrupt entry — treat as absent rather than crashing the game.
      return null;
    }
  }

  async set(scope: string, key: string, value: unknown): Promise<void> {
    if (typeof window === "undefined") return;
    localStorage.setItem(`${PREFIX}:${scope}:${key}`, JSON.stringify(value));
  }

  async appendLedger(entry: LedgerEntry): Promise<void> {
    if (typeof window === "undefined") return;
    const log = await this.readLedger(entry.playerId);
    log.push(entry);
    localStorage.setItem(ledgerKey(entry.playerId), JSON.stringify(log));
  }

  async readLedger(playerId: string): Promise<LedgerEntry[]> {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem(ledgerKey(playerId));
    if (raw === null) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as LedgerEntry[]) : [];
    } catch {
      return [];
    }
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- storage`
Expected: PASS, 8 tests.

- [ ] **Step 6: Commit**

```bash
git add lib/platform/storage
git commit -m "feat(platform): add storage adapter interface and localStorage impl"
```

---

### Task 4: Mongo adapter stub and adapter selection

**Files:**
- Create: `lib/platform/storage/mongo.ts`
- Create: `lib/platform/storage/index.ts`
- Test: `lib/platform/storage/__tests__/select.test.ts`

**Interfaces:**
- Consumes: `StorageAdapter`, `LocalStorageAdapter` (Task 3)
- Produces:
  - `class MongoAdapter implements StorageAdapter` — every method throws `Error("MongoAdapter not implemented until Phase 2")`
  - `function selectAdapter(env?: { MONGODB_URI?: string }): StorageAdapter`
  - `function getStorage(): StorageAdapter` — module-level singleton

- [ ] **Step 1: Write the failing test**

Create `lib/platform/storage/__tests__/select.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { selectAdapter } from "@/lib/platform/storage";
import { LocalStorageAdapter } from "@/lib/platform/storage/localStorage";
import { MongoAdapter } from "@/lib/platform/storage/mongo";

describe("selectAdapter", () => {
  it("uses localStorage when MONGODB_URI is absent", () => {
    expect(selectAdapter({})).toBeInstanceOf(LocalStorageAdapter);
  });

  it("uses localStorage when MONGODB_URI is empty", () => {
    expect(selectAdapter({ MONGODB_URI: "" })).toBeInstanceOf(LocalStorageAdapter);
  });

  it("uses Mongo when MONGODB_URI is set", () => {
    expect(selectAdapter({ MONGODB_URI: "mongodb+srv://x" })).toBeInstanceOf(MongoAdapter);
  });
});

describe("MongoAdapter", () => {
  it("throws a clear not-implemented error", async () => {
    const adapter = new MongoAdapter();
    await expect(adapter.get("save", "k")).rejects.toThrow(/Phase 2/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- select`
Expected: FAIL — cannot resolve `@/lib/platform/storage`.

- [ ] **Step 3: Write the Mongo stub**

Create `lib/platform/storage/mongo.ts`:

```ts
import type { LedgerEntry, StorageAdapter } from "./types";

const NOT_IMPLEMENTED = "MongoAdapter not implemented until Phase 2";

/**
 * Phase 2 placeholder. Exists so adapter selection is real from day one —
 * setting MONGODB_URI selects this and fails loudly rather than silently
 * falling back to localStorage and appearing to work.
 */
export class MongoAdapter implements StorageAdapter {
  async get<T>(_scope: string, _key: string): Promise<T | null> {
    throw new Error(NOT_IMPLEMENTED);
  }
  async set(_scope: string, _key: string, _value: unknown): Promise<void> {
    throw new Error(NOT_IMPLEMENTED);
  }
  async appendLedger(_entry: LedgerEntry): Promise<void> {
    throw new Error(NOT_IMPLEMENTED);
  }
  async readLedger(_playerId: string): Promise<LedgerEntry[]> {
    throw new Error(NOT_IMPLEMENTED);
  }
}
```

- [ ] **Step 4: Write the selector**

Create `lib/platform/storage/index.ts`:

```ts
import type { StorageAdapter } from "./types";
import { LocalStorageAdapter } from "./localStorage";
import { MongoAdapter } from "./mongo";

export type { StorageAdapter, LedgerEntry, LedgerReason } from "./types";
export { LocalStorageAdapter } from "./localStorage";
export { MongoAdapter } from "./mongo";

/**
 * Phase 1 ships localStorage. Supplying MONGODB_URI in Phase 2 activates the
 * real backend with no change to game code.
 */
export function selectAdapter(env: { MONGODB_URI?: string } = {}): StorageAdapter {
  return env.MONGODB_URI ? new MongoAdapter() : new LocalStorageAdapter();
}

let cached: StorageAdapter | null = null;

/**
 * The adapter used by client-side game code.
 *
 * Phase 1 is always localStorage: MONGODB_URI is a server-only secret and must
 * never reach the browser. Phase 2 moves persistence behind an API route, and
 * `selectAdapter` runs there — on the server — where the URI is readable.
 * Keeping the seam tested now is what makes that a swap rather than a rewrite.
 */
export function getStorage(): StorageAdapter {
  if (cached === null) cached = new LocalStorageAdapter();
  return cached;
}

/** Test-only: reset the singleton between cases. */
export function __resetStorage(): void {
  cached = null;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- select`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add lib/platform/storage
git commit -m "feat(platform): add Mongo adapter stub and env-based selection"
```

---

### Task 5: Earn rates configuration

**Files:**
- Create: `lib/platform/earnRates.ts`
- Test: `lib/platform/__tests__/earnRates.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `interface EarnRate { tokensPerPoint: number; dailyCap: number }`
  - `const DEFAULT_RATE: EarnRate`
  - `const GAME_RATES: Record<string, Partial<EarnRate>>`
  - `const EVENT_REWARDS: Record<string, number>`
  - `const GLOBAL_DAILY_CAP: number`
  - `function rateFor(gameId: string): EarnRate`
  - `function rewardForEvent(name: string): number`

- [ ] **Step 1: Write the failing test**

Create `lib/platform/__tests__/earnRates.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  rateFor,
  rewardForEvent,
  DEFAULT_RATE,
  GLOBAL_DAILY_CAP,
} from "@/lib/platform/earnRates";

describe("rateFor", () => {
  it("falls back to the default for unknown games", () => {
    expect(rateFor("does-not-exist")).toEqual(DEFAULT_RATE);
  });

  it("applies a per-game override", () => {
    // asteroids scores in the thousands, so its rate is lowered.
    expect(rateFor("asteroids").tokensPerPoint).toBeLessThan(DEFAULT_RATE.tokensPerPoint);
  });

  it("merges partial overrides over the default", () => {
    const rate = rateFor("asteroids");
    expect(rate.dailyCap).toBeGreaterThan(0);
    expect(typeof rate.tokensPerPoint).toBe("number");
  });
});

describe("rewardForEvent", () => {
  it("rewards known events", () => {
    expect(rewardForEvent("level_cleared")).toBeGreaterThan(0);
    expect(rewardForEvent("match_won")).toBeGreaterThan(0);
  });

  it("returns 0 for unknown events so games cannot invent rewards", () => {
    expect(rewardForEvent("i_win_a_million")).toBe(0);
  });
});

describe("caps", () => {
  it("has a global daily cap at least as large as a single game cap", () => {
    expect(GLOBAL_DAILY_CAP).toBeGreaterThanOrEqual(DEFAULT_RATE.dailyCap);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- earnRates`
Expected: FAIL — cannot resolve `@/lib/platform/earnRates`.

- [ ] **Step 3: Write the implementation**

Create `lib/platform/earnRates.ts`:

```ts
/**
 * Platform-owned economy configuration.
 *
 * Game code must never be able to reach this. Third-party creators set none
 * of these values — that is what prevents "Click Button → 1,000,000 B-Tokens".
 *
 * All tuning happens in this one file.
 */

export interface EarnRate {
  /** B-Tokens granted per point of reported score. */
  tokensPerPoint: number;
  /** Max B-Tokens earnable from this game per UTC day. */
  dailyCap: number;
}

export const DEFAULT_RATE: EarnRate = {
  tokensPerPoint: 0.01,
  dailyCap: 200,
};

/**
 * Per-game overrides. Games with inflated score scales get lower rates so a
 * point is worth roughly the same across the catalogue.
 */
export const GAME_RATES: Record<string, Partial<EarnRate>> = {
  asteroids: { tokensPerPoint: 0.002 },
  breakout: { tokensPerPoint: 0.005 },
  "apple-shooter": { tokensPerPoint: 0.005 },
  "dam-rush": { tokensPerPoint: 0.005 },
};

/** Flat rewards for non-score games. Unknown events are worth nothing. */
export const EVENT_REWARDS: Record<string, number> = {
  level_cleared: 5,
  match_won: 10,
  puzzle_solved: 5,
};

/** Ceiling across all games per UTC day — prevents farming many games. */
export const GLOBAL_DAILY_CAP = 500;

export function rateFor(gameId: string): EarnRate {
  return { ...DEFAULT_RATE, ...(GAME_RATES[gameId] ?? {}) };
}

export function rewardForEvent(name: string): number {
  return EVENT_REWARDS[name] ?? 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- earnRates`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/platform/earnRates.ts lib/platform/__tests__/earnRates.test.ts
git commit -m "feat(platform): add platform-owned earn rate config"
```

---

### Task 6: Economy — ledger, balance, and caps

**Files:**
- Create: `lib/platform/economy.ts`
- Test: `lib/platform/__tests__/economy.test.ts`

**Interfaces:**
- Consumes: `StorageAdapter`, `LedgerEntry` (Task 3); `rateFor`, `rewardForEvent`, `GLOBAL_DAILY_CAP` (Task 5)
- Produces:
  - `class Economy` constructed as `new Economy(storage: StorageAdapter, playerId: string, now?: () => Date)`
  - `economy.getBalance(): Promise<number>`
  - `economy.applyScore(gameId: string, score: number): Promise<number>` — returns tokens actually granted
  - `economy.applyEvent(gameId: string, event: string): Promise<number>` — returns tokens actually granted
  - `economy.spend(amount: number, reason: LedgerReason, gameId?: string | null): Promise<boolean>`
  - `economy.earnedToday(gameId?: string): Promise<number>`

- [ ] **Step 1: Write the failing test**

Create `lib/platform/__tests__/economy.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { Economy } from "@/lib/platform/economy";
import { LocalStorageAdapter } from "@/lib/platform/storage/localStorage";
import { GLOBAL_DAILY_CAP, rateFor } from "@/lib/platform/earnRates";

const DAY1 = new Date("2026-07-19T12:00:00.000Z");
const DAY2 = new Date("2026-07-20T12:00:00.000Z");

function makeEconomy(now: () => Date = () => DAY1) {
  return new Economy(new LocalStorageAdapter(), "p1", now);
}

describe("Economy balance", () => {
  beforeEach(() => localStorage.clear());

  it("starts at zero", async () => {
    expect(await makeEconomy().getBalance()).toBe(0);
  });

  it("derives balance from ledger entries", async () => {
    const e = makeEconomy();
    await e.applyScore("pong", 100); // default 0.01/pt = 1 token
    await e.applyScore("pong", 100);
    expect(await e.getBalance()).toBe(2);
  });
});

describe("Economy earning", () => {
  beforeEach(() => localStorage.clear());

  it("applies the per-game rate", async () => {
    const e = makeEconomy();
    const granted = await e.applyScore("asteroids", 1000); // 0.002/pt = 2
    expect(granted).toBe(2);
  });

  it("floors fractional tokens", async () => {
    const e = makeEconomy();
    expect(await e.applyScore("pong", 50)).toBe(0); // 0.5 -> 0
  });

  it("rejects negative scores", async () => {
    const e = makeEconomy();
    expect(await e.applyScore("pong", -500)).toBe(0);
    expect(await e.getBalance()).toBe(0);
  });

  it("grants flat rewards for known events", async () => {
    const e = makeEconomy();
    expect(await e.applyEvent("lights-out", "level_cleared")).toBe(5);
  });

  it("grants nothing for unknown events", async () => {
    const e = makeEconomy();
    expect(await e.applyEvent("lights-out", "free_money")).toBe(0);
  });
});

describe("Economy caps", () => {
  beforeEach(() => localStorage.clear());

  it("enforces the per-game daily cap", async () => {
    const e = makeEconomy();
    const cap = rateFor("pong").dailyCap;
    await e.applyScore("pong", cap * 100 * 2); // far over cap
    expect(await e.earnedToday("pong")).toBe(cap);
  });

  it("clamps the final grant to the remaining cap", async () => {
    const e = makeEconomy();
    const cap = rateFor("pong").dailyCap;
    await e.applyScore("pong", (cap - 1) * 100); // cap-1 tokens
    const granted = await e.applyScore("pong", 100 * 50); // wants 50 more
    expect(granted).toBe(1);
  });

  it("enforces the global daily cap across games", async () => {
    const e = makeEconomy();
    await e.applyScore("pong", 100 * 200);
    await e.applyScore("tetris", 100 * 200);
    await e.applyScore("snake", 100 * 200);
    expect(await e.earnedToday()).toBe(GLOBAL_DAILY_CAP);
  });

  it("resets caps on a new UTC day", async () => {
    let now = DAY1;
    const e = new Economy(new LocalStorageAdapter(), "p1", () => now);
    const cap = rateFor("pong").dailyCap;
    await e.applyScore("pong", cap * 100 * 2);
    expect(await e.earnedToday("pong")).toBe(cap);
    now = DAY2;
    expect(await e.earnedToday("pong")).toBe(0);
    expect(await e.applyScore("pong", 100)).toBe(1);
  });

  it("excludes spending from earned-today", async () => {
    const e = makeEconomy();
    await e.applyScore("pong", 100 * 10); // +10
    await e.spend(5, "purchase");
    expect(await e.earnedToday()).toBe(10);
    expect(await e.getBalance()).toBe(5);
  });
});

describe("Economy spending", () => {
  beforeEach(() => localStorage.clear());

  it("rejects spending more than the balance", async () => {
    const e = makeEconomy();
    await e.applyScore("pong", 100 * 3); // +3
    expect(await e.spend(10, "purchase")).toBe(false);
    expect(await e.getBalance()).toBe(3);
  });

  it("allows an affordable purchase", async () => {
    const e = makeEconomy();
    await e.applyScore("pong", 100 * 10);
    expect(await e.spend(4, "purchase")).toBe(true);
    expect(await e.getBalance()).toBe(6);
  });

  it("rejects a negative spend", async () => {
    const e = makeEconomy();
    await e.applyScore("pong", 100 * 10);
    expect(await e.spend(-5, "purchase")).toBe(false);
    expect(await e.getBalance()).toBe(10);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- economy`
Expected: FAIL — cannot resolve `@/lib/platform/economy`.

- [ ] **Step 3: Write the implementation**

Create `lib/platform/economy.ts`:

```ts
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
      id: `${createdAt}-${Math.random().toString(36).slice(2, 10)}`,
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- economy`
Expected: PASS, 15 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/platform/economy.ts lib/platform/__tests__/economy.test.ts
git commit -m "feat(platform): add B-Token economy with append-only ledger and daily caps"
```

---

### Task 7: Player identity

**Files:**
- Create: `lib/platform/player.ts`
- Test: `lib/platform/__tests__/player.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `function getPlayerId(): string` — stable device-local id, created on first call. Phase 2 replaces this with the authenticated account id.

- [ ] **Step 1: Write the failing test**

Create `lib/platform/__tests__/player.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { getPlayerId } from "@/lib/platform/player";

describe("getPlayerId", () => {
  beforeEach(() => localStorage.clear());

  it("creates an id on first call", () => {
    expect(getPlayerId()).toMatch(/^anon-/);
  });

  it("returns the same id across calls", () => {
    expect(getPlayerId()).toBe(getPlayerId());
  });

  it("persists the id in localStorage", () => {
    const id = getPlayerId();
    expect(localStorage.getItem("bg:playerId")).toBe(id);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- player`
Expected: FAIL — cannot resolve `@/lib/platform/player`.

- [ ] **Step 3: Write the implementation**

Create `lib/platform/player.ts`:

```ts
const KEY = "bg:playerId";

/**
 * Phase 1 identity: a device-local anonymous id. Phase 2 replaces this with
 * the authenticated account id; the ledger is keyed by whatever this returns,
 * so the migration is a matter of mapping anon -> account once at sign-up.
 */
export function getPlayerId(): string {
  if (typeof window === "undefined") return "anon-ssr";
  const existing = localStorage.getItem(KEY);
  if (existing) return existing;
  const id = `anon-${Math.random().toString(36).slice(2, 12)}`;
  localStorage.setItem(KEY, id);
  return id;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- player`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/platform/player.ts lib/platform/__tests__/player.test.ts
git commit -m "feat(platform): add anonymous device-local player identity"
```

---

### Task 8: Save API with legacy key preservation

**Files:**
- Create: `lib/platform/legacyKeys.ts`
- Create: `lib/platform/save.ts`
- Test: `lib/platform/__tests__/save.test.ts`

**Interfaces:**
- Consumes: `StorageAdapter` (Task 3)
- Produces:
  - `const LEGACY_HIGH_SCORE_KEYS: Record<string, string>`
  - `class SaveApi` constructed as `new SaveApi(storage: StorageAdapter)`
  - `save.getHighScore(gameId: string): Promise<number>`
  - `save.setHighScore(gameId: string, score: number): Promise<boolean>` — true when a new record
  - `save.getState<T>(gameId: string, key: string): Promise<T | null>`
  - `save.setState(gameId: string, key: string, value: unknown): Promise<void>`

**Why this matters:** players have real high scores under inconsistent per-game keys. Reading the legacy key on first access means nobody loses progress.

- [ ] **Step 1: Write the failing test**

Create `lib/platform/__tests__/save.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { SaveApi } from "@/lib/platform/save";
import { LocalStorageAdapter } from "@/lib/platform/storage/localStorage";

function makeSave() {
  return new SaveApi(new LocalStorageAdapter());
}

describe("SaveApi high scores", () => {
  beforeEach(() => localStorage.clear());

  it("returns 0 for a game with no score", async () => {
    expect(await makeSave().getHighScore("pong")).toBe(0);
  });

  it("stores and reads a high score", async () => {
    const s = makeSave();
    await s.setHighScore("pong", 500);
    expect(await s.getHighScore("pong")).toBe(500);
  });

  it("reports true only on a new record", async () => {
    const s = makeSave();
    expect(await s.setHighScore("pong", 500)).toBe(true);
    expect(await s.setHighScore("pong", 400)).toBe(false);
    expect(await s.setHighScore("pong", 900)).toBe(true);
  });

  it("keeps the higher score when a lower one is submitted", async () => {
    const s = makeSave();
    await s.setHighScore("pong", 500);
    await s.setHighScore("pong", 100);
    expect(await s.getHighScore("pong")).toBe(500);
  });
});

describe("SaveApi legacy migration", () => {
  beforeEach(() => localStorage.clear());

  it("reads a pre-existing legacy high score", async () => {
    localStorage.setItem("asteroids-highscore", "4200");
    expect(await makeSave().getHighScore("asteroids")).toBe(4200);
  });

  it("reads the differently-named lights-out legacy key", async () => {
    localStorage.setItem("lightsout-best", "7");
    expect(await makeSave().getHighScore("lights-out")).toBe(7);
  });

  it("prefers the platform score once it exceeds the legacy one", async () => {
    localStorage.setItem("asteroids-highscore", "4200");
    const s = makeSave();
    await s.setHighScore("asteroids", 5000);
    expect(await s.getHighScore("asteroids")).toBe(5000);
  });

  it("ignores a corrupt legacy value", async () => {
    localStorage.setItem("asteroids-highscore", "not-a-number");
    expect(await makeSave().getHighScore("asteroids")).toBe(0);
  });
});

describe("SaveApi state", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips arbitrary state", async () => {
    const s = makeSave();
    await s.setState("tetris", "settings", { ghost: true });
    expect(await s.getState<{ ghost: boolean }>("tetris", "settings")).toEqual({ ghost: true });
  });

  it("scopes state per game", async () => {
    const s = makeSave();
    await s.setState("tetris", "k", 1);
    await s.setState("pong", "k", 2);
    expect(await s.getState("tetris", "k")).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- save`
Expected: FAIL — cannot resolve `@/lib/platform/save`.

- [ ] **Step 3: Write the legacy key map**

Create `lib/platform/legacyKeys.ts`:

```ts
/**
 * Pre-platform localStorage keys, by game slug.
 *
 * These were written by each game independently and follow no convention
 * (-highscore, -high, -best, -wins). Players have real scores under them, so
 * SaveApi reads these as a fallback and never orphans them.
 *
 * Add an entry here when migrating a game whose legacy key is not listed.
 */
export const LEGACY_HIGH_SCORE_KEYS: Record<string, string> = {
  asteroids: "asteroids-highscore",
  "apple-shooter": "apple-shooter-highscore",
  battleship: "battleship-best",
  breakout: "breakout-highscore",
  "bubble-shooter": "bubble-highscore",
  centipede: "centipede-high",
  "dam-rush": "dam-rush-highscore",
  "dino-runner": "dino-highscore",
  frogger: "frogger-highscore",
  "lights-out": "lightsout-best",
  "tank-shooter": "bc-best",
  "air-hockey": "airhockey-wins",
};
```

- [ ] **Step 4: Write the save API**

Create `lib/platform/save.ts`:

```ts
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- save`
Expected: PASS, 10 tests.

- [ ] **Step 6: Commit**

```bash
git add lib/platform/save.ts lib/platform/legacyKeys.ts lib/platform/__tests__/save.test.ts
git commit -m "feat(platform): add unified save API preserving legacy high-score keys"
```

---

### Task 9: useCartridge hook

**Files:**
- Create: `lib/platform/useCartridge.ts`
- Test: `lib/platform/__tests__/useCartridge.test.tsx`

**Interfaces:**
- Consumes: `CartridgeHost`, `CARTRIDGE_HOST_METHODS` (Task 2); `getStorage` (Task 4); `Economy` (Task 6); `getPlayerId` (Task 7); `SaveApi` (Task 8)
- Produces:
  - `interface UseCartridgeResult { host: CartridgeHost; highScore: number; balance: number; lastAward: number }`
  - `function useCartridge(gameId: string): UseCartridgeResult`

- [ ] **Step 1: Write the failing test**

Create `lib/platform/__tests__/useCartridge.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useCartridge } from "@/lib/platform/useCartridge";
import { CARTRIDGE_HOST_METHODS } from "@/lib/platform/cartridge";

describe("useCartridge", () => {
  beforeEach(() => localStorage.clear());

  it("exposes only the allowed host surface", () => {
    const { result } = renderHook(() => useCartridge("pong"));
    const keys = Object.keys(result.current.host).sort();
    expect(keys).toEqual([...CARTRIDGE_HOST_METHODS].sort());
  });

  it("exposes no token-minting method", () => {
    const { result } = renderHook(() => useCartridge("pong"));
    expect(result.current.host).not.toHaveProperty("awardTokens");
    expect(result.current.host).not.toHaveProperty("appendLedger");
  });

  it("records a high score through reportScore", async () => {
    const { result } = renderHook(() => useCartridge("pong"));
    await act(async () => {
      result.current.host.reportScore(500);
    });
    await waitFor(() => expect(result.current.highScore).toBe(500));
  });

  it("awards B-Tokens for a reported score", async () => {
    const { result } = renderHook(() => useCartridge("pong"));
    await act(async () => {
      result.current.host.reportScore(1000); // 0.01/pt = 10
    });
    await waitFor(() => expect(result.current.balance).toBe(10));
    expect(result.current.lastAward).toBe(10);
  });

  it("awards B-Tokens for a known event", async () => {
    const { result } = renderHook(() => useCartridge("lights-out"));
    await act(async () => {
      result.current.host.reportEvent("level_cleared");
    });
    await waitFor(() => expect(result.current.balance).toBe(5));
  });

  it("awards nothing for an unknown event", async () => {
    const { result } = renderHook(() => useCartridge("lights-out"));
    await act(async () => {
      result.current.host.reportEvent("free_money");
    });
    await waitFor(() => expect(result.current.lastAward).toBe(0));
    expect(result.current.balance).toBe(0);
  });

  it("round-trips game state", async () => {
    const { result } = renderHook(() => useCartridge("pong"));
    await act(async () => {
      await result.current.host.saveState("k", { v: 1 });
    });
    const loaded = await result.current.host.loadState<{ v: number }>("k");
    expect(loaded).toEqual({ v: 1 });
  });

  it("loads the existing high score on mount", async () => {
    localStorage.setItem("asteroids-highscore", "4200");
    const { result } = renderHook(() => useCartridge("asteroids"));
    await waitFor(() => expect(result.current.highScore).toBe(4200));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- useCartridge`
Expected: FAIL — cannot resolve `@/lib/platform/useCartridge`.

- [ ] **Step 3: Write the implementation**

Create `lib/platform/useCartridge.ts`:

```ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CartridgeHost } from "./cartridge";
import { getStorage } from "./storage";
import { Economy } from "./economy";
import { SaveApi } from "./save";
import { getPlayerId } from "./player";

export interface UseCartridgeResult {
  /** Pass this to game code. It is the entire trusted surface. */
  host: CartridgeHost;
  highScore: number;
  balance: number;
  /** Tokens granted by the most recent report — for "+5 B-Tokens" toasts. */
  lastAward: number;
}

/**
 * Adopting the platform from a canvas game is three lines:
 *
 *   const { host, highScore } = useCartridge("pong");
 *   ...
 *   host.reportScore(finalScore);
 */
export function useCartridge(gameId: string): UseCartridgeResult {
  const [highScore, setHighScore] = useState(0);
  const [balance, setBalance] = useState(0);
  const [lastAward, setLastAward] = useState(0);

  const pauseCbs = useRef<Array<() => void>>([]);
  const resumeCbs = useRef<Array<() => void>>([]);

  const { economy, save } = useMemo(() => {
    const storage = getStorage();
    return {
      economy: new Economy(storage, getPlayerId()),
      save: new SaveApi(storage),
    };
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const [hs, bal] = await Promise.all([
        save.getHighScore(gameId),
        economy.getBalance(),
      ]);
      if (!active) return;
      setHighScore(hs);
      setBalance(bal);
    })();
    return () => {
      active = false;
    };
  }, [gameId, save, economy]);

  const reportScore = useCallback(
    (score: number) => {
      void (async () => {
        const isRecord = await save.setHighScore(gameId, score);
        if (isRecord) setHighScore(score);
        const granted = await economy.applyScore(gameId, score);
        setLastAward(granted);
        if (granted > 0) setBalance(await economy.getBalance());
      })();
    },
    [gameId, save, economy],
  );

  const reportEvent = useCallback(
    (name: string, _value?: number) => {
      void (async () => {
        const granted = await economy.applyEvent(gameId, name);
        setLastAward(granted);
        if (granted > 0) setBalance(await economy.getBalance());
      })();
    },
    [gameId, economy],
  );

  const host = useMemo<CartridgeHost>(
    () => ({
      reportScore,
      reportEvent,
      saveState: (key, value) => save.setState(gameId, key, value),
      loadState: <T,>(key: string) => save.getState<T>(gameId, key),
      onPause: (cb) => {
        pauseCbs.current.push(cb);
      },
      onResume: (cb) => {
        resumeCbs.current.push(cb);
      },
    }),
    [gameId, reportScore, reportEvent, save],
  );

  return { host, highScore, balance, lastAward };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- useCartridge`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/platform/useCartridge.ts lib/platform/__tests__/useCartridge.test.tsx
git commit -m "feat(platform): add useCartridge hook wiring games to save and economy"
```

---

### Task 10: GameShell — loading screen, pause, fullscreen

**Files:**
- Create: `app/components/GameShell.tsx`
- Test: `app/components/__tests__/GameShell.test.tsx`

**Interfaces:**
- Consumes: `CartridgeMeta` (Task 2)
- Produces: `function GameShell(props: { meta: CartridgeMeta; accent: string; children: React.ReactNode }): JSX.Element`

**Why:** wrapping all 43 games gives every one of them a loading screen, pause overlay, and fullscreen with **zero changes to game code**.

- [ ] **Step 1: Write the failing test**

Create `app/components/__tests__/GameShell.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GameShell from "@/app/components/GameShell";

const meta = { id: "pong", runtime: "canvas" as const };

describe("GameShell", () => {
  it("renders its child game", () => {
    render(
      <GameShell meta={meta} accent="#ff6b1a">
        <div data-testid="game">GAME</div>
      </GameShell>,
    );
    expect(screen.getByTestId("game")).toBeInTheDocument();
  });

  it("shows a pause button by default", () => {
    render(
      <GameShell meta={meta} accent="#ff6b1a">
        <div />
      </GameShell>,
    );
    expect(screen.getByRole("button", { name: /pause/i })).toBeInTheDocument();
  });

  it("hides the pause button when the game handles its own pause", () => {
    render(
      <GameShell meta={{ ...meta, supportsPause: false }} accent="#ff6b1a">
        <div />
      </GameShell>,
    );
    expect(screen.queryByRole("button", { name: /pause/i })).not.toBeInTheDocument();
  });

  it("opens the pause overlay when paused", async () => {
    const user = userEvent.setup();
    render(
      <GameShell meta={meta} accent="#ff6b1a">
        <div />
      </GameShell>,
    );
    await user.click(screen.getByRole("button", { name: /pause/i }));
    expect(screen.getByText(/paused/i)).toBeInTheDocument();
  });

  it("resumes from the pause overlay", async () => {
    const user = userEvent.setup();
    render(
      <GameShell meta={meta} accent="#ff6b1a">
        <div />
      </GameShell>,
    );
    await user.click(screen.getByRole("button", { name: /pause/i }));
    await user.click(screen.getByRole("button", { name: /resume/i }));
    expect(screen.queryByText(/paused/i)).not.toBeInTheDocument();
  });

  it("offers a fullscreen control", () => {
    render(
      <GameShell meta={meta} accent="#ff6b1a">
        <div />
      </GameShell>,
    );
    expect(screen.getByRole("button", { name: /fullscreen/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- GameShell`
Expected: FAIL — cannot resolve `@/app/components/GameShell`.

- [ ] **Step 3: Write the implementation**

Create `app/components/GameShell.tsx`:

```tsx
"use client";

import { useCallback, useRef, useState } from "react";
import type { CartridgeMeta } from "@/lib/platform/cartridge";

interface GameShellProps {
  meta: CartridgeMeta;
  /** Game accent colour from lib/games.ts, for the loading bar. */
  accent: string;
  children: React.ReactNode;
}

/**
 * Wraps every game with the shared chrome: loading screen, pause overlay, and
 * fullscreen. Unmigrated games get all of this without any change to their
 * own code.
 */
export default function GameShell({ meta, accent, children }: GameShellProps) {
  const [paused, setPaused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const canPause = meta.supportsPause !== false;

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void el.requestFullscreen?.();
    }
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="mb-2 flex items-center justify-end gap-2">
        {canPause && (
          <button
            onClick={() => setPaused(true)}
            aria-label="Pause game"
            className="pixel-edge px-3 py-1 rounded bg-[var(--surface-2)] font-[family-name:var(--font-mono)] text-base"
          >
            ⏸ Pause
          </button>
        )}
        <button
          onClick={toggleFullscreen}
          aria-label="Toggle fullscreen"
          className="pixel-edge px-3 py-1 rounded bg-[var(--surface-2)] font-[family-name:var(--font-mono)] text-base"
        >
          ⛶ Fullscreen
        </button>
      </div>

      {children}

      {paused && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/85 rounded-lg">
          <h2
            className="font-[family-name:var(--font-display)] text-lg mb-4"
            style={{ color: accent }}
          >
            PAUSED
          </h2>
          <button
            onClick={() => setPaused(false)}
            aria-label="Resume game"
            className="pixel-edge px-5 py-2 rounded bg-[var(--crt-green)] text-[var(--background)] font-[family-name:var(--font-display)] text-xs"
          >
            RESUME
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- GameShell`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add app/components/GameShell.tsx app/components/__tests__/GameShell.test.tsx
git commit -m "feat(platform): add GameShell with pause overlay and fullscreen"
```

---

### Task 11: GameLoading screen

**Files:**
- Create: `app/components/GameLoading.tsx`
- Test: `app/components/__tests__/GameLoading.test.tsx`

**Interfaces:**
- Consumes: nothing
- Produces: `function GameLoading(props: { title: string; accent: string }): JSX.Element` — the fallback shown while a lazy game chunk downloads. Used by Task 12.

- [ ] **Step 1: Write the failing test**

Create `app/components/__tests__/GameLoading.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import GameLoading from "@/app/components/GameLoading";

describe("GameLoading", () => {
  it("names the game being loaded", () => {
    render(<GameLoading title="Asteroids" accent="#ff6b1a" />);
    expect(screen.getByText(/asteroids/i)).toBeInTheDocument();
  });

  it("exposes a busy status to assistive tech", () => {
    render(<GameLoading title="Asteroids" accent="#ff6b1a" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- GameLoading`
Expected: FAIL — cannot resolve `@/app/components/GameLoading`.

- [ ] **Step 3: Write the implementation**

Create `app/components/GameLoading.tsx`:

```tsx
/**
 * Shown while a game's chunk downloads. Matters more in Phase 4, when Godot
 * builds are 30-100 MB rather than a ~50 KB canvas game.
 */
export default function GameLoading({
  title,
  accent,
}: {
  title: string;
  accent: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center gap-4 py-24"
    >
      <p className="font-[family-name:var(--font-display)] text-xs text-[var(--muted)]">
        LOADING
      </p>
      <p
        className="font-[family-name:var(--font-display)] text-base flicker"
        style={{ color: accent }}
      >
        {title.toUpperCase()}
      </p>
      <div className="h-2 w-48 overflow-hidden rounded border border-[var(--border)] bg-[var(--surface-2)]">
        <div
          className="h-full w-1/3 animate-pulse"
          style={{ background: accent }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- GameLoading`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add app/components/GameLoading.tsx app/components/__tests__/GameLoading.test.tsx
git commit -m "feat(platform): add shared game loading screen"
```

---

### Task 12: Code-split the play page

**Files:**
- Create: `app/play/[slug]/gameRegistry.ts`
- Create: `app/play/[slug]/GameFrame.tsx`
- Modify: `app/play/[slug]/page.tsx` (replace lines 1-95 — the 43 static imports and the `gameComponents` map)
- Test: `app/play/[slug]/__tests__/gameRegistry.test.ts`

**Interfaces:**
- Consumes: `games`, `getGame` from `@/lib/games`; `GameShell` (Task 10); `GameLoading` (Task 11)
- Produces:
  - `const gameLoaders: Record<string, () => Promise<{ default: React.ComponentType }>>`
  - `function GameFrame(props: { slug: string; title: string; accent: string }): JSX.Element`

**Why:** `app/play/[slug]/page.tsx:6-48` statically imports all 43 games, so every visitor downloads all 43 to play one. This is the single largest load-time win in Phase 1.

- [ ] **Step 1: Write the failing test**

Create `app/play/[slug]/__tests__/gameRegistry.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { gameLoaders } from "@/app/play/[slug]/gameRegistry";
import { games } from "@/lib/games";

describe("gameLoaders", () => {
  it("has a loader for every registered game", () => {
    const missing = games.map((g) => g.slug).filter((slug) => !(slug in gameLoaders));
    expect(missing).toEqual([]);
  });

  it("has no loader for an unregistered slug", () => {
    const slugs = new Set(games.map((g) => g.slug));
    const orphans = Object.keys(gameLoaders).filter((k) => !slugs.has(k));
    expect(orphans).toEqual([]);
  });

  it("exposes loaders as functions, not eager imports", () => {
    for (const loader of Object.values(gameLoaders)) {
      expect(typeof loader).toBe("function");
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- gameRegistry`
Expected: FAIL — cannot resolve `@/app/play/[slug]/gameRegistry`.

- [ ] **Step 3: Write the loader registry**

Create `app/play/[slug]/gameRegistry.ts`. Each entry is a function, so bundlers emit one chunk per game instead of one bundle containing all 43:

```ts
import type { ComponentType } from "react";

type Loader = () => Promise<{ default: ComponentType }>;

/**
 * One lazy loader per game. Replaces the 43 static imports that previously
 * forced every visitor to download all 43 games to play one.
 *
 * When adding a game: add a line here and an entry in lib/games.ts. The
 * gameRegistry test fails if the two drift apart.
 */
export const gameLoaders: Record<string, Loader> = {
  "dam-rush": () => import("@/app/games/dam-rush"),
  "tank-shooter": () => import("@/app/games/base-command"),
  helicopter: () => import("@/app/games/helicopter"),
  "apple-shooter": () => import("@/app/games/apple-shooter"),
  snake: () => import("@/app/games/snake"),
  // MemoryMatch is the one game still living as a flat file rather than a
  // directory. Every other app/games/*.tsx is a 1-line re-export shim.
  "memory-match": () => import("@/app/games/MemoryMatch"),
  "whack-a-mole": () => import("@/app/games/whack-a-mole"),
  "space-invaders": () => import("@/app/games/space-invaders"),
  galaga: () => import("@/app/games/galaga"),
  pacman: () => import("@/app/games/pacman"),
  "zombie-shooter": () => import("@/app/games/zombie-shooter"),
  "line-rider": () => import("@/app/games/line-rider"),
  "tower-defense": () => import("@/app/games/tower-defense"),
  pong: () => import("@/app/games/pong"),
  breakout: () => import("@/app/games/breakout"),
  "2048": () => import("@/app/games/game-2048"),
  minesweeper: () => import("@/app/games/minesweeper"),
  tetris: () => import("@/app/games/tetris"),
  asteroids: () => import("@/app/games/asteroids"),
  "dino-runner": () => import("@/app/games/dino-runner"),
  simon: () => import("@/app/games/simon"),
  frogger: () => import("@/app/games/frogger"),
  "connect-four": () => import("@/app/games/connect-four"),
  "lights-out": () => import("@/app/games/lights-out"),
  hangman: () => import("@/app/games/hangman"),
  reversi: () => import("@/app/games/reversi"),
  sokoban: () => import("@/app/games/sokoban"),
  "lunar-lander": () => import("@/app/games/lunar-lander"),
  tron: () => import("@/app/games/tron"),
  "mini-golf": () => import("@/app/games/mini-golf"),
  "sky-hop": () => import("@/app/games/sky-hop"),
  "match-three": () => import("@/app/games/match-three"),
  "bubble-shooter": () => import("@/app/games/bubble-shooter"),
  "slide-puzzle": () => import("@/app/games/slide-puzzle"),
  mastermind: () => import("@/app/games/mastermind"),
  "word-search": () => import("@/app/games/word-search"),
  battleship: () => import("@/app/games/battleship"),
  "stack-tower": () => import("@/app/games/stack-tower"),
  plinko: () => import("@/app/games/plinko"),
  "air-hockey": () => import("@/app/games/air-hockey"),
  "missile-command": () => import("@/app/games/missile-command"),
  centipede: () => import("@/app/games/centipede"),
  pipes: () => import("@/app/games/pipes"),
};
```

**Verified against the real tree.** Three paths intentionally differ from their slug — do not "correct" them:

| Slug | Import path | Why |
|---|---|---|
| `tank-shooter` | `@/app/games/base-command` | game was renamed; slug kept for URLs |
| `2048` | `@/app/games/game-2048` | directory can't start with a digit |
| `memory-match` | `@/app/games/MemoryMatch` | only game not yet moved to a directory |

- [ ] **Step 4: Run the registry test**

Run: `npm test -- gameRegistry`
Expected: PASS, 3 tests. If "has a loader for every registered game" fails, the printed list names the missing slugs.

- [ ] **Step 5: Write GameFrame**

Create `app/play/[slug]/GameFrame.tsx`:

```tsx
"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import GameShell from "@/app/components/GameShell";
import GameLoading from "@/app/components/GameLoading";
import { gameLoaders } from "./gameRegistry";

/**
 * Lazily loads one game and wraps it in the shared shell. The game itself is
 * unchanged — it gets the loading screen, pause, and fullscreen for free.
 */
export default function GameFrame({
  slug,
  title,
  accent,
}: {
  slug: string;
  title: string;
  accent: string;
}) {
  const Game = useMemo(
    () =>
      dynamic(gameLoaders[slug], {
        loading: () => <GameLoading title={title} accent={accent} />,
        ssr: false,
      }),
    [slug, title, accent],
  );

  return (
    <GameShell meta={{ id: slug, runtime: "canvas" }} accent={accent}>
      <Game />
    </GameShell>
  );
}
```

- [ ] **Step 6: Rewrite the play page**

Replace `app/play/[slug]/page.tsx` lines 1-95 (all 43 imports plus the `gameComponents` map) so the file begins:

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import { getGame, games } from "@/lib/games";
import GameFrame from "./GameFrame";
import { gameLoaders } from "./gameRegistry";

export async function generateStaticParams() {
  return games.map((g) => ({ slug: g.slug }));
}
```

Then in the component body, replace the `GameComponent` lookup:

```tsx
  const { slug } = await params;
  const game = getGame(slug);

  if (!game || !(slug in gameLoaders)) {
    notFound();
  }
```

And replace the render site at the former `<GameComponent />` (inside the canvas container div):

```tsx
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 sm:p-4 crt">
          <GameFrame slug={game.slug} title={game.title} accent={game.accent} />
        </div>
```

Leave the header, description, and "MORE GAMES" sections unchanged.

- [ ] **Step 7: Verify the build and bundle win**

```bash
npm run build
```

Expected: build succeeds; all 43 static params prerender. In the route summary, `/play/[slug]` First Load JS should drop substantially versus before — record both numbers in the commit message.

- [ ] **Step 8: Verify games still run**

```bash
npm run dev
```

Open `http://localhost:3000/play/asteroids`, `/play/lights-out`, and `/play/pong`. Confirm each shows the loading screen briefly, then the game, with working Pause and Fullscreen buttons.

- [ ] **Step 9: Commit**

```bash
git add app/play lib
git commit -m "perf(play): code-split games and wrap in GameShell

Was: 43 static imports; every visitor downloaded all 43 games to play one.
Now: one lazy chunk per game, with shared loading screen and pause."
```

---

### Task 13: Migrate Asteroids (score-based reference)

**Files:**
- Modify: `app/games/asteroids/index.tsx:33-34` (state), `:53` (load), `:218-219` (report)
- Test: `app/games/__tests__/asteroids.migration.test.tsx`

**Interfaces:**
- Consumes: `useCartridge` (Task 9)
- Produces: reference pattern for the ~29 other score-based canvas games.

**Shape:** classic score. Legacy key `asteroids-highscore` — already mapped in `legacyKeys.ts`.

- [ ] **Step 1: Write the failing test**

Create `app/games/__tests__/asteroids.migration.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import Asteroids from "@/app/games/asteroids";

describe("Asteroids platform migration", () => {
  beforeEach(() => localStorage.clear());

  it("renders without crashing", () => {
    render(<Asteroids />);
    expect(screen.getByText(/BEST/i)).toBeInTheDocument();
  });

  it("shows the legacy high score through the platform", async () => {
    localStorage.setItem("asteroids-highscore", "4200");
    render(<Asteroids />);
    expect(await screen.findByText("4200")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- asteroids`
Expected: FAIL on the legacy score test — the game reads `localStorage` directly on mount and renders `0` before the platform value resolves.

- [ ] **Step 3: Wire in the hook**

In `app/games/asteroids/index.tsx`, add the import:

```tsx
import { useCartridge } from "@/lib/platform/useCartridge";
```

Replace both state declarations at lines 33-34 with the score state plus the hook — this removes the `highScore` `useState` entirely:

```tsx
  const [score, setScore] = useState(0);
  const { host, highScore } = useCartridge("asteroids");
```

Then delete the direct load at line 53 (`const saved = localStorage.getItem("asteroids-highscore"); ...` and the `setHighScore` call it feeds). `useCartridge` supplies `highScore` now, including the legacy value.

Replace the game-over report at lines 218-219:

```tsx
    setScore(st.score);
    host.reportScore(st.score);
```

Leave every render site that reads `highScore` unchanged — the variable now comes from the hook.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- asteroids`
Expected: PASS, 2 tests.

- [ ] **Step 5: Verify no regression in the browser**

```bash
npm run dev
```

Open `/play/asteroids`, play until game over, confirm BEST updates and persists across reload.

- [ ] **Step 6: Commit**

```bash
git add app/games/asteroids app/games/__tests__/asteroids.migration.test.tsx
git commit -m "feat(asteroids): migrate to platform SDK (score reference)"
```

---

### Task 14: Migrate Lights Out (progression reference)

**Files:**
- Modify: `app/games/lights-out/index.tsx:37` (state), `:39-44` (load), `:58-64` (report)
- Test: `app/games/__tests__/lightsOut.migration.test.tsx`

**Interfaces:**
- Consumes: `useCartridge` (Task 9)
- Produces: reference pattern for progression games that track a level, not a score.

**Shape:** progression. Legacy key `lightsout-best` stores a **level**, not a score. Reports `reportEvent("level_cleared")` for tokens and `reportScore(level)` so the level persists as the high-water mark.

- [ ] **Step 1: Write the failing test**

Create `app/games/__tests__/lightsOut.migration.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import LightsOut from "@/app/games/lights-out";

describe("LightsOut platform migration", () => {
  beforeEach(() => localStorage.clear());

  it("renders without crashing", () => {
    render(<LightsOut />);
    expect(screen.getByText(/BEST/i)).toBeInTheDocument();
  });

  it("shows the legacy best level through the platform", async () => {
    localStorage.setItem("lightsout-best", "7");
    render(<LightsOut />);
    expect(await screen.findByText("7")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lightsOut`
Expected: FAIL on the legacy level test.

- [ ] **Step 3: Wire in the hook**

In `app/games/lights-out/index.tsx`, add the import:

```tsx
import { useCartridge } from "@/lib/platform/useCartridge";
```

Replace the `bestLevel` state at line 37:

```tsx
  const { host, highScore: bestLevel } = useCartridge("lights-out");
```

Replace the mount effect at lines 39-44, dropping the direct `localStorage` read:

```tsx
  useEffect(() => {
    newPuzzle(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

Replace the solve branch at lines 58-64:

```tsx
    if (next.every((row) => row.every((v) => !v))) {
      setSolved(true);
      host.reportEvent("level_cleared");
      // Persist the next level as the high-water mark, matching the old
      // "lightsout-best" semantics (best = highest level reached).
      host.reportScore(level + 1);
    }
```

Delete the now-unused `setBestLevel`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lightsOut`
Expected: PASS, 2 tests.

- [ ] **Step 5: Verify in the browser**

```bash
npm run dev
```

Open `/play/lights-out`, solve a level, confirm BEST advances and survives reload.

- [ ] **Step 6: Commit**

```bash
git add app/games/lights-out app/games/__tests__/lightsOut.migration.test.tsx
git commit -m "feat(lights-out): migrate to platform SDK (progression reference)"
```

---

### Task 15: Migrate Pong (match-outcome reference)

**Files:**
- Modify: `app/games/pong/index.tsx:126-128` (match end)
- Test: `app/games/__tests__/pong.migration.test.tsx`

**Interfaces:**
- Consumes: `useCartridge` (Task 9)
- Produces: reference pattern for games with no score to persist — only a match result.

**Shape:** match outcome. Pong has **no localStorage today** and no legacy key, so nothing to preserve. It earns via `reportEvent("match_won")` only.

- [ ] **Step 1: Write the failing test**

Create `app/games/__tests__/pong.migration.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import Pong from "@/app/games/pong";

describe("Pong platform migration", () => {
  beforeEach(() => localStorage.clear());

  it("renders without crashing", () => {
    render(<Pong />);
    // Button reads "START" before play, "PLAY AGAIN" after a game over.
    expect(screen.getByRole("button", { name: "START" })).toBeInTheDocument();
  });

  it("does not write legacy localStorage keys", () => {
    render(<Pong />);
    const stray = Object.keys(localStorage).filter(
      (k) => k.startsWith("pong-") && !k.startsWith("bg:"),
    );
    expect(stray).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- pong`
Expected: PASS. Pong writes no localStorage today, so both assertions already hold — this test is a regression guard proving the migration in Step 3 introduces no stray keys.

- [ ] **Step 3: Wire in the hook**

In `app/games/pong/index.tsx`, add the import:

```tsx
import { useCartridge } from "@/lib/platform/useCartridge";
```

Add the hook inside the component, alongside the existing state:

```tsx
  const { host } = useCartridge("pong");
```

Replace the match-end branch at lines 126-128:

```tsx
    if (st.pScore >= WIN_SCORE || st.aScore >= WIN_SCORE) {
      const playerWon = st.pScore > st.aScore;
      setWon(playerWon);
      if (playerWon) host.reportEvent("match_won");
```

Leave the surrounding lines of `checkEnd` unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- pong`
Expected: PASS, 2 tests.

- [ ] **Step 5: Verify in the browser**

```bash
npm run dev
```

Open `/play/pong`, win a match, confirm no console errors.

- [ ] **Step 6: Commit**

```bash
git add app/games/pong app/games/__tests__/pong.migration.test.tsx
git commit -m "feat(pong): migrate to platform SDK (match-outcome reference)"
```

---

### Task 16: B-Token balance display

**Files:**
- Create: `app/components/TokenBalance.tsx`
- Modify: `app/components/Header.tsx` (add `<TokenBalance />` to the header bar)
- Test: `app/components/__tests__/TokenBalance.test.tsx`

**Interfaces:**
- Consumes: `getStorage` (Task 4); `Economy` (Task 6); `getPlayerId` (Task 7)
- Produces: `function TokenBalance(): JSX.Element`

**Why:** without this, B-Tokens are invisible and Phase 1 cannot be demonstrated. The shop that spends them lands in Phase 3.

- [ ] **Step 1: Write the failing test**

Create `app/components/__tests__/TokenBalance.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import TokenBalance from "@/app/components/TokenBalance";
import { Economy } from "@/lib/platform/economy";
import { LocalStorageAdapter } from "@/lib/platform/storage/localStorage";
import { getPlayerId } from "@/lib/platform/player";

describe("TokenBalance", () => {
  beforeEach(() => localStorage.clear());

  it("shows zero for a new player", async () => {
    render(<TokenBalance />);
    expect(await screen.findByText("0")).toBeInTheDocument();
  });

  it("labels the currency as B-Tokens", async () => {
    render(<TokenBalance />);
    expect(await screen.findByLabelText(/b-tokens/i)).toBeInTheDocument();
  });

  it("shows an existing balance", async () => {
    const economy = new Economy(new LocalStorageAdapter(), getPlayerId());
    await economy.applyScore("pong", 100 * 25); // +25
    render(<TokenBalance />);
    expect(await screen.findByText("25")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- TokenBalance`
Expected: FAIL — cannot resolve `@/app/components/TokenBalance`.

- [ ] **Step 3: Write the implementation**

Create `app/components/TokenBalance.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { getStorage } from "@/lib/platform/storage";
import { Economy } from "@/lib/platform/economy";
import { getPlayerId } from "@/lib/platform/player";

/** Header readout of the player's B-Token balance. */
export default function TokenBalance() {
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    let active = true;
    const economy = new Economy(getStorage(), getPlayerId());
    void economy.getBalance().then((b) => {
      if (active) setBalance(b);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <span
      aria-label={`${balance} B-Tokens`}
      className="flex items-center gap-1 font-[family-name:var(--font-mono)] text-base text-[var(--accent)]"
    >
      <span aria-hidden="true">🪙</span>
      <span>{balance}</span>
    </span>
  );
}
```

- [ ] **Step 4: Add it to the header**

In `app/components/Header.tsx`, add the import below the existing ones:

```tsx
import TokenBalance from "./TokenBalance";
```

Then wrap the existing `<nav>` so the balance sits beside it. Replace the `<nav>...</nav>` block with:

```tsx
        <div className="flex items-center gap-4">
          <nav className="flex flex-wrap gap-1 font-[family-name:var(--font-mono)] text-lg">
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/?cat=${c.id}`}
                className="px-3 py-1 rounded hover:bg-[var(--surface-2)] hover:text-[var(--accent-hot)] transition-colors"
              >
                {c.label}
              </Link>
            ))}
          </nav>
          <TokenBalance />
        </div>
```

Note: `Header.tsx` is currently a server component. `TokenBalance` is marked `"use client"`, so it may be imported here without changing `Header` itself.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- TokenBalance`
Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add app/components/TokenBalance.tsx app/components/Header.tsx app/components/__tests__/TokenBalance.test.tsx
git commit -m "feat(platform): show B-Token balance in header"
```

---

### Task 17: Shared audio bus and master mute

**Files:**
- Create: `lib/platform/audio.ts`
- Modify: `app/components/GameShell.tsx` (add a mute button beside Pause)
- Test: `lib/platform/__tests__/audio.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `function isMuted(): boolean`
  - `function setMuted(muted: boolean): void`
  - `function subscribeMute(cb: (muted: boolean) => void): () => void` — returns an unsubscribe function
  - `function useMuted(): [boolean, (m: boolean) => void]`

**Scope note:** Phase 1 ships the bus, its persistence, and the GameShell control. The 9 games that own audio (4 with `sound.ts`, 5 with inline `AudioContext`) adopt `subscribeMute` as they migrate — same incremental story as `reportScore`. No game audio is rewired in this task.

- [ ] **Step 1: Write the failing test**

Create `lib/platform/__tests__/audio.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { isMuted, setMuted, subscribeMute } from "@/lib/platform/audio";

describe("audio mute bus", () => {
  beforeEach(() => {
    localStorage.clear();
    setMuted(false);
  });

  it("defaults to unmuted", () => {
    expect(isMuted()).toBe(false);
  });

  it("reflects a mute change", () => {
    setMuted(true);
    expect(isMuted()).toBe(true);
  });

  it("persists mute across a reload", () => {
    setMuted(true);
    expect(localStorage.getItem("bg:muted")).toBe("1");
  });

  it("notifies subscribers", () => {
    const seen: boolean[] = [];
    subscribeMute((m) => seen.push(m));
    setMuted(true);
    setMuted(false);
    expect(seen).toEqual([true, false]);
  });

  it("stops notifying after unsubscribe", () => {
    const cb = vi.fn();
    const off = subscribeMute(cb);
    off();
    setMuted(true);
    expect(cb).not.toHaveBeenCalled();
  });

  it("does not notify when the value is unchanged", () => {
    const cb = vi.fn();
    subscribeMute(cb);
    setMuted(false);
    expect(cb).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- audio`
Expected: FAIL — cannot resolve `@/lib/platform/audio`.

- [ ] **Step 3: Write the implementation**

Create `lib/platform/audio.ts`:

```ts
"use client";

import { useEffect, useState } from "react";

const KEY = "bg:muted";

let muted = typeof window !== "undefined" && localStorage.getItem(KEY) === "1";
const subscribers = new Set<(m: boolean) => void>();

export function isMuted(): boolean {
  return muted;
}

export function setMuted(next: boolean): void {
  if (next === muted) return; // don't wake subscribers for a no-op
  muted = next;
  if (typeof window !== "undefined") {
    localStorage.setItem(KEY, next ? "1" : "0");
  }
  for (const cb of subscribers) cb(next);
}

/** Returns an unsubscribe function. */
export function subscribeMute(cb: (muted: boolean) => void): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

export function useMuted(): [boolean, (m: boolean) => void] {
  const [value, setValue] = useState(muted);
  useEffect(() => subscribeMute(setValue), []);
  return [value, setMuted];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- audio`
Expected: PASS, 6 tests.

- [ ] **Step 5: Add the mute control to GameShell**

In `app/components/GameShell.tsx`, add the import:

```tsx
import { useMuted } from "@/lib/platform/audio";
```

Add the hook inside the component, below the `paused` state:

```tsx
  const [muted, setMutedValue] = useMuted();
```

Insert this button immediately before the existing Fullscreen button:

```tsx
        <button
          onClick={() => setMutedValue(!muted)}
          aria-label={muted ? "Unmute audio" : "Mute audio"}
          className="pixel-edge px-3 py-1 rounded bg-[var(--surface-2)] font-[family-name:var(--font-mono)] text-base"
        >
          {muted ? "🔇 Muted" : "🔊 Sound"}
        </button>
```

- [ ] **Step 6: Add a GameShell test for the control**

Append to `app/components/__tests__/GameShell.test.tsx`:

```tsx
  it("toggles the mute control", async () => {
    const user = userEvent.setup();
    render(
      <GameShell meta={meta} accent="#ff6b1a">
        <div />
      </GameShell>,
    );
    await user.click(screen.getByRole("button", { name: /mute audio/i }));
    expect(screen.getByRole("button", { name: /unmute audio/i })).toBeInTheDocument();
  });
```

- [ ] **Step 7: Run both suites**

Run: `npm test -- audio GameShell`
Expected: PASS, 13 tests.

- [ ] **Step 8: Commit**

```bash
git add lib/platform/audio.ts lib/platform/__tests__/audio.test.ts app/components/GameShell.tsx app/components/__tests__/GameShell.test.tsx
git commit -m "feat(platform): add shared audio bus with master mute in GameShell"
```

---

### Task 18: Full verification

**Files:**
- Create: `app/play/[slug]/__tests__/allGamesMount.test.tsx`

**Interfaces:**
- Consumes: `gameLoaders` (Task 12); `games` from `@/lib/games`
- Produces: regression guard that every game's chunk resolves.

- [ ] **Step 1: Write the smoke test**

Create `app/play/[slug]/__tests__/allGamesMount.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { gameLoaders } from "@/app/play/[slug]/gameRegistry";
import { games } from "@/lib/games";

describe("every game chunk resolves", () => {
  for (const game of games) {
    it(`loads ${game.slug}`, async () => {
      const mod = await gameLoaders[game.slug]();
      expect(typeof mod.default).toBe("function");
    });
  }
});
```

- [ ] **Step 2: Run the full suite**

Run: `npm test`
Expected: PASS. 43 chunk tests plus all earlier suites.

- [ ] **Step 3: Lint and typecheck**

```bash
npm run lint
npx tsc --noEmit
```

Expected: no errors. Fix any unused-import warnings left behind by Tasks 13-15 and 17.

- [ ] **Step 4: Production build**

```bash
npm run build
```

Expected: succeeds, 43 pages prerendered.

- [ ] **Step 5: Manual pass**

```bash
npm run dev
```

Check: homepage lists all games; header shows the B-Token balance; `/play/asteroids`, `/play/lights-out`, `/play/pong` each load, earn tokens, and persist high scores across reload; at least three unmigrated games (`/play/tetris`, `/play/snake`, `/play/frogger`) still work with Pause and Fullscreen.

- [ ] **Step 6: Commit**

```bash
git add app/play/[slug]/__tests__/allGamesMount.test.tsx
git commit -m "test: verify every game chunk resolves"
```

---

## Phase 1 Acceptance Criteria

From the spec §10 — verify each before declaring Phase 1 complete:

- [ ] All 43 games render inside `GameShell` with loading screen, pause, fullscreen (Tasks 10-12)
- [ ] `app/play/[slug]/page.tsx` lazy-loads a single game; bundle measured before/after (Task 12 Step 7)
- [ ] `CartridgeHost` exposes no token-minting surface; enforced by test (Tasks 2, 9)
- [ ] Ledger is append-only; balance derives from entries (Task 6)
- [ ] Per-game and global daily caps enforced, with unit tests (Task 6)
- [ ] At least 3 games migrated to `reportScore` as reference implementations (Tasks 13-15)
- [ ] Setting `MONGODB_URI` selects `MongoAdapter` (Task 4)
- [ ] Unmigrated games continue working untouched (Task 18 Step 5)
- [ ] Shared audio bus with master mute (Task 17) — spec §4.6

## Deliberate deviations from the spec

Two items in spec §4.6 are **not** built in Phase 1:

- **`GodotCartridge.tsx`** — the spec listed it as a Phase 1 stub, written when Godot was Phase 2. Godot is now Phase 4, so a `postMessage` bridge with no consumer for three phases is dead code. It moves to Phase 4, where the first real Godot cartridge will define what the bridge actually needs. Same reasoning that removed `wallet.ts` from Phase 1.
- **`wallet.ts`** — already deferred to Phase 4 in the spec itself (§4.4).

The spec also says "42 games" throughout; the registry actually holds **43**. Corrected here. Worth fixing in the spec on its next edit.

## Notes for Phase 2

- `getPlayerId()` returns `anon-*`. Sign-up must map the anonymous ledger onto the account id, or players lose Phase 1 balances.
- `MongoAdapter` currently throws. Implement against the shared contract suite in `lib/platform/storage/__tests__/adapterContract.ts` — it already defines correct behaviour.
- Earn enforcement moves server-side in Phase 2. `Economy` is the only place that grants tokens, so this is a matter of moving that class behind an API route.
