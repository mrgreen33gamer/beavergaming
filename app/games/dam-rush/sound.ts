// Dam Rush sound engine — Web Audio API, no dependencies, no audio files.

import { isMuted as platformMuted, subscribeMute } from "@/lib/platform/audio";

let ctx: AudioContext | null = null;
let muted = false;
let waterOsc: OscillatorNode | null = null;
let waterGain: GainNode | null = null;
let waterLfo: OscillatorNode | null = null;

function silenced() {
  return muted || platformMuted();
}

function applyWaterGain() {
  if (waterGain) waterGain.gain.value = silenced() ? 0 : 0.012;
}

if (typeof window !== "undefined") {
  subscribeMute(() => applyWaterGain());
}

export function initAudio() {
  if (ctx) return;
  try { ctx = new AudioContext(); } catch { /* unsupported */ }
}
export function setMuted(m: boolean) {
  muted = m;
  applyWaterGain();
}
export function isMuted() { return silenced(); }

function tone(freq: number, dur: number, vol = 0.07, type: OscillatorType = "square", delay = 0) {
  if (!ctx || silenced()) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur);
}

function sweep(f0: number, f1: number, dur: number, vol = 0.06, type: OscillatorType = "sawtooth") {
  if (!ctx || silenced()) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur);
}

function noise(dur: number, vol = 0.1, decay = 1.5) {
  if (!ctx || silenced()) return;
  const n = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const gain = ctx.createGain();
  gain.gain.value = vol;
  src.connect(gain).connect(ctx.destination);
  src.start();
}

// ===== SFX =====
export function sfxCatchSmall() { tone(620, 0.07, 0.05, "square"); tone(820, 0.06, 0.04, "square", 0.04); }
export function sfxCatchBig() { tone(420, 0.08, 0.06, "square"); tone(560, 0.08, 0.05, "square", 0.05); tone(740, 0.12, 0.05, "square", 0.10); }
export function sfxFish() { tone(900, 0.05, 0.045, "sine"); tone(1300, 0.07, 0.04, "sine", 0.05); tone(1700, 0.09, 0.035, "sine", 0.10); }
export function sfxBad() { noise(0.18, 0.13, 1.2); tone(90, 0.22, 0.10, "sawtooth"); }
export function sfxPowerup() { sweep(330, 1100, 0.35, 0.06, "triangle"); tone(1320, 0.18, 0.04, "triangle", 0.28); }
export function sfxCombo() { tone(1100, 0.05, 0.04, "square"); tone(1500, 0.06, 0.035, "square", 0.04); }
export function sfxSplash() { noise(0.12, 0.06, 2.2); }
export function sfxSurge() {
  // Alarm: two-tone wail
  tone(440, 0.18, 0.07, "square");
  tone(330, 0.18, 0.07, "square", 0.2);
  tone(440, 0.18, 0.07, "square", 0.4);
  tone(330, 0.22, 0.07, "square", 0.6);
}
export function sfxGameOver() {
  sweep(600, 80, 0.7, 0.1, "sawtooth");
  noise(0.5, 0.12, 1.0);
}

// Stage clear — ascending fanfare
export function sfxStageClear() {
  tone(523, 0.13, 0.06, "square");
  tone(659, 0.13, 0.06, "square", 0.11);
  tone(784, 0.13, 0.06, "square", 0.22);
  tone(1047, 0.30, 0.06, "square", 0.33);
}
// Dam breach — heavy collapse
export function sfxBreach() {
  noise(0.4, 0.16, 0.9);
  sweep(320, 70, 0.55, 0.11, "sawtooth");
}
// Lane move — soft tick
export function sfxLaneTick() { tone(280, 0.025, 0.018, "sine"); }
// Stage start — ready chime
export function sfxStageStart() { tone(660, 0.1, 0.05, "triangle"); tone(880, 0.14, 0.045, "triangle", 0.1); }

// ===== Ambient water hum (subtle, continuous) =====
export function startWater() {
  if (!ctx || waterOsc) return;
  waterOsc = ctx.createOscillator();
  waterGain = ctx.createGain();
  waterOsc.type = "sine";
  waterOsc.frequency.value = 60;
  waterGain.gain.value = silenced() ? 0 : 0.012;
  waterLfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  waterLfo.frequency.value = 0.4;
  lfoGain.gain.value = 12;
  waterLfo.connect(lfoGain).connect(waterOsc.frequency);
  waterLfo.start();
  waterOsc.connect(waterGain).connect(ctx.destination);
  waterOsc.start();
}
export function stopWater() {
  try { waterOsc?.stop(); waterLfo?.stop(); } catch { /* */ }
  waterOsc = null; waterLfo = null; waterGain = null;
}
