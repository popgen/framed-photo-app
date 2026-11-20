import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CHECKOUT_SECTIONS,
  acknowledgeSection,
  afterContinue,
  afterSkip,
  checkoutFieldId,
  checkoutHeaderId,
  checkoutSummary,
  codeSummary,
  focusCheckoutField,
  focusForCheckoutError,
  initialAcknowledged,
  initialOpenSection,
  mergeCheckoutProfile,
  noteSummary,
  payBlockAfterAccount,
  sectionBadge,
  toggleCheckoutSection,
  type CheckoutSection,
  type CheckoutSectionDraft,
} from "../src/lib/checkout-sections";

function draft(extra: Partial<CheckoutSectionDraft> = {}): CheckoutSectionDraft {
  return {
    customerName: "",
    phone: "",
    email: "",
    clave: "",
    hasAccount: false,
    taxId: "",
    taxIdSkipped: false,
    department: "",
    province: "",
    district: "",
    addressLine: "",
    reference: "",
    giftPrinted: false,
    giftNoteTo: "",
    giftNoteMessage: "",
    giftNoteFrom: "",
    hidePrices: false,
    giftWrap: false,
    promoCode: "",
    referralCode: "",
    giftCardCode: "",
    ...extra,
  };
}

const readyPersonal = {
  customerName: "Lucía Pérez",
  phone: "987654321",
  email: "lucia@ejemplo.com",
  clave: "clave1234",
  taxIdSkipped: true,
};

const readyAddress = {
  department: "Lima",
  province: "Lima",
  district: "Miraflores",
  addressLine: "Av. Larco 123",
  reference: "Frente al parque",
};

describe("checkout delivery sections", () => {
  it("opens the first incomplete required section and collapses valid ones", () => {
    expect(initialOpenSection(draft())).toBe("personal");
    expect(initialAcknowledged(draft())).toEqual([]);

    const loggedIn = draft({ ...readyPersonal, hasAccount: true, clave: "" });
    expect(initialOpenSection(loggedIn)).toBe("address");
    expect(initialAcknowledged(loggedIn)).toEqual(["personal"]);
    expect(sectionBadge("personal", "address", initialAcknowledged(loggedIn), loggedIn)).toBe("Lucía Pérez · 987 654 321");

    const prefilled = draft({ ...readyPersonal, ...readyAddress, hasAccount: true, clave: "" });
    expect(initialOpenSection(prefilled)).toBeNull();
    expect(initialAcknowledged(prefilled)).toEqual(["personal", "address"]);
    expect(sectionBadge("address", null, initialAcknowledged(prefilled), prefilled)).toBe("Miraflores · Av. Larco 123");
    expect(sectionBadge("note", null, initialAcknowledged(prefilled), prefilled)).toBeNull();
  });

  it("keeps a logged-in section open when the prefilled personal data is still invalid", () => {
    const partial = draft({ hasAccount: true, email: "lucia@ejemplo.com", customerName: "Lucía Pérez" });
    expect(initialOpenSection(partial)).toBe("personal");
    expect(initialAcknowledged(partial)).toEqual([]);
  });

  it("continues only when the section is valid, then opens the next one", () => {
    const empty = draft();
    const blocked = afterContinue("personal", [], empty);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.field).toBe("customerName");

    const personal = draft(readyPersonal);
    const next = afterContinue("personal", [], personal);
    expect(next).toEqual({ ok: true, open: "address", done: ["personal"] });

    const both = draft({ ...readyPersonal, ...readyAddress });
    const note = afterContinue("address", ["personal"], both);
    expect(note).toEqual({ ok: true, open: "note", done: ["personal", "address"] });

    const skipped = afterSkip("note", ["personal", "address"], both);
    expect(skipped).toEqual({ ok: true, open: "code", done: ["personal", "address", "note"] });
    expect(sectionBadge("note", "code", skipped.ok ? skipped.done : [], both)).toBe("Sin nota");

    const done = afterContinue("code", skipped.ok ? skipped.done : [], both);
    expect(done).toEqual({ ok: true, open: null, done: ["personal", "address", "note", "code"] });
    expect(sectionBadge("code", null, done.ok ? done.done : [], both)).toBe("Sin código");
  });

  it("lets optional sections be skipped and refuses to skip a required one", () => {
    const filled = draft({ ...readyPersonal, ...readyAddress, promoCode: "NAVIDAD" });
    const skipCode = afterSkip("code", ["personal", "address", "note"], filled);
    expect(skipCode.ok).toBe(true);
    if (skipCode.ok) {
      expect(skipCode.open).toBeNull();
      expect(sectionBadge("code", null, skipCode.done, filled)).toBe("Promo NAVIDAD");
    }
    const skipPersonal = afterSkip("personal", [], draft());
    expect(skipPersonal.ok).toBe(false);
    expect(acknowledgeSection(["personal"], "personal")).toEqual(["personal"]);
  });

  it("reopens a collapsed section from its header and closes the one that is open", () => {
    let open: CheckoutSection | null = "personal";
    open = toggleCheckoutSection(open, "personal");
    expect(open).toBeNull();
    open = toggleCheckoutSection(open, "address");
    expect(open).toBe("address");
    open = toggleCheckoutSection(open, "note");
    expect(open).toBe("note");
    expect(CHECKOUT_SECTIONS.map(checkoutHeaderId)).toEqual([
      "entrega-personal",
      "entrega-address",
      "entrega-note",
      "entrega-code",
    ]);
  });

  it("summarizes the note and truncates a long preview to one line", () => {
    expect(noteSummary(draft())).toBe("Sin nota");
    expect(noteSummary(draft({ giftPrinted: true }))).toBe("Es un regalo");
    expect(noteSummary(draft({ giftWrap: true }))).toBe("Envoltorio de regalo");
    expect(noteSummary(draft({ hidePrices: true }))).toBe("Sin precios en la caja");
    const long = "Gracias por cuidar este recuerdo durante tantos años juntos";
    expect(noteSummary(draft({ giftNoteMessage: long }))).toBe(`${[...long].slice(0, 35).join("")}…`);
    expect(checkoutSummary("personal", draft(readyPersonal))).toBe("Lucía Pérez · 987 654 321");
  });

  it("blocks a gift note that cannot be printed", () => {
    const tooLong = draft({ ...readyPersonal, ...readyAddress, giftPrinted: true, giftNoteMessage: "a".repeat(251) });
    const step = afterContinue("note", ["personal", "address"], tooLong);
    expect(step.ok).toBe(false);
    if (!step.ok) expect(step.field).toBe("giftNoteMessage");
    const names = draft({
      ...readyPersonal,
      ...readyAddress,
      giftPrinted: true,
      giftNoteMessage: "Hola",
      giftNoteTo: "a".repeat(61),
    });
    const named = afterSkip("note", [], names);
    expect(named.ok).toBe(false);
    if (!named.ok) expect(named.field).toBe("giftNoteTo");
  });

  it("maps a pay error to the section and field that should open", () => {
    const empty = draft();
    expect(focusForCheckoutError("Escribe tu DNI o RUC.", empty)).toEqual({ section: "personal", field: "taxId" });
    expect(focusForCheckoutError("La contraseña necesita al menos 8 caracteres.", empty)).toEqual({ section: "personal", field: "clave" });
    expect(focusForCheckoutError("Completa la dirección y elige departamento, provincia y distrito.", draft({ department: "Lima" }))).toEqual({
      section: "address",
      field: "province",
    });
    expect(focusForCheckoutError("Ese distrito no corresponde a la provincia elegida.", empty)).toEqual({ section: "address", field: "district" });
    expect(focusForCheckoutError("Ese código no existe.", empty)).toEqual({ section: "code", field: "code" });
    expect(focusForCheckoutError("Tu carrito está vacío.", empty)).toBeNull();
    expect(focusCheckoutField("phone")).toBe(false);
    expect(checkoutFieldId("clave")).toBe("entrega-clave");
  });

  it("checks pay errors in the same order as placing an order", () => {
    const empty = draft();
    expect(payBlockAfterAccount(empty, { lowResBlocked: false })).toMatchObject({ kind: "field", field: "email" });
    expect(
      payBlockAfterAccount(draft({ email: "lucia@ejemplo.com" }), { cardError: "El mensaje de la tarjeta puede tener hasta 80 caracteres.", lowResBlocked: true }),
    ).toEqual({ kind: "banner", error: "El mensaje de la tarjeta puede tener hasta 80 caracteres." });
    expect(payBlockAfterAccount(draft({ email: "lucia@ejemplo.com" }), { lowResBlocked: true })).toMatchObject({ kind: "banner" });
    expect(payBlockAfterAccount(draft({ ...readyPersonal, email: "lucia@ejemplo.com" }), { lowResBlocked: false })).toMatchObject({
      kind: "field",
      field: "department",
    });
    const coded = draft({
      ...readyPersonal,
      ...readyAddress,
      promoError: "Ese código ya venció.",
    });
    expect(payBlockAfterAccount(coded, { lowResBlocked: false })).toEqual({ kind: "field", field: "code", error: "Ese código ya venció." });
    expect(codeSummary(draft({ giftCardCode: "REGALO-1" }))).toBe("Regalo REGALO-1");
  });

  it("fills empty account fields and keeps what the customer already typed", () => {
    const current = draft({ customerName: "Ana", phone: "", email: "", addressLine: "", district: "", province: "", department: "", city: "", reference: "" });
    const merged = mergeCheckoutProfile(
      current,
      { email: "ana@ejemplo.com" },
      {
        name: "Ana Quispe",
        phone: "987654321",
        email: "perfil@ejemplo.com",
        addresses: [{ id: "addr", addressLine: "Calle 1", district: "Miraflores", province: "Lima", department: "Lima", city: "Lima", reference: "Portería" }],
      },
    );
    expect(merged.customerName).toBe("Ana");
    expect(merged.phone).toBe("987654321");
    expect(merged.email).toBe("ana@ejemplo.com");
    expect(merged.district).toBe("Miraflores");
    expect(merged.reference).toBe("Portería");
    expect(mergeCheckoutProfile(current, null, null)).toBe(current);
  });
});

describe("checkout screen wiring", () => {
  const checkout = readFileSync("src/app/checkout.tsx", "utf8");
  const collapsible = readFileSync("src/components/Collapsible.tsx", "utf8");

  it("uses the editor accordion for the four delivery sections", () => {
    expect(checkout).toContain('title="Datos personales"');
    expect(checkout).toContain('title="Dirección"');
    expect(checkout).toContain('title="Nota (opcional)"');
    expect(checkout).toContain('title="Código (opcional)"');
    expect(checkout).toContain("toggleCheckoutSection");
    expect(checkout).toContain("initialOpenSection");
    expect(checkout).toContain("revealHeader");
    expect(checkout).toContain("focusCheckoutField");
    expect(checkout).toContain("focusForCheckoutError");
    expect(checkout).toContain('label="Continuar"');
    expect(checkout).toContain('label="Omitir nota"');
    expect(checkout).toContain('label="Omitir código"');
    expect(checkout).toContain("<Collapsible");
    for (const section of CHECKOUT_SECTIONS) {
      expect(checkout).toContain(`checkoutHeaderId("${section}")`);
    }
    expect(collapsible).toContain("aria-expanded={open}");
    expect(collapsible).toContain("accessibilityState={{ expanded: open }}");
    expect(collapsible).toContain('accessibilityRole="button"');
  });

  it("leaves payment choices and the pay flow in place", () => {
    expect(checkout).toContain("checkoutPayOptions(mercadoPago)");
    expect(checkout).not.toContain('label: "Yape"');
    expect(checkout).not.toContain('label: "Plin"');
    expect(checkout).toContain("placeCheckoutOrder");
    const codeCard = checkout.indexOf('title="Código (opcional)"');
    expect(codeCard).toBeGreaterThan(checkout.indexOf('title="Nota (opcional)"'));
    expect(checkout.indexOf("donationCheckboxLabel()")).toBeGreaterThan(codeCard);
    expect(checkout.indexOf("checkoutPayOptions(mercadoPago)")).toBeGreaterThan(checkout.indexOf("donationCheckboxLabel()"));
    expect(checkout).toContain("updatePendingOrder");
    expect(checkout).toContain("placeOrder");
    expect(checkout).toContain("readWaOrder");
    expect(checkout).toContain("quoteCheckout");
    expect(checkout).toContain('label={busy ? "Procesando…" : "Pagar"}');
    expect(checkout).toContain("Crea una contraseña para seguir tu pedido");
  });
});
