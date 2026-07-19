import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import {
  GAME_RATES,
  GAME_EVENT_REWARDS,
  EVENT_REWARDS,
  rateFor,
  rewardForEvent,
  DEFAULT_RATE,
  GLOBAL_DAILY_CAP,
} from "../earnRates";
import { games } from "@/lib/games";

const ROOT = path.resolve(__dirname, "..", "..", "..");
const REGISTRY = path.join(ROOT, "app", "play", "[slug]", "gameRegistry.ts");

/**
 * Slug → source file, read from the registry rather than the directory
 * listing. Two folders do not match their slug ("base-command" is
 * tank-shooter, "game-2048" is 2048), so walking app/games/ and treating the
 * folder name as the slug silently skips exactly the games most likely to be
 * mis-wired.
 */
function gameSources(): Map<string, string> {
  const src = readFileSync(REGISTRY, "utf8");
  const out = new Map<string, string>();
  for (const m of src.matchAll(
    /"?([a-z0-9-]+)"?:\s*\(\)\s*=>\s*import\("@\/app\/games\/([a-z0-9-]+)/g,
  )) {
    const file = path.join(ROOT, "app", "games", m[2], "index.tsx");
    if (existsSync(file)) out.set(m[1], file);
  }
  return out;
}

const SOURCES = gameSources();

function reads(slug: string, re: RegExp): boolean {
  const file = SOURCES.get(slug);
  return file ? re.test(readFileSync(file, "utf8")) : false;
}

const scoreReporting = [...SOURCES.keys()].filter((s) => reads(s, /reportScore\(/));
const eventReporting = [...SOURCES.keys()].filter((s) => reads(s, /reportEvent\(/));

describe("earn rate catalogue", () => {
  it("resolves every game in the registry to a source file", () => {
    expect(SOURCES.size).toBe(games.length);
  });

  it("has no rate keyed to a slug that does not exist", () => {
    // A typo here fails silently — the game just quietly earns the default
    // rate forever, which is exactly the kind of bug nobody notices.
    const real = new Set(games.map((g) => g.slug));
    expect(Object.keys(GAME_RATES).filter((s) => !real.has(s))).toEqual([]);
    expect(Object.keys(GAME_EVENT_REWARDS).filter((s) => !real.has(s))).toEqual([]);
  });

  it("gives every score-reporting game an explicit tuned rate", () => {
    // Unwired games may use the default — they earn nothing regardless. But
    // once a game reports a score, an untuned rate makes its payout an
    // accident rather than a decision.
    expect(scoreReporting.filter((s) => !(s in GAME_RATES))).toEqual([]);
  });

  it("only pays events that actually exist", () => {
    const known = new Set(Object.keys(EVENT_REWARDS));
    for (const [slug, events] of Object.entries(GAME_EVENT_REWARDS)) {
      for (const name of Object.keys(events)) {
        expect(known, `${slug} overrides unknown event "${name}"`).toContain(name);
      }
    }
  });

  it("only overrides events for games that actually report events", () => {
    const stale = Object.keys(GAME_EVENT_REWARDS).filter(
      (s) => !eventReporting.includes(s),
    );
    expect(stale).toEqual([]);
  });

  it("keeps every configured rate non-negative and capped sanely", () => {
    for (const slug of Object.keys(GAME_RATES)) {
      const resolved = rateFor(slug);
      // Zero is meaningful and deliberate: an event-paid game reports a score
      // for its leaderboard but must not also be paid for it.
      expect(resolved.tokensPerPoint, slug).toBeGreaterThanOrEqual(0);
      expect(resolved.dailyCap, slug).toBeGreaterThan(0);
      expect(resolved.dailyCap, slug).toBeLessThanOrEqual(GLOBAL_DAILY_CAP);
    }
    expect(DEFAULT_RATE.dailyCap).toBeLessThanOrEqual(GLOBAL_DAILY_CAP);
  });

  it("pays a comparable amount for a representative run across every tuned game", () => {
    // The real guard on normalisation. Score scales span three orders of
    // magnitude, so retuning one game in isolation is easy to get wrong; this
    // catches the catalogue drifting out of balance.
    const runs: Record<string, number> = {
      "tank-shooter": 8,
      simon: 15,
      "stack-tower": 52,
      plinko: 300,
      snake: 500,
      "bubble-shooter": 1150,
      "tower-defense": 1250,
      "whack-a-mole": 1350,
      "match-three": 1500,
      "sky-hop": 1500,
      "zombie-shooter": 2000,
      "dino-runner": 2150,
      breakout: 2750,
      centipede: 2750,
      helicopter: 3000,
      "apple-shooter": 3250,
      pacman: 4000,
      "missile-command": 4000,
      "dam-rush": 4000,
      galaga: 4250,
      "space-invaders": 4500,
      frogger: 5000,
      tetris: 5000,
      "2048": 6000,
      "lunar-lander": 6800,
    };

    for (const [slug, points] of Object.entries(runs)) {
      const tokens = points * rateFor(slug).tokensPerPoint;
      expect(tokens, `${slug} pays ${tokens.toFixed(1)} for a typical run`)
        .toBeGreaterThanOrEqual(15);
      expect(tokens, `${slug} pays ${tokens.toFixed(1)} for a typical run`)
        .toBeLessThanOrEqual(60);
    }
  });

  it("pays event-based games a comparable amount for a typical run", () => {
    // clears/wins achievable in roughly three minutes
    const runs: Array<[string, string, number]> = [
      ["sokoban", "level_cleared", 1.5],
      ["pipes", "level_cleared", 6],
      ["mini-golf", "level_cleared", 5],
      ["minesweeper", "puzzle_solved", 1.5],
      ["mastermind", "puzzle_solved", 1.5],
      ["memory-match", "puzzle_solved", 2],
      ["slide-puzzle", "puzzle_solved", 2],
      ["word-search", "puzzle_solved", 1],
      ["reversi", "match_won", 1],
      ["battleship", "match_won", 1],
      ["air-hockey", "match_won", 1],
      ["connect-four", "match_won", 1],
      ["tron", "match_won", 1.5],
      ["hangman", "match_won", 2.5],
      ["pong", "match_won", 2],
      ["lights-out", "level_cleared", 5],
    ];

    for (const [slug, event, count] of runs) {
      const tokens = rewardForEvent(event, slug) * count;
      expect(tokens, `${slug} pays ${tokens} for a typical run`)
        .toBeGreaterThanOrEqual(10);
      expect(tokens, `${slug} pays ${tokens} for a typical run`)
        .toBeLessThanOrEqual(60);
    }
  });

  it("still returns nothing for an unknown event, per-game or not", () => {
    expect(rewardForEvent("made_up_event")).toBe(0);
    expect(rewardForEvent("made_up_event", "sokoban")).toBe(0);
  });
});
