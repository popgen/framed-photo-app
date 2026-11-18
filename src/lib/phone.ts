export function normalizePhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("51") && digits.length === 11) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 10) digits = digits.slice(1);
  if (!/^9\d{8}$/.test(digits)) return null;
  return `51${digits}`;
}

export function formatPhone(stored: string): string {
  const local = stored.startsWith("51") ? stored.slice(2) : stored;
  return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}

export function phonesMatch(a: string, b: string): boolean {
  const left = normalizePhone(a);
  const right = normalizePhone(b);
  return Boolean(left && left === right);
}
