const SCALES: Record<number, number[]> = {
  1: [523, 587, 659, 784, 880],
  2: [440, 523, 587, 698, 784],
  3: [392, 466, 523, 622, 698],
  4: [311, 370, 415, 466, 554],
};

export type GameSound = {
  toggle(): boolean;
  enabled(): boolean;
  jump(): void;
  photo(): void;
  golden(): void;
  crash(): void;
  tick(zone: number, frame: number): void;
  stop(): void;
};

export function createSound(): GameSound {
  let ctx: AudioContext | null = null;
  let on = false;
  let lastNote = -8;

  function context(): AudioContext | null {
    if (!on || typeof AudioContext === "undefined") return null;
    if (!ctx) {
      try {
        ctx = new AudioContext();
      } catch {
        return null;
      }
    }
    // Some browsers (or devices with no audio output) reject resume(); the game stays silent.
    if (ctx.state === "suspended") ctx.resume().catch(() => undefined);
    return ctx;
  }

  function blip(freq: number, dur: number, type: OscillatorType, gain: number): void {
    const audio = context();
    if (!audio) return;
    const osc = audio.createOscillator();
    const amp = audio.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    amp.gain.setValueAtTime(gain, audio.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + dur);
    osc.connect(amp);
    amp.connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + dur);
  }

  return {
    enabled: () => on,
    toggle() {
      on = !on;
      if (on) context();
      else ctx?.suspend();
      return on;
    },
    jump() {
      blip(620, 0.09, "square", 0.03);
    },
    photo() {
      blip(880, 0.08, "sine", 0.04);
    },
    golden() {
      blip(988, 0.12, "triangle", 0.05);
      blip(1318, 0.16, "sine", 0.03);
    },
    crash() {
      blip(140, 0.18, "sawtooth", 0.04);
    },
    tick(zone, frame) {
      if (!on || frame - lastNote < 18) return;
      lastNote = frame;
      const scale = SCALES[zone] ?? SCALES[1];
      const note = scale[Math.floor(frame / 18) % scale.length] ?? 523;
      blip(note, 0.18, "sine", 0.02);
    },
    stop() {
      void ctx?.close();
      ctx = null;
      on = false;
    },
  };
}
