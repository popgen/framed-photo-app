import { describe, expect, it } from "vitest";
import { checkOtp, hashCode, OTP_MAX_ATTEMPTS, OTP_TTL_MS, otpTemplateBody, prepareSend, publicSendResult, readSession, signSession } from "../src/lib/otp";
import { shouldWarnLocalMode } from "../src/lib/hosted";
import { formatOrderNumber } from "../src/lib/order-number";
import { toTrackingCard } from "../src/lib/tracking";
import type { Order } from "../src/lib/types";

describe("order numbers", () => {
  it("formats MF-26-1004 from the sequence and the Lima year", () => {
    expect(formatOrderNumber(1001, new Date("2026-11-18T12:00:00-05:00"))).toBe("MF-26-1001");
    expect(formatOrderNumber(1004, new Date("2026-06-01T00:00:00-05:00"))).toBe("MF-26-1004");
    expect(formatOrderNumber(1001, new Date("2027-01-02T00:00:00-05:00"))).toBe("MF-27-1001");
  });

  it("warns when the public site is still on browser storage", () => {
    expect(shouldWarnLocalMode("mifotito.com", "local")).toBe(true);
    expect(shouldWarnLocalMode("mifotito.netlify.app", "local")).toBe(true);
    expect(shouldWarnLocalMode("mifotito.com", "supabase")).toBe(false);
    expect(shouldWarnLocalMode("localhost", "local")).toBe(false);
  });
});

describe("phone code", () => {
  it("stores a hash, expires after 10 minutes, and locks after 5 misses", async () => {
    const now = 1_000_000;
    const prepared = await prepareSend({ phone: "987654321", now, phoneSends: [], ipSends: [] });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.record.codeHash).not.toBe(prepared.code);
    expect(prepared.record.codeHash).toBe(await hashCode(prepared.code, prepared.record.salt));
    expect(await checkOtp(prepared.record, prepared.code, now + OTP_TTL_MS + 1)).toMatchObject({ ok: false, reason: "expired" });
    let record = prepared.record;
    for (let attempt = 0; attempt < OTP_MAX_ATTEMPTS; attempt += 1) {
      const result = await checkOtp(record, "000000", now);
      expect(result.ok).toBe(false);
      record = result.record ?? record;
    }
    expect(await checkOtp(record, prepared.code, now)).toMatchObject({ ok: false, reason: "attempts" });
  });

  it("rate limits a phone and an IP to one a minute and five an hour", async () => {
    const now = 5_000_000;
    const stamps = [0, 1, 2, 3].map((index) => ({ at: now - 50_000 - index * 60_000 }));
    const blocked = await prepareSend({ phone: "987654321", now, phoneSends: [{ at: now - 10_000 }], ipSends: [] });
    expect(blocked.ok).toBe(false);
    const byIp = await prepareSend({ phone: "987654321", now, phoneSends: [], ipSends: [{ at: now - 5_000 }] });
    expect(byIp.ok).toBe(false);
    const hour = await prepareSend({ phone: "912345678", now, phoneSends: stamps.concat([{ at: now - 120_000 }]), ipSends: [] });
    expect(hour.ok).toBe(false);
  });

  it("does not tell the sender whether that phone has orders", async () => {
    const prepared = await prepareSend({ phone: "987654321", now: 10, phoneSends: [], ipSends: [] });
    const hidden = publicSendResult(prepared, false);
    expect(hidden).not.toHaveProperty("demoCode");
    expect(JSON.stringify(hidden)).not.toMatch(/pedido|orders/i);
    const demo = publicSendResult(prepared, true);
    expect(demo.ok && demo.demo).toBe(true);
  });

  it("signs a session that expires", async () => {
    const token = await signSession("51987654321", "secret", 5_000);
    expect(await readSession(token, "secret", 4_000)).toEqual({ phone: "51987654321" });
    expect(await readSession(token, "secret", 5_001)).toBeNull();
    expect(await readSession(token, "other", 4_000)).toBeNull();
  });

  it("builds the authentication template payload", () => {
    const body = otpTemplateBody("51987654321", "123456", "mifotito_codigo", "es");
    expect(body.template.name).toBe("mifotito_codigo");
    expect(body.template.components[0].parameters[0].text).toBe("123456");
  });
});

describe("tracking cards", () => {
  it("hides the street and the recipient phone", () => {
    const card = toTrackingCard({
      publicToken: "abc",
      number: "MF-26-1004",
      status: "paid",
      customerName: "Ana",
      phone: "51987654321",
      addressLine: "Calle Berlín 214",
      district: "Miraflores",
      province: "Lima",
      department: "Lima",
      city: "Lima",
      recipientPhone: "51911111111",
      createdAt: "2026-11-18T12:00:00.000Z",
      etaLabel: "2 a 3 días",
      christmasNote: "Llega",
      trackingNumber: "OLVA-1",
      totalCents: 5900,
      items: [],
    } as unknown as Order);
    expect(card.addressMasked).not.toContain("Berlín");
    expect(card.addressMasked).toContain("Miraflores");
    expect(card.recipientPhoneMasked).toBe("5191****111");
    expect(card).not.toHaveProperty("addressLine");
  });
});
