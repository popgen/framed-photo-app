import { describe, expect, it, vi } from "vitest";
import { checkoutPageShowReset, placeCheckoutOrder } from "../src/lib/checkout-payment";
import type { CheckoutInput, Order } from "../src/lib/types";

const orderInput = { customerName: "Ana Flores" } as CheckoutInput;

function saved(id = "ord_1", token = "tok"): Order {
  return { id, publicToken: token, paymentStatus: "pending" } as Order;
}

function harness(status: string | null, extra: { pedidoToken?: string | null; receipt?: boolean; pending?: boolean } = {}) {
  const placeOrder = vi.fn(async () => saved("ord_new", "nuevo"));
  const updatePendingOrder = vi.fn(async (orderId: string) => saved(orderId, "wa"));
  const revisePendingOrder = vi.fn(async (orderId: string) => saved(orderId, "tok"));
  const paymentStatus = vi.fn(async () => status);
  const receipt = extra.receipt === false ? null : { id: "ord_1", publicToken: "tok" };
  const pending = extra.pending === false ? null : { orderId: "ord_1", publicToken: "tok" };
  return {
    placeOrder,
    updatePendingOrder,
    revisePendingOrder,
    paymentStatus,
    run: () => placeCheckoutOrder({
      method: "mercadopago",
      pedidoToken: extra.pedidoToken === undefined ? "tok" : extra.pedidoToken,
      cartItems: [{ id: "ci_1" }],
      orderInput,
      readReceipt: (token) => (receipt && token === receipt.publicToken ? receipt : null),
      readPending: (cartKey) => (pending && cartKey === "ci_1" ? pending : null),
      paymentStatus,
      placeOrder,
      updatePendingOrder,
      revisePendingOrder,
    }),
  };
}

describe("checkout Mercado Pago retry", () => {
  it("reuses a pending order and does not place a second one", async () => {
    const fromUrl = harness("pending");
    const reused = await fromUrl.run();
    expect(reused).toMatchObject({ id: "ord_1", publicToken: "tok" });
    expect(fromUrl.revisePendingOrder).toHaveBeenCalledTimes(1);
    expect(fromUrl.revisePendingOrder).toHaveBeenCalledWith("ord_1", orderInput);
    expect(fromUrl.updatePendingOrder).not.toHaveBeenCalled();
    expect(fromUrl.placeOrder).not.toHaveBeenCalled();

    const fromBack = harness("pending", { pedidoToken: null });
    await fromBack.run();
    expect(fromBack.revisePendingOrder).toHaveBeenCalledWith("ord_1", orderInput);
    expect(fromBack.placeOrder).not.toHaveBeenCalled();
    expect(checkoutPageShowReset({ persisted: true })).toBe(true);
    expect(checkoutPageShowReset({ persisted: false })).toBe(false);
  });

  it("places a new order when the existing one is not pending", async () => {
    for (const status of ["approved", "rejected", null]) {
      const box = harness(status);
      const created = await box.run();
      expect(created.id).toBe("ord_new");
      expect(box.revisePendingOrder).not.toHaveBeenCalled();
      expect(box.updatePendingOrder).not.toHaveBeenCalled();
      expect(box.placeOrder).toHaveBeenCalledTimes(1);
    }

    const foreign = harness("pending", { pedidoToken: "ajeno", receipt: false, pending: false });
    await foreign.run();
    expect(foreign.paymentStatus).not.toHaveBeenCalled();
    expect(foreign.revisePendingOrder).not.toHaveBeenCalled();
    expect(foreign.placeOrder).toHaveBeenCalledTimes(1);

    const stale = harness("pending");
    stale.revisePendingOrder.mockRejectedValue(Object.assign(new Error("Ese pedido ya no está pendiente."), { reuse: false }));
    const created = await stale.run();
    expect(created.id).toBe("ord_new");
    expect(stale.revisePendingOrder).toHaveBeenCalledTimes(1);
    expect(stale.placeOrder).toHaveBeenCalledTimes(1);
  });
});
