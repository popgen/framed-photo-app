import { describe, expect, it } from "vitest";
import { addBusinessDays, estimateDelivery } from "../src/lib/delivery";

describe("delivery dates", () => {
  it("skips weekends and Christmas when counting business days", () => {
    const friday = new Date("2026-12-18T18:00:00-05:00");
    expect(addBusinessDays(friday, 2)).toBe("2026-12-22");
    expect(addBusinessDays(friday, 3)).toBe("2026-12-23");
    const wednesday = new Date("2026-12-23T10:00:00-05:00");
    expect(addBusinessDays(wednesday, 2)).toBe("2026-12-28");
    expect(estimateDelivery(friday, "lima").speed).toBe("2 a 3 días hábiles");
    expect(estimateDelivery(friday, "provinces").min).toBe("2026-12-23");
    expect(estimateDelivery(friday, "provinces").max).toBe("2026-12-28");
  });
});
