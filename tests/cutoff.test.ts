import { describe, expect, it } from "vitest";
import { defaultCampaign } from "../src/lib/campaign";
import { countdownTarget, guaranteeFor } from "../src/lib/cutoff";
import { shippingZone } from "../src/lib/zone";

const campaign = defaultCampaign;

describe("christmas cutoff", () => {
  it("guarantees Lima through 18 Dec 2026 23:59 Lima time", () => {
    expect(guaranteeFor(new Date("2026-12-18T23:59:59-05:00"), "lima", campaign).guaranteed).toBe(true);
    expect(guaranteeFor(new Date("2026-12-19T04:59:00Z"), "lima", campaign).guaranteed).toBe(true);
  });

  it("drops the Lima guarantee at midnight on the 19th and points to San Valentín", () => {
    const missed = guaranteeFor(new Date("2026-12-19T00:00:00-05:00"), "lima", campaign);
    expect(missed.guaranteed).toBe(false);
    expect(missed.headline).toMatch(/después de Navidad/);
    expect(missed.detail).toContain("San Valentín");
    expect(missed.detail).toContain("14 de febrero");
    expect(guaranteeFor(new Date("2026-12-19T05:00:00Z"), "lima", campaign).guaranteed).toBe(false);
  });

  it("uses the earlier provincial cutoff", () => {
    const dec16 = new Date("2026-12-16T12:00:00-05:00");
    expect(guaranteeFor(dec16, "lima", campaign).guaranteed).toBe(true);
    const provinces = guaranteeFor(dec16, "provinces", campaign);
    expect(provinces.guaranteed).toBe(false);
    expect(provinces.detail).toContain("San Valentín");
    expect(guaranteeFor(new Date("2026-12-15T23:59:59-05:00"), "provinces", campaign).guaranteed).toBe(true);
  });

  it("counts down to Lima until an address is known, then switches", () => {
    const now = new Date("2026-12-10T12:00:00-05:00");
    expect(countdownTarget(now, null, campaign).toISOString()).toBe(new Date(campaign.cutoffs.lima).toISOString());
    expect(countdownTarget(now, "provinces", campaign).toISOString()).toBe(new Date(campaign.cutoffs.provinces).toISOString());
    const home = guaranteeFor(now, null, campaign);
    expect(home.guaranteed).toBe(true);
    expect(home.detail).toMatch(/Lima/);
    expect(home.detail).toMatch(/provincias/);
  });

  it("closes the homepage guarantee after both cutoffs", () => {
    const late = guaranteeFor(new Date("2026-12-20T12:00:00-05:00"), null, campaign);
    expect(late.guaranteed).toBe(false);
    expect(late.detail).toContain("San Valentín");
  });

  it("treats Lima metro and Callao as Lima, and the rest as provinces", () => {
    expect(shippingZone("Lima", "Miraflores")).toBe("lima");
    expect(shippingZone("Lima", "Surco")).toBe("lima");
    expect(shippingZone("Callao", "Ventanilla")).toBe("lima");
    expect(shippingZone("Lima", "Huacho")).toBe("provinces");
    expect(shippingZone("Cusco", "Cusco")).toBe("provinces");
    expect(shippingZone("Áncash", "Huaraz")).toBe("provinces");
  });
});
