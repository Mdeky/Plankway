/**
 * Tiny synthesized sound effects (Web Audio), so there are no audio files and no
 * licensing questions. On by default, with a clear mute toggle.
 */
const KEY = 'bridgle.sound.v1';
export const SOUND_EVENT = 'bridgle-sound';

let enabled = readPref();
let ctx: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;

function readPref(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

export function isSoundOn(): boolean {
  return enabled;
}

export function setSoundOn(on: boolean): void {
  enabled = on;
  try {
    if (on) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, 'off');
  } catch {
    // ignore
  }
  if (!on) void ctx?.suspend();
  window.dispatchEvent(new Event(SOUND_EVENT));
}

/** Audio context, created lazily on a user gesture (autoplay rules). */
function audio(): AudioContext | null {
  if (!enabled) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function noise(ac: AudioContext): AudioBuffer {
  if (!noiseBuffer) {
    noiseBuffer = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    // Deterministic noise is fine for sound effects; no Math.random needed.
    let seed = 22222;
    for (let i = 0; i < data.length; i++) {
      seed = (seed * 16807) % 2147483647;
      data[i] = (seed / 2147483647) * 2 - 1;
    }
  }
  return noiseBuffer;
}

function tone(ac: AudioContext, at: number, freq: number, dur: number, type: OscillatorType, gain: number, endFreq = freq) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  osc.frequency.exponentialRampToValueAtTime(endFreq, at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

function hiss(ac: AudioContext, at: number, dur: number, filter: BiquadFilterType, from: number, to: number, gain: number, q = 1) {
  const src = ac.createBufferSource();
  src.buffer = noise(ac);
  const f = ac.createBiquadFilter();
  f.type = filter;
  f.Q.value = q;
  f.frequency.setValueAtTime(from, at);
  f.frequency.exponentialRampToValueAtTime(to, at + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f).connect(g).connect(ac.destination);
  src.start(at, 0, dur + 0.05);
}

export const sfx = {
  /** "klik-klik-klik": planks landing one after another. */
  build(): void {
    const ac = audio();
    if (!ac) return;
    const t = ac.currentTime;
    for (let i = 0; i < 4; i++) {
      hiss(ac, t + i * 0.055, 0.04, 'bandpass', 2400 - i * 150, 1800, 0.35, 4);
      tone(ac, t + i * 0.055, 700 + i * 40, 0.05, 'triangle', 0.08);
    }
  },
  /** Small splash when a bridge is removed. */
  splash(): void {
    const ac = audio();
    if (!ac) return;
    const t = ac.currentTime;
    hiss(ac, t, 0.35, 'lowpass', 2200, 250, 0.3);
    tone(ac, t, 420, 0.18, 'sine', 0.06, 160);
  },
  /** Soft "bonk" when a move isn't possible. */
  blocked(): void {
    const ac = audio();
    if (!ac) return;
    const t = ac.currentTime;
    tone(ac, t, 220, 0.12, 'square', 0.04, 150);
  },
  select(): void {
    const ac = audio();
    if (!ac) return;
    tone(ac, ac.currentTime, 880, 0.06, 'sine', 0.05, 990);
  },
  /** Light two-note chime when an island gets its last bridge. */
  complete(): void {
    const ac = audio();
    if (!ac) return;
    const t = ac.currentTime + 0.2;
    tone(ac, t, 1175, 0.12, 'sine', 0.05);
    tone(ac, t + 0.07, 1568, 0.18, 'sine', 0.045);
  },
  hint(): void {
    const ac = audio();
    if (!ac) return;
    const t = ac.currentTime;
    tone(ac, t, 988, 0.18, 'sine', 0.07);
    tone(ac, t + 0.1, 1319, 0.25, 'sine', 0.06);
  },
  win(): void {
    const ac = audio();
    if (!ac) return;
    const t = ac.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(ac, t + i * 0.12, f, 0.3, 'triangle', 0.12));
    tone(ac, t + 0.5, 1318.5, 0.6, 'sine', 0.08);
  },
};
