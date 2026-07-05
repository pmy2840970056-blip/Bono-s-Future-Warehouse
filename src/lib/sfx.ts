// Lightweight Web Audio SFX — no assets, respects mute preference.
let ctx: AudioContext | null = null;
const MUTE_KEY = "sfx:muted";

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function isMuted(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(MUTE_KEY) === "1";
}
export function setMuted(v: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MUTE_KEY, v ? "1" : "0");
  window.dispatchEvent(new Event("sfx:mute-change"));
}
export function toggleMuted(): boolean {
  const next = !isMuted();
  setMuted(next);
  return next;
}

type Tone = {
  freq: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  slideTo?: number;
  delay?: number;
};

function play(tones: Tone[]) {
  if (isMuted()) return;
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;
  for (const t of tones) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = t.type ?? "sine";
    const start = now + (t.delay ?? 0);
    osc.frequency.setValueAtTime(t.freq, start);
    if (t.slideTo) osc.frequency.exponentialRampToValueAtTime(t.slideTo, start + t.dur);
    const peak = t.gain ?? 0.12;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + t.dur);
    osc.connect(g).connect(ac.destination);
    osc.start(start);
    osc.stop(start + t.dur + 0.02);
  }
}

// Satisfying "ding-dong" up-chirp for task completion
export const sfxComplete = () =>
  play([
    { freq: 660, dur: 0.12, type: "triangle", gain: 0.14 },
    { freq: 990, dur: 0.22, type: "triangle", gain: 0.14, delay: 0.09 },
  ]);

// Thud when a brick drops into today
export const sfxDrop = () =>
  play([
    { freq: 220, slideTo: 90, dur: 0.18, type: "square", gain: 0.1 },
    { freq: 140, slideTo: 70, dur: 0.14, type: "sine", gain: 0.14, delay: 0.02 },
  ]);

// Soft pop when adding something
export const sfxPop = () =>
  play([{ freq: 520, slideTo: 780, dur: 0.09, type: "sine", gain: 0.09 }]);

// Click for toggles / open
export const sfxClick = () =>
  play([{ freq: 380, dur: 0.05, type: "square", gain: 0.05 }]);

// Whoosh-down for delete
export const sfxDelete = () =>
  play([{ freq: 400, slideTo: 120, dur: 0.18, type: "sawtooth", gain: 0.07 }]);

// Cheerful arpeggio for AI import success / seed success
export const sfxCheer = () =>
  play([
    { freq: 523, dur: 0.12, type: "triangle", gain: 0.11 },
    { freq: 659, dur: 0.12, type: "triangle", gain: 0.11, delay: 0.08 },
    { freq: 784, dur: 0.14, type: "triangle", gain: 0.11, delay: 0.16 },
    { freq: 1046, dur: 0.22, type: "triangle", gain: 0.11, delay: 0.24 },
  ]);

// Error buzz
export const sfxError = () =>
  play([{ freq: 200, dur: 0.16, type: "sawtooth", gain: 0.09 }]);
