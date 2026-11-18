import { describe, expect, it } from "vitest";
import { fillEmptyWallSlots, replaceWallSlot, wallPhotosReady } from "../src/lib/wall-slots";

const frame1 = { id: "photo-1", width: 1200, height: 1600 };
const frame2 = { id: "photo-2", width: 1000, height: 1400 };
const replacement = { id: "photo-2b", width: 1800, height: 1200 };

describe("wall slots", () => {
  it("replaces frame 2 without changing frame 1", () => {
    const filled = replaceWallSlot(replaceWallSlot([], 0, frame1), 1, frame2);
    const next = replaceWallSlot(filled, 1, replacement);
    expect(next[0]).toEqual(frame1);
    expect(next[1]).toEqual(replacement);
    expect(next).toHaveLength(2);
  });

  it("fills only empty frames and keeps holes instead of shifting to the first slot", () => {
    const next = fillEmptyWallSlots([frame1, null, null], 3, [replacement]);
    expect(next).toEqual([frame1, replacement, null]);
    expect(wallPhotosReady(next, 3)).toBe(false);
    expect(wallPhotosReady(replaceWallSlot(next, 2, frame2), 3)).toBe(true);
  });
});
