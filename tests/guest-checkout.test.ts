import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { CONFIRM_EMAIL_NOTICE, EXISTING_ACCOUNT_NOTICE, linkAccountForPurchase } from "../src/lib/checkout-account";
import { provisionCheckoutAccount, signInCustomer, signOutCustomer, signUpCustomer } from "../src/lib/customer-auth";
import { createLocalRepo } from "../src/lib/repo-local";
import type { CheckoutInput } from "../src/lib/types";

const memory = new Map<string, string>();

vi.stubGlobal("localStorage", {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => memory.set(key, value),
  removeItem: (key: string) => memory.delete(key),
});

function draft(extra: Partial<CheckoutInput> = {}): CheckoutInput {
  return {
    items: [{
      frameId: "thin-black-15",
      photoId: "p",
      crop: { imageWidth: 2000, imageHeight: 2000, x: 0, y: 0, width: 1500, height: 2000 },
      orientation: "portrait",
      dpi: 300,
      resolutionStatus: "good",
    }],
    customerName: "Lucía Pérez",
    phone: "987654321",
    email: "lucia@ejemplo.com",
    password: "clave1234",
    taxIdSkipped: true,
    giftWrap: false,
    addressLine: "Calle 1",
    district: "Miraflores",
    city: "Lima",
    department: "Lima",
    province: "Lima",
    useCredit: false,
    paymentMethod: "yape",
    ackLowRes: false,
    ...extra,
  };
}

describe("guest checkout", () => {
  it("shows the purchase form without an account gate", () => {
    const checkout = readFileSync("src/app/checkout.tsx", "utf8");
    const confirmation = readFileSync("src/app/confirmacion/[token].tsx", "utf8");
    expect(checkout).not.toContain("AccountAuth");
    expect(checkout).toContain("Crea una contraseña para seguir tu pedido");
    expect(confirmation).toContain("entrar más tarde");
  });

  it("creates the account and links the order, then login shows it", async () => {
    const repo = createLocalRepo();
    await repo.init();
    const email = "nueva@ejemplo.com";
    const order = await repo.placeOrder(draft({ email, password: "clave1234" }));
    expect(order.userId).toBeTruthy();
    expect(order.email).toBe(email);
    await signOutCustomer();
    const signed = await signInCustomer(email, "clave1234");
    expect(signed.ok).toBe(true);
    const mine = await repo.listMyOrders();
    expect(mine.map((item) => item.number)).toContain(order.number);
  });

  it("keeps the purchase when the email already has an account", async () => {
    const repo = createLocalRepo();
    await repo.init();
    const email = "vieja@ejemplo.com";
    await signUpCustomer(email, "correcta1");
    await signOutCustomer();
    const wrong = await repo.placeOrder(draft({ email, password: "otra-clave" }));
    expect(wrong.userId).toBeTruthy();
    expect(wrong.accountNotice).toBe(EXISTING_ACCOUNT_NOTICE);
    await signOutCustomer();
    const signed = await signInCustomer(email, "correcta1");
    expect(signed.ok).toBe(true);
    const mine = await repo.listMyOrders();
    expect(mine.map((item) => item.number)).toContain(wrong.number);
  });

  it("still links the order when email confirmation is pending", async () => {
    const linked = await linkAccountForPurchase(
      { email: "pendiente@ejemplo.com", password: "clave1234" },
      {
        async createUser() {
          return { status: "created", userId: "user-pendiente", confirmed: false };
        },
        async signIn() {
          return { status: "unconfirmed", userId: "user-pendiente" };
        },
        async findUserId() {
          return "user-pendiente";
        },
      },
    );
    expect(linked.proceed).toBe(true);
    if (linked.proceed) {
      expect(linked.userId).toBe("user-pendiente");
      expect(linked.notice).toBe(CONFIRM_EMAIL_NOTICE);
    }
  });

  it("rejects a short password before creating an order", async () => {
    const repo = createLocalRepo();
    await repo.init();
    await signOutCustomer();
    await expect(repo.placeOrder(draft({ email: "corta@ejemplo.com", password: "corta" }))).rejects.toThrow(/8/);
    expect(await provisionCheckoutAccount("corta@ejemplo.com", "corta")).toMatchObject({ proceed: false });
  });
});
