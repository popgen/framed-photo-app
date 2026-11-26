import { describe, expect, it } from "vitest";
import { attachStorageToCheckoutItem } from "../src/lib/checkout-media";

describe("attachStorageToCheckoutItem", () => {
  it("uploads Christmas card photos and rewrites local ids to storage paths", async () => {
    const calls: string[] = [];
    const uploaded = await attachStorageToCheckoutItem(
      {
        photoId: "",
        card: {
          sizeId: "a4",
          quantity: 1,
          envelopeColor: "blanco",
          templateId: "noche",
          frontMessage: null,
          insideMessage: null,
          photos: { front: "ph_abc12345678", insideCenter: null },
          bleed: false,
        },
      },
      async (photoId) => {
        calls.push(photoId);
        return { original: `uploads/${photoId}.jpg`, print: `uploads/${photoId}.jpg` };
      },
    );
    expect(calls).toEqual(["ph_abc12345678"]);
    expect(uploaded.card?.photos.front).toBe("uploads/ph_abc12345678.jpg");
    expect(uploaded.card?.photos.insideCenter).toBeNull();
    expect(uploaded.photoPrintPath).toBe("uploads/ph_abc12345678.jpg");
    expect(uploaded.photoOriginalPath).toBe("uploads/ph_abc12345678.jpg");
  });

  it("still uploads frame and collage photos, and skips the test product", async () => {
    const calls: string[] = [];
    const upload = async (photoId: string) => {
      calls.push(photoId);
      return { original: `uploads/${photoId}-orig.jpg`, print: `uploads/${photoId}-print.jpg` };
    };
    const frame = await attachStorageToCheckoutItem({ photoId: "ph_frame" }, upload);
    expect(frame.photoOriginalPath).toBe("uploads/ph_frame-orig.jpg");
    expect(frame.photoPrintPath).toBe("uploads/ph_frame-print.jpg");
    const collage = await attachStorageToCheckoutItem(
      { photoId: "", collage: { templateId: "navidad", sources: [{ photoId: "ph_one" }, { photoId: "ph_two", storagePath: "uploads/already.jpg" }] } },
      upload,
    );
    expect(collage.collage?.sources[0].storagePath).toBe("uploads/ph_one-orig.jpg");
    expect(collage.collage?.sources[1].storagePath).toBe("uploads/already.jpg");
    const test = await attachStorageToCheckoutItem({ testProduct: true, photoId: "ph_skip" }, upload);
    expect(test.photoPrintPath).toBeNull();
    expect(calls).toEqual(["ph_frame", "ph_one"]);
  });
});
