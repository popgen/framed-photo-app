import { afterEach, describe, expect, it, vi } from "vitest";

const { sendMail, state } = vi.hoisted(() => ({
  sendMail: vi.fn(),
  state: {
    userId: "admin-1" as string | null,
    admin: true,
    order: {
      id: "ord_1",
      number: "MF-26-1004",
      email: "ana@ejemplo.com" as string | null,
      public_token: "abc",
      customer_name: "Ana Quispe",
    } as { id: string; number: string; email: string | null; public_token: string; customer_name: string } | null,
    updateError: null as string | null,
    inserts: [] as unknown[],
    updates: [] as unknown[],
  },
}));

vi.mock("../src/lib/service-supabase.ts", () => ({
  serviceSupabase: () => ({
    auth: {
      getUser: async (token: string) => ({ data: { user: token === "admin-token" && state.userId ? { id: state.userId } : null } }),
    },
    from: (table: string) => {
      const api = {
        select() {
          return api;
        },
        eq() {
          return api;
        },
        update(payload: unknown) {
          state.updates.push({ table, payload });
          return api;
        },
        insert(row: unknown) {
          state.inserts.push({ table, row });
          return Promise.resolve({ error: null });
        },
        maybeSingle: async () => {
          if (table === "admin_users") {
            return state.admin ? { data: { user_id: state.userId }, error: null } : { data: null, error: null };
          }
          if (table === "orders") return { data: state.order, error: state.order ? null : { message: "missing" } };
          return { data: null, error: null };
        },
        then(resolve: (value: { error: { message: string } | null }) => void, reject: (error: unknown) => void) {
          return Promise.resolve({ error: state.updateError ? { message: state.updateError } : null }).then(resolve, reject);
        },
      };
      return api;
    },
  }),
}));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: () => ({ sendMail }),
  },
}));

const keys = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"] as const;

function jsonResponse() {
  const sent: { status?: number; body?: Record<string, unknown> } = {};
  return {
    sent,
    res: {
      status(code: number) {
        sent.status = code;
        return this;
      },
      json(data: Record<string, unknown>) {
        sent.body = data;
        return this;
      },
    },
  };
}

describe("tracking email route", () => {
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

  afterEach(() => {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
    sendMail.mockReset();
    state.userId = "admin-1";
    state.admin = true;
    state.order = { id: "ord_1", number: "MF-26-1004", email: "ana@ejemplo.com", public_token: "abc", customer_name: "Ana Quispe" };
    state.updateError = null;
    state.inserts = [];
    state.updates = [];
  });

  it("refuses a customer token and still saves the guide when SMTP is missing", async () => {
    const { default: handler } = await import("../api/tracking-email.mjs");
    const denied = jsonResponse();
    await handler({ method: "POST", headers: { authorization: "Bearer customer" }, body: { orderId: "ord_1", tracking: "OLVA-1" } }, denied.res);
    expect(denied.sent.status).toBe(401);
    expect(state.updates).toEqual([]);

    for (const key of keys) delete process.env[key];
    const saved = jsonResponse();
    await handler({ method: "POST", headers: { authorization: "Bearer admin-token" }, body: { orderId: "ord_1", tracking: "OLVA-1" } }, saved.res);
    expect(saved.sent.status).toBe(200);
    expect(saved.sent.body).toMatchObject({ ok: true, saved: true, emailed: false });
    expect(String(saved.sent.body?.warning)).toMatch(/SMTP_HOST/);
    expect(state.updates[0]).toMatchObject({ table: "orders", payload: { tracking_number: "OLVA-1", status: "shipped" } });
    expect(state.inserts).toEqual([]);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("sends the branded email and logs it, and warns when the send fails or the order has no email", async () => {
    process.env.SMTP_HOST = "smtp.zoho.com";
    process.env.SMTP_PORT = "465";
    process.env.SMTP_USER = "pedidos@mifotito.com";
    process.env.SMTP_PASS = "secret";
    process.env.SMTP_FROM = "Mi Fotito <pedidos@mifotito.com>";
    sendMail.mockResolvedValue({ messageId: "1" });
    const { default: handler } = await import("../api/tracking-email.mjs");
    const ok = jsonResponse();
    await handler({ method: "POST", headers: { authorization: "Bearer admin-token" }, body: { orderId: "ord_1", tracking: "OLVA-2" } }, ok.res);
    expect(ok.sent.body).toMatchObject({ ok: true, emailed: true, warning: null });
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      from: "Mi Fotito <pedidos@mifotito.com>",
      to: "ana@ejemplo.com",
      subject: "Tu pedido va en camino",
    }));
    expect(String(sendMail.mock.calls[0][0].text)).toContain("https://mifotito.com/pedido/abc");
    expect(state.inserts[0]).toMatchObject({ table: "notification_log", row: { channel: "email", to_address: "ana@ejemplo.com", event: "shipped" } });

    sendMail.mockRejectedValue(new Error("rechazado"));
    const failed = jsonResponse();
    await handler({ method: "POST", headers: { authorization: "Bearer admin-token" }, body: { orderId: "ord_1", tracking: "OLVA-3" } }, failed.res);
    expect(failed.sent.body).toMatchObject({ saved: true, emailed: false });
    expect(String(failed.sent.body?.warning)).toMatch(/rechazado/);

    state.order = { ...state.order!, email: null };
    const quiet = jsonResponse();
    await handler({ method: "POST", headers: { authorization: "Bearer admin-token" }, body: { orderId: "ord_1", tracking: "OLVA-4" } }, quiet.res);
    expect(String(quiet.sent.body?.warning)).toMatch(/no tiene correo/);
  });
});
