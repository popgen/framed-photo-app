import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CONTACT_ERROR, CONTACT_RATE_LIMIT, CUENTAS_EMAIL, PEDIDOS_EMAIL, resetContactLimiter } from "../src/lib/contact";
import { retabloMessage } from "../src/lib/retablo";

const { sendMail, createTransport } = vi.hoisted(() => {
  const sendMail = vi.fn();
  const createTransport = vi.fn(() => ({ sendMail }));
  return { sendMail, createTransport };
});

vi.mock("nodemailer", () => ({
  default: { createTransport },
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

function post(body: Record<string, unknown>, ip = "203.0.113.10") {
  return {
    method: "POST",
    headers: { "x-nf-client-connection-ip": ip },
    body,
  };
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name === "node_modules" || name === "dist" || name === ".git") return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return [path];
  });
}

describe("contact email route", () => {
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

  afterEach(() => {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
    sendMail.mockReset();
    createTransport.mockClear();
    resetContactLimiter();
    warn.mockClear();
  });

  function readySmtp() {
    process.env.SMTP_HOST = "smtp.zoho.com";
    process.env.SMTP_PORT = "465";
    process.env.SMTP_USER = "pedidos@mifotito.com";
    process.env.SMTP_PASS = "secret-pass";
    process.env.SMTP_FROM = "Mi Fotito <pedidos@mifotito.com>";
  }

  it("rejects bad requests and never lets the client choose the recipient", async () => {
    readySmtp();
    const { default: handler } = await import("../api/contact.mjs");
    const wrongMethod = jsonResponse();
    await handler({ method: "GET", headers: {}, body: {} }, wrongMethod.res);
    expect(wrongMethod.sent.status).toBe(405);

    const missing = jsonResponse();
    await handler(post({ type: "retablo", size: "  " }), missing.res);
    expect(missing.sent.status).toBe(400);
    expect(missing.sent.body?.error).toBe("Cuéntanos el tamaño en una frase.");

    const badEmail = jsonResponse();
    await handler(post({ type: "contacto", name: "Ana", email: "ana-sin-arroba", message: "Hola" }), badEmail.res);
    expect(badEmail.sent.status).toBe(400);
    expect(String(badEmail.sent.body?.error)).toMatch(/correo/);

    const unknown = jsonResponse();
    await handler(post({ type: "otro", to: "evil@example.com", name: "Ana", email: "ana@ejemplo.com", message: "Hola" }), unknown.res);
    expect(unknown.sent.status).toBe(400);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("sends retablo, orders, claims and general contact to pedidos, and account mail to cuentas", async () => {
    readySmtp();
    sendMail.mockResolvedValue({ messageId: "1" });
    const { default: handler } = await import("../api/contact.mjs");

    const retablo = jsonResponse();
    await handler(post({ type: "retablo", size: "Mediano, para la sala", to: "evil@example.com", email: " ana@ejemplo.com " }, "203.0.113.21"), retablo.res);
    expect(retablo.sent).toEqual({ status: 200, body: { ok: true } });
    expect(createTransport).toHaveBeenCalledWith({
      host: "smtp.zoho.com",
      port: 465,
      secure: true,
      auth: { user: "pedidos@mifotito.com", pass: "secret-pass" },
    });
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      from: "Mi Fotito <pedidos@mifotito.com>",
      to: PEDIDOS_EMAIL,
      replyTo: "ana@ejemplo.com",
      subject: "Solicitud de retablo – Mediano, para la sala",
    }));
    const retabloMail = sendMail.mock.calls[0][0] as { text: string; html: string };
    expect(retabloMail.text).toContain(retabloMessage("Mediano, para la sala"));
    expect(retabloMail.html).toContain("Mediano, para la sala");
    expect(retabloMail.html).not.toContain("<script");

    sendMail.mockClear();
    const injected = jsonResponse();
    await handler(post({ type: "retablo", size: "Mesa <script>alert(1)</script>", name: "Ana\nBcc: evil@example.com" }, "203.0.113.22"), injected.res);
    const escaped = sendMail.mock.calls[0][0] as { subject: string; html: string; text: string };
    expect(escaped.subject).not.toContain("\n");
    expect(escaped.html).toContain("&lt;script&gt;");
    expect(escaped.html).not.toContain("<script>");
    expect(escaped.text).toContain("Mesa <script>alert(1)</script>");
    expect(escaped.subject).toBe("Solicitud de retablo – Ana Bcc: evil@example.com");

    sendMail.mockClear();
    const order = jsonResponse();
    await handler(post({ type: "pedido", message: "¿Cuándo llega?", orderNumber: "MF-26-1004", name: "Ana" }, "203.0.113.23"), order.res);
    expect(sendMail.mock.calls[0][0]).toMatchObject({ to: PEDIDOS_EMAIL, subject: "Consulta sobre mi pedido MF-26-1004" });
    expect(sendMail.mock.calls[0][0].replyTo).toBeUndefined();

    sendMail.mockClear();
    const claim = jsonResponse();
    await handler(post({ type: "reclamo", email: "ana@ejemplo.com", message: "Llegó roto", token: "tok_1", to: CUENTAS_EMAIL }, "203.0.113.24"), claim.res);
    expect(sendMail.mock.calls[0][0]).toMatchObject({ to: PEDIDOS_EMAIL, replyTo: "ana@ejemplo.com", subject: "Reclamo – ana@ejemplo.com" });

    sendMail.mockClear();
    const general = jsonResponse();
    const long = `${"a".repeat(2000)}MARKER`;
    await handler(post({ type: "contacto", name: "Lucía", email: "lucia@ejemplo.com", message: long, to: "evil@example.com" }, "203.0.113.25"), general.res);
    const generalMail = sendMail.mock.calls[0][0] as { to: string; subject: string; text: string };
    expect(generalMail.to).toBe(PEDIDOS_EMAIL);
    expect(generalMail.subject).toBe("Contacto – Lucía");
    expect(generalMail.text).not.toContain("MARKER");
    expect(generalMail.text).toContain("a".repeat(2000));

    sendMail.mockClear();
    const account = jsonResponse();
    await handler(post({ type: "cuenta", name: "Lucía", email: "lucia@ejemplo.com", message: "No puedo entrar", to: PEDIDOS_EMAIL }, "203.0.113.26"), account.res);
    expect(sendMail.mock.calls[0][0]).toMatchObject({
      to: CUENTAS_EMAIL,
      replyTo: "lucia@ejemplo.com",
      subject: "Consulta de cuenta – Lucía",
    });
  });

  it("drops honeypot posts, limits repeats, and hides SMTP failures", async () => {
    readySmtp();
    sendMail.mockResolvedValue({ messageId: "1" });
    const { default: handler } = await import("../api/contact.mjs");

    const honey = jsonResponse();
    await handler(post({ type: "contacto", name: "Bot", email: "bot@ejemplo.com", message: "spam", hp_field: "http://spam.test" }), honey.res);
    expect(honey.sent).toEqual({ status: 200, body: { ok: true } });
    expect(sendMail).not.toHaveBeenCalled();

    for (let i = 0; i < 5; i += 1) {
      const ok = jsonResponse();
      await handler(post({ type: "retablo", size: `Mesa ${i}` }, "198.51.100.8"), ok.res);
      expect(ok.sent.status).toBe(200);
    }
    const limited = jsonResponse();
    await handler(post({ type: "retablo", size: "Otra mesa" }, "198.51.100.8"), limited.res);
    expect(limited.sent.status).toBe(429);
    expect(limited.sent.body?.error).toBe(CONTACT_RATE_LIMIT);
    const other = jsonResponse();
    await handler(post({ type: "retablo", size: "Otra mesa" }, "198.51.100.9"), other.res);
    expect(other.sent.status).toBe(200);

    sendMail.mockRejectedValue(new Error("auth failed secret-pass"));
    const failed = jsonResponse();
    await handler(post({ type: "retablo", size: "Mesa grande" }, "198.51.100.10"), failed.res);
    expect(failed.sent.status).toBe(502);
    expect(failed.sent.body).toEqual({ error: CONTACT_ERROR });
    expect(JSON.stringify(failed.sent.body)).not.toContain("secret-pass");
    expect(JSON.stringify(warn.mock.calls)).toContain("[redacted]");
    expect(JSON.stringify(warn.mock.calls)).not.toContain("secret-pass");

    for (const key of keys) delete process.env[key];
    sendMail.mockClear();
    const quiet = jsonResponse();
    await handler(post({ type: "retablo", size: "Mesa chica" }, "198.51.100.11"), quiet.res);
    expect(quiet.sent.status).toBe(503);
    expect(quiet.sent.body).toEqual({ error: CONTACT_ERROR });
    expect(JSON.stringify(quiet.sent.body)).not.toMatch(/SMTP/);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("keeps mailto links out of the customer site", () => {
    const text = /\.(tsx?|jsx?|mjs|html|md|json|xml|txt|toml|css)$/;
    const hits = walk(".")
      .filter((path) => text.test(path) && !path.endsWith("tests/contact-email.test.ts"))
      .flatMap((path) => (readFileSync(path, "utf8").includes("mailto:") ? [path] : []));
    expect(hits).toEqual(["src/components/InlineLink.tsx"]);
    const guard = readFileSync("src/components/InlineLink.tsx", "utf8");
    expect(guard).toContain('if (href.startsWith("mailto:")) {\n    return <Text');
    expect(guard).not.toContain("mailto:${");
  });
});
