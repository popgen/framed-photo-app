import { describe, expect, it } from "vitest";
import {
  authorizeUrl,
  facebookPhotos,
  googleOriginalUrl,
  googlePhotos,
  instagramPhotos,
  openImport,
  sealImport,
} from "../src/lib/photo-import";

describe("photo import oauth", () => {
  it("builds the three authorize links with the high-res scopes", () => {
    const input = { clientId: "app", redirectUri: "https://mifotito.com/api/imports/callback", state: "signed" };
    expect(authorizeUrl("instagram", input)).toContain("instagram_business_basic");
    expect(authorizeUrl("facebook", input)).toContain("user_photos");
    expect(authorizeUrl("google", input)).toContain("photospicker.mediaitems.readonly");
    expect(authorizeUrl("facebook", input)).toContain(encodeURIComponent(input.redirectUri));
  });

  it("keeps the largest Facebook image and the original Google download", () => {
    const facebook = facebookPhotos({
      data: [{ id: "p1", images: [{ source: "https://cdn/small.jpg", width: 200, height: 200 }, { source: "https://cdn/big.jpg", width: 3000, height: 2000 }] }],
    });
    expect(facebook[0]).toMatchObject({ url: "https://cdn/big.jpg", thumbUrl: "https://cdn/small.jpg", width: 3000 });
    expect(googleOriginalUrl("https://lh3.googleusercontent.com/abc")).toBe("https://lh3.googleusercontent.com/abc=d");
    expect(googlePhotos({ mediaItems: [{ id: "g1", type: "PHOTO", mediaFile: { baseUrl: "https://photos/abc", mimeType: "image/jpeg" } }, { id: "v", type: "VIDEO", mediaFile: { baseUrl: "https://photos/v", mimeType: "video/mp4" } }] })).toEqual([
      { id: "g1", width: 0, height: 0, url: "https://photos/abc=d", thumbUrl: "https://photos/abc=w256-h256" },
    ]);
    expect(instagramPhotos({ data: [{ id: "i1", media_type: "IMAGE", media_url: "https://ig/a.jpg" }, { id: "i2", media_type: "VIDEO", media_url: "https://ig/b.mp4" }] })).toHaveLength(1);
  });

  it("rejects a tampered or expired import session", async () => {
    const token = await sealImport({ provider: "facebook", accessToken: "tok" }, "secret", 5_000);
    expect((await openImport(token, "secret", 4_000))?.accessToken).toBe("tok");
    expect(await openImport(token, "secret", 5_001)).toBeNull();
    expect(await openImport(`${token}x`, "secret", 4_000)).toBeNull();
  });
});
