import { describe, expect, it } from "vitest";
import { normalizeTaxId, parseTaxId, rucCheckDigit } from "../src/lib/tax-id";

function ruc(prefix: string, body: string): string {
  const first10 = `${prefix}${body}`.padEnd(10, "0").slice(0, 10);
  return `${first10}${rucCheckDigit(first10)}`;
}

describe("DNI and RUC", () => {
  it("strips spaces and dashes and accepts an 8-digit DNI", () => {
    expect(normalizeTaxId("87 654-321")).toBe("87654321");
    expect(parseTaxId("87 654-321")).toEqual({ ok: true, taxId: "87654321", taxIdType: "DNI" });
  });

  it("accepts a RUC with a valid check digit and the allowed prefixes", () => {
    for (const prefix of ["10", "15", "17", "20"]) {
      const taxId = ruc(prefix, "12345678");
      expect(parseTaxId(taxId)).toEqual({ ok: true, taxId, taxIdType: "RUC" });
    }
  });

  it("rejects a missing value, the wrong length, a bad prefix, and a bad check digit", () => {
    expect(parseTaxId("   ").ok).toBe(false);
    expect(parseTaxId("123").error).toMatch(/8 dígitos/);
    expect(parseTaxId("12345678901").error).toMatch(/empezar con 10/);
    const almost = ruc("20", "12345678");
    const broken = `${almost.slice(0, 10)}${(Number(almost[10]) + 1) % 10}`;
    expect(parseTaxId(broken).error).toMatch(/dígito de verificación/);
  });
});
