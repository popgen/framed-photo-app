import { describe, expect, it } from "vitest";
import { passwordError } from "../src/lib/customer-auth";
import { normalizePhone } from "../src/lib/phone";
import { createLocalRepo } from "../src/lib/repo-local";
import { isOpenShipment, shortName, toPublicShipment, trackLimitMessage, TRACK_PHONE_LIMIT } from "../src/lib/tracking";

describe("customer auth and public tracking", () => {
  it("asks for 8 characters", () => {
    expect(passwordError("corta")).toMatch(/8/);
    expect(passwordError("12345678")).toBeNull();
  });

  it("normalizes a Peruvian mobile to +51 and 9 digits", () => {
    expect(normalizePhone("987 654 321")).toBe("51987654321");
    expect(normalizePhone("+51 987 654 321")).toBe("51987654321");
    expect(normalizePhone("12345")).toBeNull();
  });

  it("hides delivered orders and private fields on the public tracker", async () => {
    const repo = createLocalRepo();
    await repo.init();
    const open = await repo.listPublicTracking("922 222 222");
    const done = await repo.listPublicTracking("933 333 333");
    expect(open.map((order) => order.number)).toEqual(["MF-26-1002"]);
    expect(done).toEqual([]);
    expect(isOpenShipment("delivered")).toBe(false);
    expect(isOpenShipment("cancelled")).toBe(false);
    expect(isOpenShipment("paid")).toBe(true);
    const card = toPublicShipment({
      number: "MF-26-1002",
      status: "paid",
      etaLabel: "3 a 5 días hábiles",
      customerName: "Mateo Quispe",
      items: [{ card: null }],
    });
    expect(card.nameHint).toBe("Mateo Q.");
    expect(shortName("Lucía")).toBe("Lucía");
    expect(card.itemLabel).toBe("Marco");
    const dumped = JSON.stringify(card);
    expect(dumped).not.toMatch(/Av\.|DNI|RUC|yape|photo|address/i);
    expect(Object.keys(card).sort()).toEqual(["etaLabel", "itemLabel", "nameHint", "number", "status", "timeline"]);
  });

  it("limits lookups by phone and by IP", () => {
    const now = Date.now();
    const events = Array.from({ length: TRACK_PHONE_LIMIT }, () => ({ phone: "51987654321", ip: "1.1.1.1", at: now - 1000 }));
    expect(trackLimitMessage(events, "51987654321", "8.8.8.8", now)).toMatch(/celular/);
    const byIp = Array.from({ length: 30 }, (_, index) => ({ phone: `5190000000${index}`, ip: "9.9.9.9", at: now - 1000 }));
    expect(trackLimitMessage(byIp, "51911111111", "9.9.9.9", now)).toMatch(/conexión/);
    expect(trackLimitMessage([], "51987654321", "1.1.1.1", now)).toBeNull();
  });
});
