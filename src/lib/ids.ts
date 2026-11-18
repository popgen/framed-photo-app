export function uid(prefix = ""): string {
  const cryptoObj = globalThis.crypto;
  const raw = cryptoObj?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const compact = raw.replace(/-/g, "");
  return prefix ? `${prefix}${compact.slice(0, 12)}` : raw;
}

export function referralCodeFrom(name: string): string {
  const base =
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z]/g, "")
      .slice(0, 4)
      .toUpperCase() || "AMIGO";
  const n = Math.floor(1000 + Math.random() * 9000);
  return `${base}${n}`;
}

export function giftCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let body = "";
  for (let i = 0; i < 8; i += 1) body += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `REGALO-${body}`;
}
