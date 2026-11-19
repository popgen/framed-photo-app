import { describe, expect, it, vi } from "vitest";
import { giftNoteDocument, giftNoteFromCheckout, readStoredGiftNote } from "../src/lib/gift-note";
import { quote } from "../src/lib/pricing";
import { signUpCustomer } from "../src/lib/customer-auth";
import { createLocalRepo } from "../src/lib/repo-local";
import { evaluateOrder } from "../src/lib/server-order";
import { paidMessage } from "../src/lib/templates";
import type { CheckoutInput } from "../src/lib/types";

const memory = new Map<string, string>();

vi.stubGlobal("localStorage", {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => memory.set(key, value),
  removeItem: (key: string) => memory.delete(key),
});

function draft(extra: Partial<CheckoutInput> = {}): CheckoutInput {
  return {
    items: [{
      frameId: "thin-black-15",
      photoId: "p",
      crop: { imageWidth: 2000, imageHeight: 2000, x: 0, y: 0, width: 1500, height: 2000 },
      orientation: "portrait",
      dpi: 300,
      resolutionStatus: "good",
    }],
    customerName: "Ana Quispe",
    phone: "987654321",
    email: "ana@ejemplo.com",
    taxIdSkipped: true,
    giftWrap: true,
    giftPrinted: true,
    giftNoteTo: "Lucía",
    giftNoteMessage: "Con mucho cariño",
    giftNoteFrom: "",
    hidePrices: true,
    addressLine: "Calle 1",
    district: "Miraflores",
    city: "Lima",
    department: "Lima",
    province: "Lima",
    useCredit: false,
    paymentMethod: "plin",
    ackLowRes: false,
    ...extra,
  };
}

describe("printed gift note", () => {
  it("keeps the note free and separate from gift wrap", () => {
    const priced = quote({ items: [{ unitPriceCents: 5900 }], giftWrap: true, giftNote: true });
    expect(priced.giftNoteCents).toBe(0);
    expect(priced.giftWrapCents).toBe(1000);
    expect(priced.totalCents).toBe(6900);
  });

  it("rejects a message over 250 characters and a blank note", () => {
    expect(giftNoteFromCheckout(draft({ giftNoteMessage: "a".repeat(251) })).ok).toBe(false);
    const blank = giftNoteFromCheckout(draft({ giftNoteMessage: "   " }));
    expect(blank.ok).toBe(false);
    if (!blank.ok) expect(blank.error).toMatch(/mensaje/);
  });

  it("defaults De to the buyer and ignores the note when it is off", () => {
    const on = giftNoteFromCheckout(draft());
    expect(on.ok).toBe(true);
    if (on.ok && on.note) {
      expect(on.note.from).toBe("Ana Quispe");
      expect(on.note.to).toBe("Lucía");
      expect(on.note.hidePrices).toBe(true);
    }
    const off = giftNoteFromCheckout(draft({ giftPrinted: false, giftNoteMessage: "a".repeat(400) }));
    expect(off).toEqual({ ok: true, note: null });
  });

  it("reads columns and the JSON fallback stored before the migration", () => {
    expect(readStoredGiftNote({ gift_note_to: "Lucía", gift_note_message: "Hola", gift_note_from: "Ana", hide_prices: true })).toMatchObject({
      to: "Lucía",
      message: "Hola",
      from: "Ana",
      hidePrices: true,
    });
    expect(readStoredGiftNote({ gift_note: JSON.stringify({ to: "Teo", message: "Feliz día", from: "Ana", hidePrices: true }) })?.hidePrices).toBe(true);
    expect(readStoredGiftNote({ gift_note: "Un recado" })?.message).toBe("Un recado");
  });

  it("escapes the printable card and keeps it at A6", () => {
    const html = giftNoteDocument({ to: "<Lucía>", message: "Hola\n<script>", from: "Ana & Leo" });
    expect(html).toContain("105mm 148mm");
    expect(html).toContain("Para &lt;Lucía&gt;");
    expect(html).toContain("Hola<br>&lt;script&gt;");
    expect(html).toContain("Ana &amp; Leo");
    expect(html).not.toContain("<Lucía>");
    expect(html).not.toContain("Hola\n<script>");
  });

  it("persists the note on a local order without dropping gift wrap", async () => {
    const repo = createLocalRepo();
    await repo.init();
    await signUpCustomer("ana@ejemplo.com", "clave1234");
    const order = await repo.placeOrder(draft());
    expect(order.giftNoteMessage).toBe("Con mucho cariño");
    expect(order.giftNoteFrom).toBe("Ana Quispe");
    expect(order.hidePrices).toBe(true);
    expect(order.giftNoteCents).toBe(0);
    expect(order.giftWrap).toBe(true);
    expect(order.giftWrapCents).toBe(1000);
    const saved = await repo.getOrder(order.id);
    expect(saved?.giftNoteTo).toBe("Lucía");
  });

  it("rejects an oversized note on the server quote and still prices wrap", () => {
    const bad = evaluateOrder(draft({ giftNoteMessage: "a".repeat(251) }), { promos: [], stock: {}, enforceStock: false });
    expect(bad.error).toMatch(/250/);
    const good = evaluateOrder(draft(), { promos: [], stock: {}, enforceStock: false });
    expect(good.error).toBeUndefined();
    expect(good.giftNote?.message).toBe("Con mucho cariño");
    expect(good.priced?.giftWrapCents).toBe(1000);
    expect(good.priced?.giftNoteCents).toBe(0);
  });

  it("includes the printed note in the confirmation email", () => {
    const body = paidMessage({
      number: "MF-26-1008",
      customerName: "Ana Quispe",
      totalCents: 6900,
      christmasNote: "Llega para Navidad.",
      publicToken: "abc",
      giftNoteTo: "Lucía",
      giftNoteMessage: "Con mucho cariño",
      giftNoteFrom: "Ana Quispe",
      hidePrices: true,
    });
    expect(body).toMatch(/nota impresa para Lucía, de Ana Quispe/);
    expect(body).toMatch(/Con mucho cariño/);
    expect(body).toMatch(/sin precios/);
  });
});
