let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function noise(ac: AudioContext, duration: number, volume: number): AudioBufferSourceNode {
  const buf = ac.createBuffer(1, ac.sampleRate * duration, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * volume;
  const src = ac.createBufferSource();
  src.buffer = buf;
  return src;
}

export function playShoot(pitch = 800) {
  try {
    const ac = getCtx(), t = ac.currentTime;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(pitch, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.08);
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(g).connect(ac.destination);
    osc.start(t); osc.stop(t + 0.08);
  } catch { /* no audio */ }
}

export function playExplosion(big = false) {
  try {
    const ac = getCtx(), t = ac.currentTime;
    const dur = big ? 0.5 : 0.2;
    const src = noise(ac, dur, big ? 0.3 : 0.15);
    const g = ac.createGain();
    const filt = ac.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.setValueAtTime(big ? 400 : 600, t);
    filt.frequency.exponentialRampToValueAtTime(100, t + dur);
    g.gain.setValueAtTime(big ? 0.15 : 0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filt).connect(g).connect(ac.destination);
    src.start(t); src.stop(t + dur);
  } catch { /* no audio */ }
}

export function playBuild() {
  try {
    const ac = getCtx(), t = ac.currentTime;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(600, t + 0.1);
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(g).connect(ac.destination);
    osc.start(t); osc.stop(t + 0.15);
  } catch { /* no audio */ }
}

export function playWaveStart() {
  try {
    const ac = getCtx(), t = ac.currentTime;
    [440, 550, 660].forEach((f, i) => {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(f, t + i * 0.08);
      g.gain.setValueAtTime(0.05, t + i * 0.08);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.15);
      osc.connect(g).connect(ac.destination);
      osc.start(t + i * 0.08); osc.stop(t + i * 0.08 + 0.15);
    });
  } catch { /* no audio */ }
}

export function playAbility() {
  try {
    const ac = getCtx(), t = ac.currentTime;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(1200, t + 0.3);
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(g).connect(ac.destination);
    osc.start(t); osc.stop(t + 0.35);
  } catch { /* no audio */ }
}

export function playCombo() {
  try {
    const ac = getCtx(), t = ac.currentTime;
    [600, 800, 1000].forEach((f, i) => {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(f, t + i * 0.06);
      g.gain.setValueAtTime(0.04, t + i * 0.06);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.1);
      osc.connect(g).connect(ac.destination);
      osc.start(t + i * 0.06); osc.stop(t + i * 0.06 + 0.1);
    });
  } catch { /* no audio */ }
}

export function playGameOver() {
  try {
    const ac = getCtx(), t = ac.currentTime;
    [400, 300, 200, 100].forEach((f, i) => {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(f, t + i * 0.2);
      g.gain.setValueAtTime(0.06, t + i * 0.2);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.2 + 0.25);
      osc.connect(g).connect(ac.destination);
      osc.start(t + i * 0.2); osc.stop(t + i * 0.2 + 0.25);
    });
  } catch { /* no audio */ }
}
