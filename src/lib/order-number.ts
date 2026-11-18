const LIMA = "America/Lima";

export function limaYear(when = new Date()): number {
  const year = new Intl.DateTimeFormat("en-US", { timeZone: LIMA, year: "numeric" }).format(when);
  return Number(year);
}

export function formatOrderNumber(sequence: number, when = new Date()): string {
  const yy = String(limaYear(when)).slice(-2);
  const n = Math.max(0, Math.floor(sequence));
  return `MF-${yy}-${String(n).padStart(4, "0")}`;
}

export function maskStreet(addressLine: string, district: string, department: string): string {
  const place = [district, department].filter(Boolean).join(", ");
  if (!addressLine.trim()) return place || "Dirección registrada";
  return place ? `••••, ${place}` : "••••";
}

export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return "••••";
  return `${digits.slice(0, 4)}****${digits.slice(-3)}`;
}
