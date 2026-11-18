import { describe, expect, it } from "vitest";
import { extensionForMime, uploadObjectPath } from "../src/lib/upload-path";

describe("upload paths", () => {
  it("uses a unique name under uploads/", () => {
    expect(extensionForMime("image/jpeg")).toBe("jpg");
    expect(extensionForMime("audio/webm")).toBe("webm");
    expect(extensionForMime("audio/mp4")).toBe("m4a");
    expect(extensionForMime("audio/aac")).toBe("m4a");
    const path = uploadObjectPath("image/png");
    expect(path).toMatch(/^uploads\/[0-9a-f-]{36}\.png$/);
  });
});
