export type TaxIdType = "DNI" | "RUC";

export type ParsedTaxId =
  | { ok: true; taxId: string; taxIdType: TaxIdType }
  | { ok: false; error: string };

const RUC_FACTORS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

export function normalizeTaxId(value: string): string {
  return value.replace(/[\s-]/g, "");
}

export function rucCheckDigit(first10: string): number {
  const sum = first10.split("").reduce((total, digit, index) => total + Number(digit) * RUC_FACTORS[index], 0);
  const check = 11 - (sum % 11);
  if (check === 10) return 0;
  if (check === 11) return 1;
  return check;
}

export function isTaxSkip(value: string): boolean {
  const text = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  return text === "no tengo" || text.startsWith("no tengo ");
}

export function resolveTaxId(input: { taxId?: string | null; skipped?: boolean }):
  | { ok: true; skipped: true; taxId: null; taxIdType: null }
  | { ok: true; skipped: false; taxId: string; taxIdType: TaxIdType }
  | { ok: false; error: string } {
  if (input.skipped) return { ok: true, skipped: true, taxId: null, taxIdType: null };
  const parsed = parseTaxId(input.taxId ?? "");
  if (!parsed.ok) return parsed;
  return { ok: true, skipped: false, taxId: parsed.taxId, taxIdType: parsed.taxIdType };
}

export function parseTaxId(value: string): ParsedTaxId {
  const taxId = normalizeTaxId(value);
  if (!taxId) return { ok: false, error: "Escribe tu DNI o RUC." };
  if (!/^\d+$/.test(taxId)) return { ok: false, error: "Usa solo números. El DNI tiene 8 dígitos y el RUC 11." };
  if (taxId.length === 8) return { ok: true, taxId, taxIdType: "DNI" };
  if (taxId.length !== 11) return { ok: false, error: "El DNI tiene 8 dígitos y el RUC tiene 11." };
  if (!/^(10|15|17|20)/.test(taxId)) return { ok: false, error: "El RUC debe empezar con 10, 15, 17 o 20." };
  const expected = rucCheckDigit(taxId.slice(0, 10));
  if (Number(taxId[10]) !== expected) return { ok: false, error: "Ese RUC no coincide con el dígito de verificación." };
  return { ok: true, taxId, taxIdType: "RUC" };
}
