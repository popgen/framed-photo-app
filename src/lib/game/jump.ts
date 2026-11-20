/**
 * Variable jump.
 * A press leaves the ground with a small upward speed.
 * Holding applies extra upward thrust while still rising, until a time limit
 * or the height cap. Releasing while rising multiplies the upward speed so
 * the arc is cut short. Touch, mouse and keyboard only differ by who calls
 * pressJump / releaseJump.
 */
export const DT = 1 / 60;

export const JUMP = {
  gravity: 2200,
  hopVelocity: 760,
  thrust: 1400,
  maxHold: 0.36,
  cutFactor: 0.7,
  maxHeight: 168,
} as const;

export type Jumper = {
  y: number;
  vy: number;
  holding: boolean;
  holdTime: number;
  cut: boolean;
  grounded: boolean;
};

export function createJumper(): Jumper {
  return { y: 0, vy: 0, holding: false, holdTime: 0, cut: false, grounded: true };
}

export function pressJump(jumper: Jumper): void {
  if (!jumper.grounded) return;
  jumper.grounded = false;
  jumper.holding = true;
  jumper.holdTime = 0;
  jumper.cut = false;
  jumper.vy = JUMP.hopVelocity;
}

export function releaseJump(jumper: Jumper): void {
  if (!jumper.holding) return;
  jumper.holding = false;
  if (jumper.vy > 0 && !jumper.cut) {
    jumper.vy *= JUMP.cutFactor;
    jumper.cut = true;
  }
}

export function stepJump(jumper: Jumper, dt: number): void {
  if (jumper.grounded) return;
  if (jumper.holding && jumper.vy > 0 && jumper.y < JUMP.maxHeight && jumper.holdTime < JUMP.maxHold) {
    const thrustTime = Math.min(dt, JUMP.maxHold - jumper.holdTime);
    jumper.vy += JUMP.thrust * thrustTime;
    jumper.holdTime += dt;
  }
  jumper.vy -= JUMP.gravity * dt;
  jumper.y += jumper.vy * dt;
  if (jumper.y >= JUMP.maxHeight) {
    jumper.y = JUMP.maxHeight;
    if (jumper.vy > 0) jumper.vy = 0;
    jumper.holding = false;
  }
  if (jumper.y <= 0) {
    jumper.y = 0;
    jumper.vy = 0;
    jumper.grounded = true;
    jumper.holding = false;
    jumper.cut = false;
    jumper.holdTime = 0;
  }
}

/** Peak height for a jump that is held for `holdSeconds` then released. */
export function jumpApex(holdSeconds: number): number {
  const jumper = createJumper();
  pressJump(jumper);
  let elapsed = 0;
  let peak = 0;
  let released = holdSeconds <= 0;
  if (released) releaseJump(jumper);
  for (let i = 0; i < 420; i += 1) {
    if (!released && elapsed + 1e-9 >= holdSeconds) {
      releaseJump(jumper);
      released = true;
    }
    stepJump(jumper, DT);
    elapsed += DT;
    if (jumper.y > peak) peak = jumper.y;
    if (jumper.grounded && i > 1) break;
  }
  return peak;
}

export type HoldSource = "touch" | "mouse" | "space" | "arrow";

/** Every accepted control writes the same down/up bit. */
export function holdBit(source: HoldSource, down: boolean): 0 | 1 {
  void source;
  return down ? 1 : 0;
}

export function keyHold(code: string, down: boolean): 0 | 1 | null {
  if (code !== "Space" && code !== "ArrowUp") return null;
  return holdBit(code === "Space" ? "space" : "arrow", down);
}
