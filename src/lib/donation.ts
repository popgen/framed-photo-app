import { formatSoles } from "./money";

/** Only amount the checkout may add. Anything else is rejected server-side. */
export const DONATION_CENTS = 500;

export const DONATION_CAUSE = "Comunidades de la Selva";

export const DONATION_LABEL = `Donación para ${DONATION_CAUSE}`;

export const DONATION_MP_TITLE = `Donación ${DONATION_CAUSE}`;

export function donationCheckboxLabel(): string {
  return `Agregar ${formatSoles(DONATION_CENTS)} de donación para ${DONATION_CAUSE}`;
}

export const DONATION_CHECKBOX_HINT = "Es opcional y se suma al total.";

/** Props a screen reader needs. Web does not map accessibilityState.checked to aria-checked. */
export function donationCheckboxA11y(checked: boolean) {
  return {
    accessibilityRole: "checkbox" as const,
    accessibilityLabel: donationCheckboxLabel(),
    accessibilityHint: DONATION_CHECKBOX_HINT,
    accessibilityState: { checked },
    "aria-checked": checked,
  };
}

/** Space toggles a checkbox. Enter is left to buttons. */
export function donationToggleKey(key: string): boolean {
  return key === " " || key === "Spacebar";
}

export function donationSummaryText(): string {
  return `${DONATION_LABEL} — ${formatSoles(DONATION_CENTS)}`;
}

/** Accept only 0 or 500 céntimos. A missing value is 0. Any other amount is refused. */
export function acceptedDonationCents(value: unknown): 0 | typeof DONATION_CENTS | null {
  if (value == null || value === false || value === 0 || value === "0") return 0;
  if (value === true || value === DONATION_CENTS || value === "500") return DONATION_CENTS;
  const numeric = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (numeric === 0) return 0;
  if (numeric === DONATION_CENTS) return DONATION_CENTS;
  return null;
}
