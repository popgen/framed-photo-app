import { passwordError } from "./customer-auth";
import { appliedDiscountChips } from "./discount-code";
import { GIFT_NOTE_NAME_MAX, giftNoteFromCheckout } from "./gift-note";
import { formatPhone, isEmail, normalizePhone } from "./phone";
import { resolveTaxId } from "./tax-id";
import type { CustomerProfile } from "./types";
import { toggleAccordion } from "./editor-sections";
import { districtsFor } from "./zone";

export const CHECKOUT_SECTIONS = ["personal", "address", "note", "code"] as const;

export type CheckoutSection = (typeof CHECKOUT_SECTIONS)[number];

export const CHECKOUT_FIELDS = [
  "customerName",
  "phone",
  "email",
  "clave",
  "taxId",
  "department",
  "province",
  "district",
  "addressLine",
  "giftNoteTo",
  "giftNoteMessage",
  "giftNoteFrom",
  "code",
] as const;

export type CheckoutField = (typeof CHECKOUT_FIELDS)[number];

export type CheckoutSectionDraft = {
  customerName: string;
  phone: string;
  email: string;
  clave: string;
  hasAccount: boolean;
  taxId: string;
  taxIdSkipped: boolean;
  department: string;
  province: string;
  district: string;
  addressLine: string;
  reference: string;
  giftPrinted: boolean;
  giftNoteTo: string;
  giftNoteMessage: string;
  giftNoteFrom: string;
  hidePrices: boolean;
  giftWrap: boolean;
  promoCode: string;
  referralCode: string;
  giftCardCode: string;
  promoError?: string | null;
  referralError?: string | null;
  giftCardError?: string | null;
};

export type SectionIssue = { field: CheckoutField; error: string };

const OPTIONAL = new Set<CheckoutSection>(["note", "code"]);

const ADDRESS_GAP = "Completa la dirección y elige departamento, provincia y distrito.";
const DISTRICT_MISMATCH = "Ese distrito no corresponde a la provincia elegida.";
const LOW_RES = "Confirma que aceptas la resolución baja, o elige una foto más grande.";

const TAX_ERRORS = new Set([
  "Escribe tu DNI o RUC.",
  "Usa solo números. El DNI tiene 8 dígitos y el RUC 11.",
  "El DNI tiene 8 dígitos y el RUC tiene 11.",
  "El RUC debe empezar con 10, 15, 17 o 20.",
  "Ese RUC no coincide con el dígito de verificación.",
]);

const NOTE_MESSAGE = "La nota impresa admite hasta 250 caracteres.";
const NOTE_NAMES = "Para y De admiten hasta 60 caracteres.";

const CODE_ERRORS = new Set([
  "Ese código no existe.",
  "Ese código ya no está activo.",
  "Ese código ya venció.",
  "Ese código ya se agotó.",
  "Ese código de amigo no existe.",
  "No puedes usar tu propio código.",
  "Esa tarjeta de regalo no tiene saldo.",
  "Ese código no es válido.",
]);

const PERSONAL_ERRORS: Record<string, CheckoutField> = {
  "Escribe el nombre de quien recibe el pedido.": "customerName",
  "Ingresa un celular peruano de 9 dígitos.": "phone",
  "Revisa el celular.": "phone",
  "Ingresa un correo válido.": "email",
  "La contraseña necesita al menos 8 caracteres.": "clave",
};

export function checkoutHeaderId(section: CheckoutSection): string {
  return `entrega-${section}`;
}

export function checkoutFieldId(field: CheckoutField): string {
  return `entrega-${field}`;
}

export function toggleCheckoutSection(current: CheckoutSection | null, target: CheckoutSection): CheckoutSection | null {
  return toggleAccordion(current, target);
}

export function nextCheckoutSection(section: CheckoutSection): CheckoutSection | null {
  const index = CHECKOUT_SECTIONS.indexOf(section);
  return CHECKOUT_SECTIONS[index + 1] ?? null;
}

export function isOptionalCheckoutSection(section: CheckoutSection): boolean {
  return OPTIONAL.has(section);
}

export function sectionForField(field: CheckoutField): CheckoutSection {
  if (field === "department" || field === "province" || field === "district" || field === "addressLine") return "address";
  if (field === "giftNoteTo" || field === "giftNoteMessage" || field === "giftNoteFrom") return "note";
  if (field === "code") return "code";
  return "personal";
}

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function oneLineSummary(value: string, max = 36): string {
  const text = clean(value);
  const chars = [...text];
  if (chars.length <= max) return text;
  return `${chars.slice(0, max - 1).join("").trimEnd()}…`;
}

export function personalIssue(draft: CheckoutSectionDraft): SectionIssue | null {
  if (clean(draft.customerName).length < 2) {
    return { field: "customerName", error: "Escribe el nombre de quien recibe el pedido." };
  }
  if (!normalizePhone(draft.phone)) {
    return { field: "phone", error: "Ingresa un celular peruano de 9 dígitos." };
  }
  if (!isEmail(draft.email ?? "")) {
    return { field: "email", error: "Ingresa un correo válido." };
  }
  if (!draft.hasAccount) {
    const problem = passwordError(draft.clave);
    if (problem) return { field: "clave", error: problem };
  }
  const tax = resolveTaxId({ taxId: draft.taxId, skipped: draft.taxIdSkipped });
  if (!tax.ok) return { field: "taxId", error: tax.error };
  return null;
}

export function addressIssue(draft: CheckoutSectionDraft): SectionIssue | null {
  if (!draft.department.trim()) return { field: "department", error: ADDRESS_GAP };
  if (!draft.province.trim()) return { field: "province", error: ADDRESS_GAP };
  if (!draft.district.trim()) return { field: "district", error: ADDRESS_GAP };
  if (!clean(draft.addressLine)) return { field: "addressLine", error: ADDRESS_GAP };
  const known = districtsFor(draft.department, draft.province);
  if (!known.some((item) => item.toLowerCase() === draft.district.trim().toLowerCase())) {
    return { field: "district", error: DISTRICT_MISMATCH };
  }
  return null;
}

export function noteIssue(draft: CheckoutSectionDraft): SectionIssue | null {
  const note = giftNoteFromCheckout({
    isGift: draft.giftPrinted,
    giftPrinted: draft.giftPrinted,
    giftNote: draft.giftNoteMessage,
    giftNoteTo: draft.giftNoteTo,
    giftNoteMessage: draft.giftNoteMessage,
    giftNoteFrom: draft.giftNoteFrom,
    hidePrices: draft.hidePrices || draft.giftWrap,
    customerName: draft.customerName,
  });
  if (note.ok) return null;
  if (note.error === NOTE_NAMES) return { field: noteNameField(draft), error: note.error };
  return { field: "giftNoteMessage", error: note.error };
}

function noteNameField(draft: CheckoutSectionDraft): CheckoutField {
  if (clean(draft.giftNoteTo).length > GIFT_NOTE_NAME_MAX) return "giftNoteTo";
  if (clean(draft.giftNoteFrom).length > GIFT_NOTE_NAME_MAX) return "giftNoteFrom";
  return "giftNoteTo";
}

export function codeIssue(draft: CheckoutSectionDraft): SectionIssue | null {
  if (draft.promoError) return { field: "code", error: draft.promoError };
  if (draft.referralError) return { field: "code", error: draft.referralError };
  if (draft.giftCardError) return { field: "code", error: draft.giftCardError };
  return null;
}

export function sectionIssue(section: CheckoutSection, draft: CheckoutSectionDraft): SectionIssue | null {
  if (section === "personal") return personalIssue(draft);
  if (section === "address") return addressIssue(draft);
  if (section === "note") return noteIssue(draft);
  return codeIssue(draft);
}

export function initialOpenSection(draft: CheckoutSectionDraft): CheckoutSection | null {
  if (personalIssue(draft)) return "personal";
  if (addressIssue(draft)) return "address";
  return null;
}

/**
 * Required sections that start collapsed with a summary: every valid one except the open one.
 * A restored Mercado Pago draft with a complete address keeps Dirección collapsed even when
 * Datos personales still needs the password.
 */
export function initialAcknowledged(draft: CheckoutSectionDraft): CheckoutSection[] {
  const open = initialOpenSection(draft);
  const required: CheckoutSection[] = ["personal", "address"];
  return required.filter((section) => section !== open && !sectionIssue(section, draft));
}

export function continueCheckoutSection(
  section: CheckoutSection,
  draft: CheckoutSectionDraft,
): { ok: true; next: CheckoutSection | null } | { ok: false; field: CheckoutField; error: string } {
  const issue = sectionIssue(section, draft);
  if (issue) return { ok: false, field: issue.field, error: issue.error };
  return { ok: true, next: nextCheckoutSection(section) };
}

export function skipCheckoutSection(
  section: CheckoutSection,
  draft: CheckoutSectionDraft,
): { ok: true; next: CheckoutSection | null } | { ok: false; field: CheckoutField; error: string } {
  if (!isOptionalCheckoutSection(section)) {
    const issue = sectionIssue(section, draft);
    if (issue) return { ok: false, field: issue.field, error: issue.error };
    return { ok: false, field: section === "personal" ? "customerName" : "department", error: "Esta parte es obligatoria." };
  }
  const issue = sectionIssue(section, draft);
  if (issue) return { ok: false, field: issue.field, error: issue.error };
  return { ok: true, next: nextCheckoutSection(section) };
}

export function acknowledgeSection(done: readonly CheckoutSection[], section: CheckoutSection): CheckoutSection[] {
  return done.includes(section) ? [...done] : [...done, section];
}

export function afterContinue(section: CheckoutSection, done: readonly CheckoutSection[], draft: CheckoutSectionDraft) {
  const step = continueCheckoutSection(section, draft);
  if (!step.ok) return step;
  return { ok: true as const, open: step.next, done: acknowledgeSection(done, section) };
}

export function afterSkip(section: CheckoutSection, done: readonly CheckoutSection[], draft: CheckoutSectionDraft) {
  const step = skipCheckoutSection(section, draft);
  if (!step.ok) return step;
  return { ok: true as const, open: step.next, done: acknowledgeSection(done, section) };
}

export function checkoutSummary(section: CheckoutSection, draft: CheckoutSectionDraft): string {
  if (section === "personal") {
    const phone = normalizePhone(draft.phone);
    const shown = phone ? formatPhone(phone) : clean(draft.phone);
    return oneLineSummary(`${clean(draft.customerName)} · ${shown}`);
  }
  if (section === "address") return oneLineSummary(`${clean(draft.district)} · ${clean(draft.addressLine)}`);
  if (section === "note") return noteSummary(draft);
  return codeSummary(draft);
}

export function noteSummary(draft: CheckoutSectionDraft): string {
  const message = clean(draft.giftNoteMessage);
  if (message) return oneLineSummary(message);
  if (draft.giftWrap) return "Envoltorio de regalo";
  if (draft.giftPrinted) return "Es un regalo";
  if (draft.hidePrices) return "Sin precios en la caja";
  return "Sin nota";
}

export function codeSummary(draft: CheckoutSectionDraft): string {
  const chips = appliedDiscountChips({
    promoCode: draft.promoCode,
    referralCode: draft.referralCode,
    giftCardCode: draft.giftCardCode,
  });
  if (!chips.length) return "Sin código";
  return oneLineSummary(chips.map((chip) => chip.label).join(" · "));
}

export function sectionBadge(
  section: CheckoutSection,
  open: CheckoutSection | null,
  done: readonly CheckoutSection[],
  draft: CheckoutSectionDraft,
): string | null {
  if (open === section || !done.includes(section)) return null;
  if (sectionIssue(section, draft)) return null;
  return checkoutSummary(section, draft);
}

export type PayBlock = { kind: "field"; field: CheckoutField; error: string } | { kind: "banner"; error: string };

/** Field checks that run on Pagar after the example photo, tax id, and password gates. */
export function payBlockAfterAccount(
  draft: CheckoutSectionDraft,
  extras: { cardError?: string | null; lowResBlocked: boolean },
): PayBlock | null {
  if (!isEmail(draft.email ?? "")) return { kind: "field", field: "email", error: "Ingresa un correo válido." };
  if (extras.cardError) return { kind: "banner", error: extras.cardError };
  if (extras.lowResBlocked) return { kind: "banner", error: LOW_RES };
  const personal = personalIssue(draft);
  if (personal) return { kind: "field", field: personal.field, error: personal.error };
  const address = addressIssue(draft);
  if (address) return { kind: "field", field: address.field, error: address.error };
  const note = noteIssue(draft);
  if (note) return { kind: "field", field: note.field, error: note.error };
  const code = codeIssue(draft);
  if (code) return { kind: "field", field: code.field, error: code.error };
  return null;
}

export function focusForCheckoutError(message: string, draft: CheckoutSectionDraft): { section: CheckoutSection; field: CheckoutField } | null {
  const personal = PERSONAL_ERRORS[message];
  if (personal) return { section: "personal", field: personal };
  if (TAX_ERRORS.has(message)) return { section: "personal", field: "taxId" };
  if (message === DISTRICT_MISMATCH) return { section: "address", field: "district" };
  if (message === ADDRESS_GAP) {
    const issue = addressIssue(draft);
    return { section: "address", field: issue?.field ?? "department" };
  }
  if (message === NOTE_NAMES) return { section: "note", field: noteNameField(draft) };
  if (message === NOTE_MESSAGE) return { section: "note", field: "giftNoteMessage" };
  if (CODE_ERRORS.has(message)) return { section: "code", field: "code" };
  return null;
}

export function focusCheckoutField(field: CheckoutField): boolean {
  if (typeof document === "undefined") return false;
  const node = document.getElementById(checkoutFieldId(field));
  const target = node ? focusable(node) : null;
  if (!target) return false;
  try {
    target.focus();
  } catch {
    return false;
  }
  return document.activeElement === target || target.contains(document.activeElement);
}

function focusable(node: HTMLElement): HTMLElement | null {
  if (node.matches("input, textarea, button, select, [role='button']")) return node;
  const inner = node.querySelector<HTMLElement>("input, textarea, button, select, [role='button']");
  if (inner) return inner;
  return node.tabIndex >= 0 ? node : null;
}

export function mergeCheckoutProfile<T extends {
  customerName: string;
  phone: string;
  email: string;
  addressLine: string;
  district: string;
  province: string;
  department: string;
  city: string;
  reference: string;
}>(current: T, session: { email: string } | null, profile: CustomerProfile | null): T {
  if (!session && !profile) return current;
  const address = profile?.addresses?.[0];
  const pick = (value: string, ...fallbacks: Array<string | null | undefined>) => {
    if (value.trim()) return value;
    for (const fallback of fallbacks) {
      if (fallback && fallback.trim()) return fallback;
    }
    return "";
  };
  return {
    ...current,
    customerName: pick(current.customerName, profile?.name),
    phone: pick(current.phone, profile?.phone),
    email: pick(current.email, session?.email, profile?.email),
    addressLine: pick(current.addressLine, address?.addressLine),
    district: pick(current.district, address?.district),
    province: pick(current.province, address?.province),
    department: pick(current.department, address?.department),
    city: pick(current.city, address?.city, address?.district),
    reference: pick(current.reference, address?.reference ?? ""),
  };
}
