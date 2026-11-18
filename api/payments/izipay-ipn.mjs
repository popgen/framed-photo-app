import { confirmIzipay } from "./izipay-confirm.mjs";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method" });
    return;
  }
  const result = await confirmIzipay(req);
  if (!result.ok) {
    console.warn("[mifotito] Izipay IPN rechazado.", result.error);
    res.status(400).json({ ok: false });
    return;
  }
  res.status(200).send("OK");
}
