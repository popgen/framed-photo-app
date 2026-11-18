export function formatSoles(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const soles = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, "0");
  const withThousands = soles.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}S/ ${withThousands}.${frac}`;
}
