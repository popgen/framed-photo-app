import { formatPhone, normalizePhone } from "./phone";
import type { CustomerProfile, SavedAddress } from "./types";

export const ORDERS_PREVIEW = 5;

export function emptyAddress(): SavedAddress {
  return { id: "addr", addressLine: "", district: "", province: "", department: "", city: "", reference: "" };
}

export function hasAddress(address: SavedAddress | undefined | null): boolean {
  return Boolean(address && address.addressLine.trim());
}

/** The profile has what we need to show a summary instead of the form. */
export function profileIsFilled(profile: CustomerProfile | null | undefined): boolean {
  if (!profile) return false;
  return Boolean(profile.name.trim() && normalizePhone(profile.phone || ""));
}

export function addressLines(address: SavedAddress | undefined | null): string[] {
  if (!hasAddress(address)) return [];
  const a = address as SavedAddress;
  const place = [a.district, a.province, a.department].map((part) => part.trim()).filter(Boolean);
  const dedup = place.filter((part, index) => place.indexOf(part) === index);
  const lines = [a.addressLine.trim()];
  if (dedup.length) lines.push(dedup.join(", "));
  if (a.reference && a.reference.trim()) lines.push(`Referencia: ${a.reference.trim()}`);
  return lines;
}

export function phoneLabel(phone: string): string {
  const clean = normalizePhone(phone || "");
  return clean ? formatPhone(clean) : phone;
}

export function profileProblem(profile: CustomerProfile, phone: string): string | null {
  if (!profile.name.trim()) return "Escribe tu nombre.";
  if (!normalizePhone(phone)) return "Ingresa un celular peruano de 9 dígitos.";
  return null;
}

/** What gets sent to the server: no empty address rows. */
export function profileForSave(profile: CustomerProfile, phone: string): CustomerProfile {
  const first = profile.addresses[0];
  return {
    ...profile,
    name: profile.name.trim(),
    email: profile.email.trim(),
    phone,
    addresses: hasAddress(first) ? [{ ...(first as SavedAddress), addressLine: (first as SavedAddress).addressLine.trim() }] : [],
  };
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function orderDateLabel(iso: string): string {
  const date = new Date(iso);
  if (!iso || Number.isNaN(date.getTime())) return "";
  // Lima has no DST: UTC-5 all year, so the label never depends on the device's time zone.
  const lima = new Date(date.getTime() - 5 * 3_600_000);
  return `${lima.getUTCDate()} ${MONTHS[lima.getUTCMonth()]} ${lima.getUTCFullYear()}`;
}

export function newestFirst<T extends { createdAt: string }>(orders: T[]): T[] {
  return [...orders].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}
