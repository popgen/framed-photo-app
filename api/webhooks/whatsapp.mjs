import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { reduceWa } from "../../src/lib/whatsapp/flow.mjs";

const sessions = new Map();

export default async function handler(req, res) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) {
    console.warn("[mifotito] WhatsApp Business pendiente (webhook). Faltan WHATSAPP_TOKEN o WHATSAPP_PHONE_NUMBER_ID. No se llama a la Cloud API.");
  }
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (!process.env.WHATSAPP_VERIFY_TOKEN) {
      res.status(200).json({ pending: true, message: "WhatsApp Business próximamente." });
      return;
    }
    if (mode === "subscribe" && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      res.status(200).send(challenge);
      return;
    }
    res.status(403).json({ error: "verify token mismatch" });
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "method" });
    return;
  }
  const body = req.body ?? {};
  if ((!token || !phoneId) && !body.mock) {
    res.status(200).json({ pending: true, mock: true, message: "WhatsApp Business próximamente." });
    return;
  }
  try {
  await handleIncoming(req, res, body);
  } catch (error) {
    console.warn("[mifotito] El webhook de WhatsApp no pudo completar el mensaje.", error);
    res.status(200).json({ pending: true, mock: !token, message: "WhatsApp Business próximamente." });
  }
}

async function handleIncoming(req, res, body) {
  const incoming = extract(body);
  const catalog = JSON.parse(await readFrames()).map((frame) => ({
    id: frame.id,
    name: frame.name,
    priceCents: frame.priceCents,
    sizeLabel: frame.sizeLabel,
    printWcm: frame.printWcm,
    printHcm: frame.printHcm,
  }));
  const replies = [];
  for (const message of incoming) {
    const size = await measure(message);
    const event = message.kind === "image"
      ? { type: "image", width: size.width, height: size.height, phone: message.from }
      : { type: message.choice ? "select" : "text", id: message.choice, text: message.text, phone: message.from };
    const result = reduceWa(sessions.get(message.from), event, {
      catalog,
      origin: process.env.EXPO_PUBLIC_SITE_URL || process.env.SITE_URL || "https://mifotito.com",
      supportNumber: process.env.EXPO_PUBLIC_WHATSAPP_SUPPORT_NUMBER || process.env.WHATSAPP_SUPPORT_NUMBER || "",
    });
    sessions.set(message.from, result.session);
    replies.push(...result.replies);
    await deliver(message.from, result.replies);
    await remember(result);
  }
  res.status(200).json({
    mock: !process.env.WHATSAPP_TOKEN,
    replies,
  });
}

async function readFrames() {
  const candidates = [
    path.join(process.cwd(), "data", "frames.json"),
    new URL("../../data/frames.json", import.meta.url),
  ];
  let lastError;
  for (const candidate of candidates) {
    try {
      return await readFile(candidate, "utf8");
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

function extract(body) {
  if (body.mock) {
    return [{ from: body.from || "51987654321", kind: body.choice || body.text ? "text" : "image", choice: body.choice, text: body.text, mediaId: body.mediaId || "mock-media", width: body.width, height: body.height }];
  }
  const messages = [];
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const message of change.value?.messages ?? []) {
        const choice = message.interactive?.list_reply?.id || message.interactive?.button_reply?.id || "";
        messages.push({
          from: message.from,
          kind: message.type === "image" ? "image" : "text",
          choice,
          text: message.text?.body || "",
          mediaId: message.image?.id,
        });
      }
    }
  }
  return messages;
}

async function measure(message) {
  if (message.width && message.height) return { width: message.width, height: message.height };
  if (!message.mediaId) return { width: 1772, height: 2362 };
  if (String(message.mediaId).includes("small")) return { width: 700, height: 900 };
  const token = process.env.WHATSAPP_TOKEN;
  if (!token) return { width: 1772, height: 2362 };
  const version = process.env.WHATSAPP_GRAPH_VERSION || "v21.0";
  const meta = await fetch(`https://graph.facebook.com/${version}/${message.mediaId}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!meta.ok) throw new Error(await meta.text());
  const info = await meta.json();
  const binary = await fetch(info.url, { headers: { Authorization: `Bearer ${token}` } });
  if (!binary.ok) throw new Error(await binary.text());
  const buffer = Buffer.from(await binary.arrayBuffer());
  const folder = path.join(process.cwd(), "data", "runtime");
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, `${message.mediaId}.jpg`), buffer);
  const size = await imageSize(buffer);
  return size;
}

async function deliver(to, replies) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) {
    console.info("[whatsapp:mock]", to, JSON.stringify(replies));
    return;
  }
  const version = process.env.WHATSAPP_GRAPH_VERSION || "v21.0";
  for (const reply of replies) {
    const payload = toCloud(to, reply);
    const response = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) console.error(await response.text());
  }
}

function toCloud(to, reply) {
  if (reply.kind === "buttons") {
    return {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: reply.body.slice(0, 1024) },
        action: { buttons: reply.buttons.slice(0, 3).map((button) => ({ type: "reply", reply: { id: button.id, title: button.title.slice(0, 20) } })) },
      },
    };
  }
  if (reply.kind === "list") {
    return {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "list",
        body: { text: reply.body.slice(0, 1024) },
        action: { button: reply.button.slice(0, 20), sections: [{ title: "Marcos", rows: reply.rows.slice(0, 10) }] },
      },
    };
  }
  return { messaging_product: "whatsapp", to, type: "text", text: { body: reply.body } };
}

async function imageSize(buffer) {
  try {
    const sharp = (await import("sharp")).default;
    const meta = await sharp(buffer).metadata();
    return { width: meta.width || 1772, height: meta.height || 2362 };
  } catch {
    return { width: 1772, height: 2362 };
  }
}

async function remember(result) {
  const url = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !result.createOrder) return;
  await fetch(`${url}/rest/v1/wa_events`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ phone: result.session.phone, token: result.session.token, payload: result.session }),
  });
}
