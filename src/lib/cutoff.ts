import type { Campaign } from "./campaign";

export type Zone = "lima" | "provinces";

export type Guarantee = {
  zone: Zone | null;
  guaranteed: boolean;
  cutoff: Date;
  expired: boolean;
  headline: string;
  detail: string;
};

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

export function limaParts(date: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const bag: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== "literal") bag[part.type] = part.value;
  }
  let hour = Number(bag.hour);
  if (hour === 24) hour = 0;
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour,
    minute: Number(bag.minute),
    second: Number(bag.second),
  };
}

export function formatLimaDate(date: Date, withTime = false): string {
  const parts = limaParts(date);
  const base = `${parts.day} de ${MONTHS[parts.month - 1]}`;
  if (!withTime) return base;
  return `${base}, ${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

export function cutoffInstant(campaign: Campaign, zone: Zone): Date {
  return new Date(campaign.cutoffs[zone]);
}

export function countdownTarget(now: Date, zone: Zone | null, campaign: Campaign): Date {
  void now;
  return cutoffInstant(campaign, zone ?? "lima");
}

export function remainingParts(now: Date, target: Date): {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
} {
  const ms = target.getTime() - now.getTime();
  if (ms <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  const total = Math.floor(ms / 1000);
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
    expired: false,
  };
}

export function guaranteeFor(now: Date, zone: Zone | null, campaign: Campaign): Guarantee {
  const next = campaign.nextOccasion;
  if (!zone) {
    const limaCutoff = cutoffInstant(campaign, "lima");
    const provCutoff = cutoffInstant(campaign, "provinces");
    const limaOk = now.getTime() <= limaCutoff.getTime();
    const provOk = now.getTime() <= provCutoff.getTime();
    if (!limaOk && !provOk) {
      return {
        zone: null,
        guaranteed: false,
        cutoff: limaCutoff,
        expired: true,
        headline: `La garantía de ${campaign.occasionName} ya cerró`,
        detail: `Los pedidos pueden llegar después. La siguiente fecha para regalar es ${next.name}, el ${next.dateLabel}.`,
      };
    }
    return {
      zone: null,
      guaranteed: true,
      cutoff: limaOk ? limaCutoff : provCutoff,
      expired: false,
      headline: `Llega para ${campaign.occasionName}`,
      detail: provOk
        ? `Pide hasta el ${formatLimaDate(limaCutoff, true)} en Lima y hasta el ${formatLimaDate(provCutoff, true)} si va a provincias.`
        : `Lima sigue a tiempo hasta el ${formatLimaDate(limaCutoff, true)}. Para provincias la fecha ya pasó y puede llegar después de ${campaign.occasionName}. ${next.name} es el ${next.dateLabel}.`,
    };
  }

  const cutoff = cutoffInstant(campaign, zone);
  const guaranteed = now.getTime() <= cutoff.getTime();
  const where = zone === "lima" ? "Lima" : "provincias";
  if (guaranteed) {
    return {
      zone,
      guaranteed: true,
      cutoff,
      expired: false,
      headline: `Llega para ${campaign.occasionName}`,
      detail: `Este pedido va a ${where} y entra en la fecha. El límite es el ${formatLimaDate(cutoff, true)}, hora de Lima.`,
    };
  }
  return {
    zone,
    guaranteed: false,
    cutoff,
    expired: true,
    headline: `Puede llegar después de ${campaign.occasionName}`,
    detail: `La fecha límite para ${where} fue el ${formatLimaDate(cutoff, true)}. Ya no hay garantía de llegar para ${campaign.occasionName}. Si buscas una fecha segura, ${next.name} es el ${next.dateLabel}.`,
  };
}

export function urgencyRank(cutoffMs: number, closed: boolean): number {
  return (closed ? 1 : 0) * 1e15 + cutoffMs;
}
