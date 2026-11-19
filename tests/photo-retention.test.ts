import { describe, expect, it } from "vitest";
import { planPhotoPurge, retentionCutoff } from "../src/lib/photo-retention";

const now = new Date("2026-11-18T12:00:00.000Z");

function order(id: string, status: string, updated_at: string) {
  return { id, status, updated_at };
}

describe("photo retention", () => {
  it("counts 30 days back from now", () => {
    expect(retentionCutoff(now).toISOString()).toBe("2026-10-19T12:00:00.000Z");
  });

  it("deletes photos from orders delivered or cancelled more than 30 days ago", () => {
    const plan = planPhotoPurge({
      now,
      orders: [
        order("old", "delivered", "2026-10-01T00:00:00.000Z"),
        order("gone", "cancelled", "2026-09-01T00:00:00.000Z"),
        order("fresh", "delivered", "2026-11-01T00:00:00.000Z"),
        order("open", "shipped", "2026-08-01T00:00:00.000Z"),
      ],
      items: [
        { id: "i-old", order_id: "old", photo_path: "uploads/old.jpg", original_path: "uploads/old-orig.jpg", print_path: "uploads/old-print.jpg" },
        { id: "i-gone", order_id: "gone", photo_path: "uploads/gone.jpg" },
        { id: "i-fresh", order_id: "fresh", photo_path: "uploads/fresh.jpg" },
        { id: "i-open", order_id: "open", photo_path: "uploads/open.jpg" },
      ],
      claims: [
        { id: "c-old", order_id: "old", photo_path: "uploads/damage.jpg" },
        { id: "c-open", order_id: "open", photo_path: "uploads/open-damage.jpg" },
      ],
      notes: [],
      objects: [],
    });
    expect(plan.deletePaths).toEqual(["uploads/damage.jpg", "uploads/gone.jpg", "uploads/old-orig.jpg", "uploads/old-print.jpg", "uploads/old.jpg"]);
    expect(plan.itemPatches.map((patch) => patch.id).sort()).toEqual(["i-gone", "i-old"]);
    expect(plan.clearClaimIds).toEqual(["c-old"]);
  });

  it("keeps a photo that a recent order still needs", () => {
    const plan = planPhotoPurge({
      now,
      orders: [order("old", "delivered", "2026-09-01T00:00:00.000Z"), order("open", "paid", "2026-11-10T00:00:00.000Z")],
      items: [
        { id: "i-old", order_id: "old", photo_path: "uploads/shared.jpg" },
        { id: "i-open", order_id: "open", photo_path: "uploads/shared.jpg" },
      ],
      claims: [],
      notes: [],
      objects: [{ path: "uploads/shared.jpg", createdAt: "2026-08-01T00:00:00.000Z" }],
    });
    expect(plan.deletePaths).toEqual([]);
    expect(plan.itemPatches).toEqual([]);
  });

  it("deletes abandoned files older than 30 days and keeps voice audio", () => {
    const plan = planPhotoPurge({
      now,
      orders: [order("old", "delivered", "2026-09-01T00:00:00.000Z")],
      items: [
        {
          id: "i-old",
          order_id: "old",
          photo_path: "uploads/frame.jpg",
          voice: { audioPath: "uploads/hola.webm", selfiePath: "uploads/selfies/hola.jpg" },
        },
      ],
      claims: [],
      notes: [
        { token: "hola", storage_path: "uploads/hola.webm", selfie_path: "uploads/selfies/hola.jpg", created_at: "2026-09-01T00:00:00.000Z" },
        { token: "solo", storage_path: "uploads/solo.m4a", selfie_path: "uploads/selfies/solo.jpg", created_at: "2026-09-01T00:00:00.000Z" },
      ],
      objects: [
        { path: "uploads/frame.jpg", createdAt: "2026-09-01T00:00:00.000Z" },
        { path: "uploads/hola.webm", createdAt: "2026-09-01T00:00:00.000Z" },
        { path: "uploads/abandon.jpg", createdAt: "2026-09-01T00:00:00.000Z" },
        { path: "uploads/new.jpg", createdAt: "2026-11-10T00:00:00.000Z" },
        { path: "uploads/loose.webm", createdAt: "2026-09-01T00:00:00.000Z" },
      ],
    });
    expect(plan.deletePaths).toEqual(["uploads/abandon.jpg", "uploads/frame.jpg", "uploads/loose.webm", "uploads/selfies/hola.jpg", "uploads/selfies/solo.jpg"]);
    expect(plan.deletePaths).not.toContain("uploads/hola.webm");
    expect(plan.deletePaths).not.toContain("uploads/solo.m4a");
    expect(plan.clearNoteTokens.sort()).toEqual(["hola", "solo"]);
    expect(plan.itemPatches[0]?.voice).toEqual({ audioPath: "uploads/hola.webm", selfiePath: null });
  });

  it("keeps a selfie while the order is still open", () => {
    const plan = planPhotoPurge({
      now,
      orders: [order("open", "printed", "2026-09-01T00:00:00.000Z")],
      items: [{ id: "i-open", order_id: "open", voice: { selfiePath: "uploads/selfies/soon.jpg" } }],
      claims: [],
      notes: [{ token: "soon", storage_path: "uploads/soon.webm", selfie_path: "uploads/selfies/soon.jpg", created_at: "2026-09-01T00:00:00.000Z" }],
      objects: [{ path: "uploads/selfies/soon.jpg", createdAt: "2026-09-01T00:00:00.000Z" }],
    });
    expect(plan.deletePaths).toEqual([]);
    expect(plan.clearNoteTokens).toEqual([]);
  });
});
