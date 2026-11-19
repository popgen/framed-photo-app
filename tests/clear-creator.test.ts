import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CLEAR_PHOTOS_CANCEL,
  CLEAR_PHOTOS_CONFIRM,
  CLEAR_PHOTOS_LABEL,
  CLEAR_PHOTOS_MESSAGE,
  clearCollageEditor,
  clearSingleEditor,
  hasLoadedPhotos,
  heldBlobIds,
  nextLayoutSeed,
  planForget,
  removeDraftKeys,
  type CartPhotoHold,
  type CollageEditorSnapshot,
  type SingleEditorSnapshot,
} from "../src/lib/clear-creator";
import { voiceStorageKey } from "../src/lib/voice";

const single: SingleEditorSnapshot = {
  frameId: "wood-15",
  orientation: "landscape",
  chip: "madera",
  photoId: "ph_user",
  overlayText: "Familia",
  voiceToken: "voz123",
  ack: true,
  sampleNote: "muy chica",
};

const collage: CollageEditorSnapshot = {
  frameId: "black-30",
  templateId: "polaroids",
  orientation: "landscape",
  caption: "Navidad 2026",
  layoutSeed: 0xabc,
  photoIds: ["ph_a", "ph_b"],
  selected: 1,
  ack: true,
  notice: "Cambiamos el diseño",
  note: "Falta una foto",
};

describe("clear creator state", () => {
  it("shows the button only after the user loads a photo", () => {
    expect(hasLoadedPhotos([])).toBe(false);
    expect(hasLoadedPhotos([null, undefined, ""])).toBe(false);
    expect(hasLoadedPhotos(["asset:sample"])).toBe(false);
    expect(hasLoadedPhotos(["asset:sample-small"])).toBe(false);
    expect(hasLoadedPhotos(["asset:sample", "ph_user"])).toBe(true);
  });

  it("returns the single editor to the sample and keeps the frame choices", () => {
    expect(clearSingleEditor(single, "asset:sample")).toEqual({
      frameId: "wood-15",
      orientation: "landscape",
      chip: "madera",
      photoId: "asset:sample",
      overlayText: null,
      voiceToken: null,
      ack: false,
      sampleNote: null,
    });
  });

  it("empties the collage and replaces the Mezclar seed without touching layout", () => {
    expect(clearCollageEditor(collage, 99)).toEqual({
      frameId: "black-30",
      templateId: "polaroids",
      orientation: "landscape",
      caption: "Navidad 2026",
      layoutSeed: 99,
      photoIds: [],
      selected: null,
      ack: false,
      notice: null,
      note: null,
    });
    expect(nextLayoutSeed(0xabc, () => 99)).toBe(99);
    expect(nextLayoutSeed(0xabc, () => 0xabc)).toBe((0xabc + 0x9e3779b9) >>> 0);
    expect(nextLayoutSeed(0, () => 0)).not.toBe(0);
  });

  it("forgets editor blobs and the voice draft, and keeps anything the cart still uses", () => {
    const cart: CartPhotoHold[] = [
      {
        photoId: "ph_cart",
        voice: { token: "en-carrito", audioId: "au_cart", selfieId: "sf_cart" },
        collage: { sources: [{ photoId: "ph_a" }] },
        card: { photos: { front: "ph_card", insideLeft: null } },
      },
    ];
    expect([...heldBlobIds(cart)].sort()).toEqual(
      ["au_cart", "au_cart:original", "ph_a", "ph_a:original", "ph_card", "ph_card:original", "ph_cart", "ph_cart:original", "sf_cart", "sf_cart:original"].sort(),
    );
    const plan = planForget({
      photoIds: ["ph_a", "ph_b", "asset:sample"],
      extraIds: ["au_editor", "sf_editor", null],
      voiceToken: "voz-editor",
      cart,
    });
    expect(plan).toEqual({
      forgetBlobIds: ["ph_b", "ph_b:original", "au_editor", "au_editor:original", "sf_editor", "sf_editor:original"],
      forgetVoiceKeys: [voiceStorageKey("voz-editor")],
    });
    const kept = planForget({
      photoIds: ["ph_cart"],
      extraIds: ["au_cart", "sf_cart"],
      voiceToken: "en-carrito",
      cart,
    });
    expect(kept).toEqual({ forgetBlobIds: [], forgetVoiceKeys: [] });
    expect(planForget({ photoIds: ["asset:sample"], voiceToken: "voz-editor", cart: [] })).toBeNull();
  });

  it("does not remove cart storage when dropping a voice draft", () => {
    const removed: string[] = [];
    removeDraftKeys(
      ["recuerdo-voice-abc", "recuerdo-voice-", "recuerdo-cart-v1", "recuerdo-cart-gift-v1", "recuerdo-db-v2", "recuerdo-profile", "recuerdo-wa-boot"],
      { removeItem: (key) => removed.push(key) },
    );
    expect(removed).toEqual(["recuerdo-voice-abc"]);
    expect(voiceStorageKey("abc")).toBe("recuerdo-voice-abc");
    removeDraftKeys(["recuerdo-voice-abc"], null);
  });

  it("uses the confirmation copy and wires both creators without clearing the cart", () => {
    expect(CLEAR_PHOTOS_LABEL).toBe("Borrar todo");
    expect(CLEAR_PHOTOS_MESSAGE).toBe("¿Borrar todas las fotos? Esto no se puede deshacer.");
    expect(CLEAR_PHOTOS_CANCEL).toBe("Cancelar");
    expect(CLEAR_PHOTOS_CONFIRM).toBe("Borrar");
    for (const path of ["src/app/crear.tsx", "src/app/collage.tsx"]) {
      const source = readFileSync(path, "utf8");
      expect(source).toContain("ClearPhotosButton");
      expect(source).toContain("hasLoadedPhotos");
      expect(source).toContain("planForget");
      expect(source).toContain("forgetClearedDraft");
      expect(source).not.toContain("state.clear(");
      expect(source).not.toContain("useCart.getState().clear");
    }
    const button = readFileSync("src/components/ClearPhotosButton.tsx", "utf8");
    expect(button).toContain("CLEAR_PHOTOS_MESSAGE");
    expect(button).toContain("CLEAR_PHOTOS_CANCEL");
    expect(button).toContain("CLEAR_PHOTOS_CONFIRM");
  });
});
