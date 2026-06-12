import type { EnemyType } from "./types";
import { BOSS_EVERY } from "./constants";

const HAND_WAVES: EnemyType[][] = [
  ["basic", "basic", "basic"],
  ["basic", "basic", "basic", "scout", "scout"],
  ["basic", "basic", "scout", "scout", "swarm", "swarm", "swarm"],
  ["basic", "basic", "basic", "scout", "heavy"],
  ["basic", "basic", "scout", "scout", "heavy", "boss"], // wave 5 boss
  ["basic", "basic", "basic", "scout", "scout", "stealth"],
  ["basic", "scout", "scout", "heavy", "swarm", "swarm", "swarm", "swarm"],
  ["basic", "basic", "stealth", "stealth", "heavy", "healer"],
  ["basic", "basic", "scout", "scout", "heavy", "heavy", "bomber"],
  ["basic", "basic", "scout", "scout", "heavy", "healer", "stealth", "bomber", "boss"],
];

export function getWave(n: number): EnemyType[] {
  if (n < HAND_WAVES.length) return [...HAND_WAVES[n]];

  const total = 10 + (n - HAND_WAVES.length) * 2;
  const out: EnemyType[] = [];
  const isBoss = (n + 1) % BOSS_EVERY === 0;

  for (let i = 0; i < total; i++) {
    const r = Math.random();
    if (r < 0.08) out.push("healer");
    else if (r < 0.16) out.push("stealth");
    else if (r < 0.24) out.push("bomber");
    else if (r < 0.38) out.push("heavy");
    else if (r < 0.52) out.push("scout");
    else if (r < 0.68) out.push("swarm");
    else out.push("basic");
  }
  if (isBoss) out.push("boss");
  // Extra swarm on even waves
  if (n % 2 === 0) for (let i = 0; i < 4; i++) out.push("swarm");
  return out;
}

export function getWavePreview(n: number): Record<EnemyType, number> {
  const wave = getWave(n);
  const counts: Record<string, number> = {};
  for (const e of wave) counts[e] = (counts[e] || 0) + 1;
  return counts as Record<EnemyType, number>;
}
