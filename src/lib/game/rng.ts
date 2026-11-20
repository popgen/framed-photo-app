/** Mulberry32. Same seed, same sequence in the browser and on the server. */
export type Rng = {
  next(): number;
  state(): number;
};

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return {
    state: () => a >>> 0,
    next() {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}
