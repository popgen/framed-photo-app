import { describe, expect, it } from "vitest";
import frames from "../data/frames.json";
import { dpiStatus, printDpi, reduceWa } from "../src/lib/whatsapp/flow.mjs";

const catalog = frames.map((frame) => ({
  id: frame.id,
  name: frame.name,
  priceCents: frame.priceCents,
  sizeLabel: frame.sizeLabel,
  printWcm: frame.printWcm,
  printHcm: frame.printHcm,
}));

const ctx = { catalog, origin: "http://localhost:8081", supportNumber: "51999999999" };

describe("whatsapp ordering", () => {
  it("checks resolution with the same 300 dpi targets", () => {
    expect(Math.round(printDpi(1772, 2362, 15, 20))).toBe(300);
    expect(dpiStatus(printDpi(1772, 2362, 15, 20))).toBe("good");
    expect(dpiStatus(printDpi(700, 900, 15, 20))).toBe("low");
  });

  it("offers frames after a photo and a magic link after confirm", () => {
    const first = reduceWa(null, { type: "image", width: 1772, height: 2362, phone: "51987654321" }, ctx);
    expect(first.replies.some((reply) => reply.kind === "list")).toBe(true);
    const picked = reduceWa(first.session, { type: "select", id: "wood-15" }, ctx);
    expect(picked.replies[0].body).toMatch(/Madera natural/);
    expect(picked.replies[0].body).toMatch(/S\/ 59/);
    expect(picked.replies[0].body).toMatch(/DNI/);
    expect(picked.createOrder).toBe(false);
    const identified = reduceWa(picked.session, { type: "text", text: "87654321" }, ctx);
    expect(identified.session.taxIdType).toBe("DNI");
    const skipped = reduceWa(picked.session, { type: "text", text: "no tengo" }, ctx);
    expect(skipped.session.taxIdSkipped).toBe(true);
    expect(skipped.session.taxId).toBeNull();
    expect(skipped.replies[0].body).toMatch(/Sin DNI\/RUC/);
    const confirmed = reduceWa(identified.session, { type: "select", id: "confirm" }, ctx);
    expect(confirmed.createOrder).toBe(true);
    expect(confirmed.replies[0].body).toContain("http://localhost:8081/w/");
    const buttons = confirmed.replies.find((reply) => reply.kind === "buttons" && reply.buttons?.some((button) => String(button.id).startsWith("pay_")));
    expect(buttons?.buttons?.map((button) => button.title)).toEqual(["Pagar con Izipay", "Mercado Pago"]);
    expect(JSON.stringify(buttons)).not.toMatch(/plin|yape/i);
    const pay = reduceWa(confirmed.session, { type: "select", id: "pay_card" }, ctx);
    expect(pay.replies[0].body).toContain("pago=card");
    const oldYape = reduceWa(confirmed.session, { type: "select", id: "pay_yape" }, ctx);
    expect(oldYape.replies[0].body).toMatch(/Mercado Pago/);
    expect(oldYape.replies[0].body).not.toContain("pago=yape");
    expect(oldYape.replies[0].body).not.toContain("pago=plin");
  });

  it("warns when the photo is too small and still links a smaller size", () => {
    const first = reduceWa(null, { type: "image", width: 700, height: 900, phone: "51911111111" }, ctx);
    expect(first.replies[0].body).toMatch(/queda chica|no alcanza/);
    const picked = reduceWa(first.session, { type: "select", id: "black-30" }, ctx);
    expect(picked.replies[0].body).toMatch(/15×20|nítida|suave|chica/);
  });

  it("offers a gallery wall for several photos and a person as fallback", () => {
    let step = reduceWa(null, { type: "image", width: 2000, height: 2600, phone: "51922222222" }, ctx);
    step = reduceWa(step.session, { type: "image", width: 2000, height: 2600 }, ctx);
    expect(step.replies.some((reply) => reply.kind === "buttons" && reply.buttons.some((button) => button.id === "mode_wall"))).toBe(true);
    const wallAsk = reduceWa(step.session, { type: "select", id: "mode_wall" }, ctx);
    expect(wallAsk.createOrder).toBe(false);
    const wall = reduceWa(wallAsk.session, { type: "text", text: "87654321" }, ctx);
    expect(wall.createOrder).toBe(true);
    expect(wall.session.mode).toBe("wall");
    const human = reduceWa(step.session, { type: "select", id: "human" }, ctx);
    expect(human.session.needsHuman).toBe(true);
    expect(human.replies[0].body).toMatch(/equipo/);
  });
});
