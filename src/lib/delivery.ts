import { limaParts, type Zone } from "./cutoff";

export const deliveryConfig = {
  lima: { minBusinessDays: 2, maxBusinessDays: 3 },
  provinces: { minBusinessDays: 3, maxBusinessDays: 5 },
  holidays: ["2026-12-08", "2026-12-25", "2027-01-01"],
};

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export function limaKey(date: Date): string {
  const parts = limaParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function weekdayIndex(key: string): number {
  const date = new Date(`${key}T12:00:00-05:00`);
  const label = new Intl.DateTimeFormat("en-US", { timeZone: "America/Lima", weekday: "short" }).format(date);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(label);
}

function nextKey(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  const cursor = new Date(Date.UTC(year, month - 1, day));
  cursor.setUTCDate(cursor.getUTCDate() + 1);
  const mm = String(cursor.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(cursor.getUTCDate()).padStart(2, "0");
  return `${cursor.getUTCFullYear()}-${mm}-${dd}`;
}

export function isBusinessDay(key: string, holidays: string[] = deliveryConfig.holidays): boolean {
  const weekday = weekdayIndex(key);
  if (weekday === 0 || weekday === 6) return false;
  return !holidays.includes(key);
}

export function addBusinessDays(start: Date, days: number, holidays: string[] = deliveryConfig.holidays): string {
  let key = limaKey(start);
  let left = days;
  while (left > 0) {
    key = nextKey(key);
    if (isBusinessDay(key, holidays)) left -= 1;
  }
  return key;
}

export function formatKey(key: string): string {
  const [, month, day] = key.split("-").map(Number);
  return `${WEEKDAYS[weekdayIndex(key)]} ${day} de ${MONTHS[month - 1]}`;
}

export function estimateDelivery(from: Date, zone: Zone, holidays: string[] = deliveryConfig.holidays) {
  const range = deliveryConfig[zone];
  const min = addBusinessDays(from, range.minBusinessDays, holidays);
  const max = addBusinessDays(from, range.maxBusinessDays, holidays);
  return {
    min,
    max,
    speed: zone === "lima" ? "2 a 3 días hábiles" : "3 a 5 días hábiles",
    label: `Entre el ${formatKey(min)} y el ${formatKey(max)}`,
  };
}
