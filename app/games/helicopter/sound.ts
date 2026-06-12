// Helicopter game sound system — Web Audio API, zero dependencies.
// All sounds are synthesised from oscillators + noise so no audio files are needed.

let ctx: AudioContext | null = null;
let muted = false;
let rotorOsc: OscillatorNode | null = null;
let rotorLfo: OscillatorNode | null = null;
let rotorGain: GainNode | null = null;

// ===== Init (call on first user gesture) =====
export function initAudio() {
  if (ctx) return;
  try {
    ctx = new AudioContext();
  } catch {
    // Web Audio not supported — degrade silently.
  }
}

export function setMuted(m: boolean) {
  muted = m;
  if (rotorGain) rotorGain.gain.value = m ? 0 : 0.012;
  setMusicMuted(m);
}

export function isMuted() { return muted; }

// ===== Helpers =====
function tone(
  freq: number,
  dur: number,
  vol = 0.08,
  type: OscillatorType = "square",
  delay = 0
) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur);
}

// ===== Sound effects =====

export function playGemCollect() {
  tone(880, 0.09, 0.06, "square");
  tone(1100, 0.09, 0.05, "square", 0.05);
}

export function playGoldGem() {
  tone(880, 0.07, 0.06, "square");
  tone(1100, 0.07, 0.05, "square", 0.06);
  tone(1320, 0.10, 0.05, "square", 0.12);
  tone(1760, 0.14, 0.04, "square", 0.18);
}

export function playPowerUp() {
  tone(330, 0.12, 0.05, "triangle");
  tone(440, 0.12, 0.05, "triangle", 0.08);
  tone(660, 0.12, 0.05, "triangle", 0.16);
  tone(880, 0.18, 0.04, "triangle", 0.24);
}

export function playCrash() {
  if (!ctx || muted) return;
  const dur = 0.35;
  const bufSize = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 1.8);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const gain = ctx.createGain();
  gain.gain.value = 0.18;
  src.connect(gain).connect(ctx.destination);
  src.start();
  // Low boom underneath
  tone(80, 0.3, 0.12, "sine");
}

export function playNearMiss() {
  tone(600, 0.06, 0.04, "sawtooth");
  tone(1000, 0.05, 0.03, "sawtooth", 0.03);
}

export function playBiomeTransition() {
  tone(330, 0.15, 0.04, "triangle");
  tone(440, 0.15, 0.04, "triangle", 0.08);
  tone(550, 0.15, 0.04, "triangle", 0.16);
  tone(660, 0.20, 0.04, "triangle", 0.24);
  tone(880, 0.25, 0.03, "triangle", 0.32);
}

export function playComboUp() {
  tone(1200, 0.06, 0.04, "square");
  tone(1600, 0.08, 0.04, "square", 0.05);
}

export function playLifeLost() {
  tone(300, 0.15, 0.10, "square");
  tone(200, 0.20, 0.08, "square", 0.12);
  tone(120, 0.30, 0.06, "square", 0.24);
}

export function playGreenGem() {
  tone(660, 0.08, 0.06, "square");
  tone(880, 0.10, 0.05, "square", 0.06);
}

export function playRedGem() {
  tone(740, 0.07, 0.07, "square");
  tone(990, 0.08, 0.06, "square", 0.05);
  tone(1200, 0.10, 0.05, "square", 0.10);
}

export function playSawBuzz() {
  if (!ctx || muted) return;
  const dur = 0.12;
  const bufSize = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    // Harsh grinding: mix noise + sawtooth
    const saw = ((i * 200 / ctx.sampleRate) % 1) * 2 - 1;
    const noise = Math.random() * 2 - 1;
    data[i] = (saw * 0.5 + noise * 0.5) * Math.pow(1 - i / bufSize, 0.8);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const gain = ctx.createGain();
  gain.gain.value = 0.04;
  src.connect(gain).connect(ctx.destination);
  src.start();
}

// ===== Rotor (continuous loop) =====

export function startRotor() {
  if (!ctx || rotorOsc) return;
  rotorOsc = ctx.createOscillator();
  rotorGain = ctx.createGain();
  rotorOsc.type = "sine";
  rotorOsc.frequency.value = 55;
  rotorGain.gain.value = muted ? 0 : 0.012;
  // LFO modulates frequency for subtle chop-chop feel
  rotorLfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  rotorLfo.frequency.value = 12;
  lfoGain.gain.value = 6;
  rotorLfo.connect(lfoGain).connect(rotorOsc.frequency);
  rotorLfo.start();
  rotorOsc.connect(rotorGain).connect(ctx.destination);
  rotorOsc.start();
}

export function stopRotor() {
  try {
    rotorOsc?.stop();
    rotorLfo?.stop();
  } catch {
    // already stopped
  }
  rotorOsc = null;
  rotorLfo = null;
  rotorGain = null;
}

// ===== Background music (HTMLAudio, fades on biome transitions) =====
// One track per biome.

const MUSIC_TRACKS: Record<number, string> = {
  0: "/music/cave.mp3",
  1: "/music/dawn.mp3",
  2: "/music/deep-ocean.mp3",
  3: "/music/storm.mp3",
  4: "/music/volcano.mp3",
  5: "/music/neon-city.mp3",
  6: "/music/deep-space.mp3",
};

const MUSIC_TARGET_VOL = 0.32;
const FADE_DURATION_MS = 1100;

type Track = { el: HTMLAudioElement; url: string };

let activeTrack: Track | null = null;
let fadingOut: Track[] = [];
let fadeRaf: number | null = null;
let lastFadeTime = 0;
let musicMuted = false;
let pendingAutoplayRetry: (() => void) | null = null;

function approach(current: number, goal: number, step: number) {
  if (current < goal) return Math.min(goal, current + step);
  return Math.max(goal, current - step);
}

// If a play() call gets rejected by the browser's autoplay policy, register
// a one-shot global gesture listener that will resume playback on the very
// next click/keydown anywhere on the page.
function armAutoplayRetry(retry: () => void) {
  pendingAutoplayRetry = retry;
  if (typeof window === "undefined") return;
  const handler = () => {
    const fn = pendingAutoplayRetry;
    pendingAutoplayRetry = null;
    window.removeEventListener("pointerdown", handler);
    window.removeEventListener("keydown", handler);
    if (fn) fn();
  };
  window.addEventListener("pointerdown", handler, { once: true });
  window.addEventListener("keydown", handler, { once: true });
}

function tryPlay(t: Track) {
  const p = t.el.play();
  if (p && typeof p.catch === "function") {
    p.catch((err: unknown) => {
      // Autoplay rejection — retry on the next user gesture.
      if (err && (err as { name?: string }).name === "NotAllowedError") {
        armAutoplayRetry(() => { if (activeTrack === t) tryPlay(t); });
        return;
      }
      // Any other error (decode failure, 404, etc) — surface to console once.
      // eslint-disable-next-line no-console
      console.warn(`[helicopter music] failed to play ${t.url}:`, err);
    });
  }
}

function ensureFadeLoop() {
  if (fadeRaf !== null) return;
  lastFadeTime = performance.now();
  const tick = (now: number) => {
    const dt = now - lastFadeTime;
    lastFadeTime = now;
    const step = dt / FADE_DURATION_MS;

    if (activeTrack) {
      const goal = musicMuted ? 0 : MUSIC_TARGET_VOL;
      if (Math.abs(activeTrack.el.volume - goal) > 0.001) {
        activeTrack.el.volume = approach(activeTrack.el.volume, goal, step);
      }
    }

    if (fadingOut.length > 0) {
      fadingOut = fadingOut.filter(t => {
        t.el.volume = approach(t.el.volume, 0, step);
        if (t.el.volume <= 0.001) {
          try { t.el.pause(); } catch { /* ignore */ }
          // Detach event handlers + release the file by removing the source
          // element. Avoid setting src to "" — that triggers a request for
          // the current page URL.
          t.el.removeAttribute("src");
          try { t.el.load(); } catch { /* ignore */ }
          return false;
        }
        return true;
      });
    }

    const activeAtGoal = !activeTrack ||
      Math.abs(activeTrack.el.volume - (musicMuted ? 0 : MUSIC_TARGET_VOL)) <= 0.001;
    if (activeAtGoal && fadingOut.length === 0) {
      fadeRaf = null;
      return;
    }
    fadeRaf = requestAnimationFrame(tick);
  };
  fadeRaf = requestAnimationFrame(tick);
}

// Switch background music to the track configured for the given biome index.
// Pass -1 (or any unmapped index) to fade out and leave silent.
export function setMusicForBiome(biomeIdx: number) {
  const url = MUSIC_TRACKS[biomeIdx] ?? null;

  // Already on this track — nothing to do.
  if (activeTrack && activeTrack.url === url) return;
  if (!activeTrack && url === null) return;

  // Demote current active to fading-out.
  if (activeTrack) {
    fadingOut.push(activeTrack);
    activeTrack = null;
  }

  if (url) {
    try {
      const el = new Audio(url);
      el.loop = true;
      el.volume = 0;
      el.preload = "auto";
      // Surface load errors (404 / decode failure) to the console exactly once.
      el.addEventListener("error", () => {
        // eslint-disable-next-line no-console
        console.warn(`[helicopter music] could not load ${url} — check that the file exists in /public${url}`);
      }, { once: true });
      const t: Track = { el, url };
      activeTrack = t;
      tryPlay(t);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[helicopter music] could not create audio for ${url}:`, err);
    }
  }

  ensureFadeLoop();
}

export function pauseMusic() {
  if (activeTrack) {
    try { activeTrack.el.pause(); } catch { /* ignore */ }
  }
}

export function resumeMusic() {
  if (activeTrack) tryPlay(activeTrack);
}

export function stopMusic() {
  if (activeTrack) {
    fadingOut.push(activeTrack);
    activeTrack = null;
    ensureFadeLoop();
  }
}

export function setMusicMuted(m: boolean) {
  musicMuted = m;
  ensureFadeLoop();
}
