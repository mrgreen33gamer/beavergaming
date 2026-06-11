// Snake game sound system — Web Audio API, zero dependencies.

let ctx: AudioContext | null = null;
let muted = false;

export function initAudio() {
  if (ctx) return;
  try { ctx = new AudioContext(); } catch { /* unsupported */ }
}

export function setMuted(m: boolean) { muted = m; }
export function isMuted() { return muted; }

function tone(
  freq: number, dur: number, vol = 0.08,
  type: OscillatorType = "square", delay = 0
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

// Eat regular food — short crunch
export function playEat() {
  tone(500, 0.06, 0.07, "square");
  tone(700, 0.06, 0.05, "square", 0.04);
}

// Eat bonus food — sparkly arpeggio
export function playBonusEat() {
  tone(600, 0.06, 0.06, "square");
  tone(800, 0.06, 0.05, "square", 0.05);
  tone(1000, 0.08, 0.05, "square", 0.10);
  tone(1200, 0.10, 0.04, "square", 0.15);
}

// Eat poison — nasty descending buzz
export function playPoison() {
  tone(400, 0.10, 0.08, "sawtooth");
  tone(250, 0.12, 0.07, "sawtooth", 0.08);
  tone(150, 0.15, 0.06, "sawtooth", 0.16);
}

// Death — noise burst
export function playDeath() {
  if (!ctx || muted) return;
  const dur = 0.3;
  const bufSize = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 1.5);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const gain = ctx.createGain();
  gain.gain.value = 0.15;
  src.connect(gain).connect(ctx.destination);
  src.start();
  tone(100, 0.25, 0.10, "sine");
}

// Power-up pickup — ascending chord
export function playPowerUp() {
  tone(440, 0.10, 0.05, "triangle");
  tone(550, 0.10, 0.05, "triangle", 0.07);
  tone(660, 0.10, 0.05, "triangle", 0.14);
  tone(880, 0.15, 0.04, "triangle", 0.21);
}

// Combo level up — quick chirp
export function playComboUp() {
  tone(1000, 0.05, 0.04, "square");
  tone(1400, 0.06, 0.04, "square", 0.04);
}

// Speed boost activate — whoosh
export function playSpeedBoost() {
  tone(300, 0.08, 0.05, "sawtooth");
  tone(600, 0.08, 0.04, "sawtooth", 0.06);
  tone(1000, 0.10, 0.04, "sawtooth", 0.12);
}

// Movement tick — very subtle click (only plays every N ticks)
export function playTick() {
  tone(200, 0.02, 0.015, "sine");
}
