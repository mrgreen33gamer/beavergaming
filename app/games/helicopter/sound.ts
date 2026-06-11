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
