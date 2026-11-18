import { describe, expect, it } from "vitest";
import { extensionForMime, uploadObjectPath } from "../src/lib/upload-path";
import { customerOrder } from "../src/lib/tracking";

describe("live supabase shop", () => {
  it("stores each file as uploads/<uuid>.<ext>", () => {
    expect(extensionForMime("image/jpeg")).toBe("jpg");
    expect(extensionForMime("audio/mp4")).toBe("m4a");
    expect(uploadObjectPath("image/webp")).toMatch(/^uploads\/[0-9a-f-]{36}\.webp$/);
  });

  it("hides the MF number from a customer payload", () => {
    expect(customerOrder({ number: "MF-26-1004", publicToken: "abc" })).toEqual({ number: "", publicToken: "abc" });
  });
});
