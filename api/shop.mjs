import { mapGiftRow, mapOrderRow, mapProfile, mapPromoRow } from "../src/lib/db-map.ts";
import { checkOtp, otpFailureMessage, otpTemplateBody, prepareSend, publicSendResult, readSession, SESSION_TTL_MS, signSession } from "../src/lib/otp.ts";
import { evaluateOrder } from "../src/lib/server-order.ts";
import { serviceSupabase, signingSecret, whatsAppConfigured } from "../src/lib/service-supabase.ts";
import { maskPhone, maskStreet } from "../src/lib/order-number.ts";
import { customerOrder, toTrackingCard } from "../src/lib/tracking.ts";
import { priceCards } from "../src/lib/cards.ts";
import { frameById } from "../src/lib/catalog.ts";
import { giftCode } from "../src/lib/ids.ts";
import { normalizePhone } from "../src/lib/phone.ts";

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.status(405).json({ error: "method" });
    return;
  }
  const op = req.query.op || req.body?.op;
  try {
    if (op === "otp-send") return await sendCode(req, res);
    if (op === "otp-verify") return await verifyCode(req, res);
    if (op === "orders-by-phone") return await ordersByPhone(req, res);
    if (op === "orders-by-token") return await orderByToken(req, res);
    if (op === "orders-preview") return await previewOrder(req, res);
    if (op === "orders-create") return await createOrder(req, res);
    if (op === "orders-update") return await updateOrder(req, res);
    if (op === "orders-mark-paid") return await markPaid(req, res);
    if (op === "photos-sign") return await signPhoto(req, res);
    if (op === "voice-url") return await voiceUrl(req, res);
    if (op === "profile") return await profile(req, res);
    if (op === "gift-card") return await giftCard(req, res);
    if (op === "claim") return await claim(req, res);
    res.status(404).json({ error: "op" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "No pudimos completar eso." });
  }
}

function memory() {
  const root = globalThis;
  if (!root.__mifotitoOtp) root.__mifotitoOtp = { records: new Map(), sends: [] };
  return root.__mifotitoOtp;
}

function clientIp(req) {
  const headers = req.headers ?? {};
  const raw = headers["x-nf-client-connection-ip"] || headers["x-forwarded-for"] || "local";
  return String(raw).split(",")[0].trim() || "local";
}

function bearer(req) {
  const headers = req.headers ?? {};
  const value = headers.authorization || headers.Authorization || "";
  return String(value).replace(/^Bearer\s+/i, "");
}

async function loadGate(phone, ip, now) {
  const supabase = serviceSupabase();
  const since = new Date(now - 3_600_000).toISOString();
  if (!supabase) {
    const store = memory();
    return {
      phoneSends: store.sends.filter((item) => item.phone === phone && item.at >= now - 3_600_000),
      ipSends: store.sends.filter((item) => item.ip === ip && item.at >= now - 3_600_000),
    };
  }
  const [phoneRows, ipRows] = await Promise.all([
    supabase.from("otp_sends").select("sent_at").eq("phone", phone).gte("sent_at", since),
    supabase.from("otp_sends").select("sent_at").eq("ip", ip).gte("sent_at", since),
  ]);
  return {
    phoneSends: (phoneRows.data ?? []).map((row) => ({ at: Date.parse(row.sent_at) })),
    ipSends: (ipRows.data ?? []).map((row) => ({ at: Date.parse(row.sent_at) })),
  };
}

async function saveSend(phone, ip, record) {
  const supabase = serviceSupabase();
  if (!supabase) {
    const store = memory();
    store.records.set(phone, record);
    store.sends.push({ phone, ip, at: Date.now() });
    return;
  }
  const saved = await supabase.from("phone_otps").upsert({
    phone,
    code_hash: record.codeHash,
    salt: record.salt,
    expires_at: new Date(record.expiresAt).toISOString(),
    attempts: record.attempts,
    updated_at: new Date().toISOString(),
  });
  if (saved.error) {
    const store = memory();
    store.records.set(phone, record);
    store.sends.push({ phone, ip, at: Date.now() });
    return;
  }
  await supabase.from("otp_sends").insert({ phone, ip });
}

async function loadRecord(phone) {
  const supabase = serviceSupabase();
  if (!supabase) return memory().records.get(phone) ?? null;
  const { data, error } = await supabase.from("phone_otps").select("*").eq("phone", phone).maybeSingle();
  if (error) return memory().records.get(phone) ?? null;
  if (!data) return memory().records.get(phone) ?? null;
  return { phone: data.phone, codeHash: data.code_hash, salt: data.salt, expiresAt: Date.parse(data.expires_at), attempts: data.attempts };
}

async function saveRecord(record) {
  const supabase = serviceSupabase();
  if (!supabase) {
    memory().records.set(record.phone, record);
    return;
  }
  const saved = await supabase.from("phone_otps").upsert({
    phone: record.phone,
    code_hash: record.codeHash,
    salt: record.salt,
    expires_at: new Date(record.expiresAt).toISOString(),
    attempts: record.attempts,
    updated_at: new Date().toISOString(),
  });
  if (saved.error) memory().records.set(record.phone, record);
}

async function sendCode(req, res) {
  const now = Date.now();
  const phone = normalizePhone(req.body?.phone || "");
  const ip = clientIp(req);
  const gate = await loadGate(phone || req.body?.phone || "", ip, now);
  const prepared = await prepareSend({ phone: req.body?.phone || "", now, phoneSends: gate.phoneSends, ipSends: gate.ipSends });
  if (!prepared.ok) {
    res.status(200).json(publicSendResult(prepared, false));
    return;
  }
  await saveSend(prepared.record.phone, ip, prepared.record);
  const demo = process.env.WHATSAPP_OTP_ENABLED !== "true" || !whatsAppConfigured();
  if (!demo) {
    const sent = await deliverCode(prepared.record.phone, prepared.code);
    if (!sent) {
      res.status(502).json({ ok: false, error: "No pudimos enviar el código. Intenta de nuevo." });
      return;
    }
  }
  res.status(200).json(publicSendResult(prepared, demo));
}

async function deliverCode(to, code) {
  const version = process.env.WHATSAPP_GRAPH_VERSION || "v21.0";
  const response = await fetch(`https://graph.facebook.com/${version}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(otpTemplateBody(to, code)),
  });
  if (!response.ok) console.error(await response.text());
  return response.ok;
}

async function verifyCode(req, res) {
  const phone = normalizePhone(req.body?.phone || "");
  if (!phone) {
    res.status(200).json({ ok: false, error: otpFailureMessage() });
    return;
  }
  const now = Date.now();
  const result = await checkOtp(await loadRecord(phone), String(req.body?.code || ""), now);
  if (result.record) await saveRecord(result.record);
  if (!result.ok) {
    res.status(200).json({ ok: false, error: otpFailureMessage() });
    return;
  }
  const supabase = serviceSupabase();
  if (supabase) await supabase.from("phone_otps").delete().eq("phone", phone);
  else memory().records.delete(phone);
  const exp = now + SESSION_TTL_MS;
  const token = await signSession(phone, signingSecret(), exp);
  let tokenHash = null;
  if (supabase) tokenHash = await linkAuth(supabase, phone);
  res.status(200).json({ ok: true, token, phone, exp, tokenHash });
}

async function linkAuth(supabase, phone) {
  const email = `${phone}@phone.mifotito.com`;
  await supabase.auth.admin.createUser({ email, email_confirm: true, phone, phone_confirm: true, user_metadata: { phone } }).catch(() => null);
  const linked = await supabase.auth.admin.generateLink({ type: "magiclink", email });
  const userId = linked.data?.user?.id;
  if (userId) {
    await supabase.from("customers").upsert({ phone, user_id: userId, updated_at: new Date().toISOString() }, { onConflict: "phone" });
  }
  return linked.data?.properties?.hashed_token ?? null;
}

async function sessionPhone(req) {
  const token = bearer(req);
  if (!token) return null;
  return readSession(token, signingSecret(), Date.now());
}

async function ordersByPhone(req, res) {
  const session = await sessionPhone(req);
  if (!session) {
    res.status(401).json({ error: "Entra con el código de WhatsApp." });
    return;
  }
  const supabase = serviceSupabase();
  if (!supabase) {
    res.status(200).json({ orders: [] });
    return;
  }
  const { data } = await supabase.from("orders").select("*, order_items(*)").eq("phone", session.phone).order("created_at", { ascending: false });
  res.status(200).json({ orders: (data ?? []).map((row) => customerOrder(toTrackingCard(mapOrderRow(row)))) });
}

async function orderByToken(req, res) {
  const session = await sessionPhone(req);
  if (!session) {
    res.status(401).json({ error: "Entra con el código de WhatsApp." });
    return;
  }
  const supabase = serviceSupabase();
  if (!supabase) {
    res.status(404).json({ order: null });
    return;
  }
  const { data } = await supabase.from("orders").select("*, order_items(*)").eq("public_token", req.body?.token).eq("phone", session.phone).maybeSingle();
  if (!data) {
    res.status(200).json({ order: null });
    return;
  }
  const order = customerOrder(mapOrderRow(data));
  order.addressLine = maskStreet(order.addressLine, order.district, order.department);
  order.reference = null;
  order.email = null;
  order.recipientPhone = maskPhone(order.recipientPhone);
  res.status(200).json({ order });
}

const UPLOAD_PATH = /^uploads\/[0-9a-f-]{36}\.[a-z0-9]{1,8}$/i;

function clip(value, max) {
  return String(value ?? "").trim().slice(0, max);
}

function orderProblem(body, preview) {
  if (!Array.isArray(body?.items) || body.items.length < 1 || body.items.length > 12) return "Revisa el carrito.";
  if (!preview) {
    if (clip(body.customerName, 80).length < 2) return "Escribe tu nombre.";
    if (!normalizePhone(body.phone || "")) return "Revisa el celular.";
    if (!clip(body.addressLine, 160) || !clip(body.district, 80) || !clip(body.province, 80) || !clip(body.department, 80)) return "Completa la dirección.";
    const email = clip(body.email, 120);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Revisa el correo.";
  }
  for (const item of body.items) {
    for (const path of [item.photoPrintPath, item.photoOriginalPath]) {
      if (path && !UPLOAD_PATH.test(String(path))) return "La foto no tiene una ruta válida.";
    }
  }
  return null;
}

async function loadPricing(supabase, body) {
  const [{ data: promos }, { data: stockRows }, { data: referrals }, { data: gifts }, { data: credits }, { data: frames }] = await Promise.all([
    supabase.from("promo_codes").select("*"),
    supabase.from("inventory").select("sku, quantity"),
    supabase.from("referrals").select("*"),
    supabase.from("gift_cards").select("*"),
    supabase.from("credits").select("phone, balance_cents"),
    supabase.from("frames").select("id, price_cents"),
  ]);
  const tracked = Object.fromEntries((stockRows ?? []).map((row) => [row.sku, row.quantity]));
  const stock = { ...tracked };
  try {
    const { stockNeeds } = await import("../src/lib/server-order.ts");
    for (const sku of Object.keys(stockNeeds(body))) {
      if (!(sku in tracked)) stock[sku] = 1_000_000;
    }
  } catch {
    // An unknown frame fails inside evaluateOrder.
  }
  return {
    tracked,
    ctx: {
      promos: (promos ?? []).map(mapPromoRow),
      stock,
      referrals: (referrals ?? []).map((row) => ({ code: row.code, ownerPhone: row.owner_phone, ownerName: row.owner_name ?? "", friendDiscountCents: row.friend_discount_cents, referrerCreditCents: row.referrer_credit_cents, redeemedCount: row.redeemed_count, createdAt: row.created_at })),
      giftCards: (gifts ?? []).map(mapGiftRow),
      credits: Object.fromEntries((credits ?? []).map((row) => [row.phone, row.balance_cents])),
      prices: Object.fromEntries((frames ?? []).map((row) => [row.id, row.price_cents])),
    },
  };
}

async function previewOrder(req, res) {
  const supabase = serviceSupabase();
  if (!supabase) {
    res.status(503).json({ error: "Supabase no está configurado." });
    return;
  }
  const problem = orderProblem(req.body ?? {}, true);
  if (problem) {
    res.status(400).json({ error: problem });
    return;
  }
  const phone = normalizePhone(req.body?.phone || "") || "900000000";
  const { ctx } = await loadPricing(supabase, { ...req.body, phone });
  let evaluated;
  try {
    evaluated = evaluateOrder({ ...req.body, phone, useCredit: Boolean(req.body?.useCredit) && phone !== "900000000" }, ctx);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "No pudimos cotizar." });
    return;
  }
  if (evaluated.error || !evaluated.priced) {
    res.status(400).json({ error: evaluated.error || "No pudimos cotizar." });
    return;
  }
  res.status(200).json({
    ...evaluated.priced,
    zone: evaluated.zone,
    stockError: null,
    christmasNote: evaluated.christmasNote,
    etaLabel: evaluated.etaLabel,
    etaMin: evaluated.etaMin,
    etaMax: evaluated.etaMax,
    christmasGuaranteed: evaluated.christmasGuaranteed,
  });
}

async function createOrder(req, res) {
  const supabase = serviceSupabase();
  if (!supabase) {
    res.status(503).json({ error: "Supabase no está configurado." });
    return;
  }
  const problem = orderProblem(req.body ?? {}, false);
  if (problem) {
    res.status(400).json({ error: problem });
    return;
  }
  const { ctx } = await loadPricing(supabase, req.body);
  let evaluated;
  try {
    evaluated = evaluateOrder(req.body, ctx);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "No pudimos cotizar." });
    return;
  }
  if (evaluated.error || !evaluated.priced) {
    res.status(400).json({ error: evaluated.error || "No pudimos cotizar." });
    return;
  }
  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .upsert({ phone: evaluated.phone, name: clip(req.body.customerName, 80), email: clip(req.body.email, 120) || null, updated_at: new Date().toISOString() }, { onConflict: "phone" })
    .select("id")
    .single();
  if (customerError) {
    res.status(500).json({ error: customerError.message });
    return;
  }
  const now = new Date().toISOString();
  const { data: inserted, error } = await supabase
    .from("orders")
    .insert({
      status: "pending_payment",
      customer_name: clip(req.body.customerName, 80),
      phone: evaluated.phone,
      email: clip(req.body.email, 120) || null,
      recipient_name: clip(req.body.recipientName, 80) || null,
      recipient_phone: normalizePhone(req.body.recipientPhone || "") || null,
      gift_note: clip(req.body.giftNote, 280) || null,
      gift_wrap: Boolean(req.body.giftWrap) && evaluated.priced.giftWrapCents > 0,
      address_line: clip(req.body.addressLine, 160),
      district: clip(req.body.district, 80),
      province: clip(req.body.province, 80),
      city: clip(req.body.city || req.body.district, 80),
      department: clip(req.body.department, 80),
      reference: clip(req.body.reference, 160) || null,
      zone: evaluated.zone,
      subtotal_cents: evaluated.priced.subtotalCents,
      frame_discount_cents: evaluated.priced.frameDiscountCents,
      frame_discount_label: evaluated.priced.frameDiscountLabel,
      promo_code: evaluated.priced.promoDiscountCents > 0 ? evaluated.promo?.code : null,
      promo_discount_cents: evaluated.priced.promoDiscountCents,
      referral_code: evaluated.priced.referralDiscountCents > 0 ? evaluated.referral?.code ?? null : null,
      referral_discount_cents: evaluated.priced.referralDiscountCents,
      credit_applied_cents: evaluated.priced.creditAppliedCents,
      gift_card_code: evaluated.priced.giftCardAppliedCents > 0 ? clip(req.body.giftCardCode, 40) || null : null,
      gift_card_applied_cents: evaluated.priced.giftCardAppliedCents,
      gift_wrap_cents: evaluated.priced.giftWrapCents,
      total_cents: evaluated.priced.totalCents,
      payment_method: req.body.paymentMethod,
      payment_status: "pending",
      christmas_guaranteed: evaluated.christmasGuaranteed,
      christmas_note: evaluated.christmasNote,
      eta_min: evaluated.etaMin,
      eta_max: evaluated.etaMax,
      eta_label: evaluated.etaLabel,
      channel: req.body.channel === "whatsapp" ? "whatsapp" : "web",
      customer_id: customer?.id ?? null,
      created_at: now,
      updated_at: now,
    })
    .select("public_token")
    .single();
  if (error || !inserted?.public_token) {
    res.status(500).json({ error: error?.message || "No pudimos guardar el pedido." });
    return;
  }
  const { data: created } = await supabase.from("orders").select("id").eq("public_token", inserted.public_token).single();
  const rows = (req.body.items ?? []).map((item) => ({
    order_id: created.id,
    frame_id: item.card?.sizeId || item.frameId,
    photo_path: item.photoPrintPath || item.photoOriginalPath || null,
    crop: item.crop ?? {},
    orientation: item.orientation === "landscape" ? "landscape" : "portrait",
    quantity: 1,
    unit_price_cents: linePrice(item, ctx.prices),
    dpi: Number.isFinite(item.dpi) ? item.dpi : null,
    resolution_status: item.resolutionStatus || null,
    text_overlay: item.textOverlay || null,
    card: item.card || null,
    voice: item.voice ? { ...item.voice, storagePath: item.voice.storagePath || item.photoPrintPath || null } : null,
    bundle_id: item.bundleId || null,
    bundle_label: item.bundleLabel || null,
  }));
  let itemError = (await supabase.from("order_items").insert(rows)).error;
  if (itemError && /text_overlay|card|voice|schema cache/i.test(itemError.message)) {
    itemError = (await supabase.from("order_items").insert(rows.map(({ text_overlay, card, voice, ...rest }) => rest))).error;
  }
  if (itemError) {
    await supabase.from("orders").delete().eq("id", created.id);
    const missing = /foreign key|frames/i.test(itemError.message);
    res.status(500).json({ error: missing ? "Falta aplicar la migración 20261118193000_shop_extras.sql para ese producto." : itemError.message });
    return;
  }
  res.status(200).json({ token: inserted.public_token });
}

function linePrice(item, prices) {
  if (item.card) return priceCards(item.card.quantity).cents;
  if (prices?.[item.frameId] != null) return prices[item.frameId];
  try {
    return frameById(item.frameId).priceCents;
  } catch {
    return 0;
  }
}

async function updateOrder(req, res) {
  const supabase = serviceSupabase();
  if (!supabase) {
    res.status(503).json({ error: "Supabase no está configurado." });
    return;
  }
  const key = String(req.body?.orderToken || "");
  if (!/^[0-9a-f-]{8,40}$/i.test(key)) {
    res.status(404).json({ error: "No encontramos el pedido." });
    return;
  }
  const problem = orderProblem(req.body ?? {}, false);
  if (problem) {
    res.status(400).json({ error: problem });
    return;
  }
  const { data: existing } = key.includes("-")
    ? await supabase.from("orders").select("id, public_token, payment_status").eq("id", key).maybeSingle()
    : await supabase.from("orders").select("id, public_token, payment_status").eq("public_token", key).maybeSingle();
  if (!existing) {
    res.status(404).json({ error: "No encontramos el pedido." });
    return;
  }
  if (existing.payment_status === "approved") {
    res.status(409).json({ error: "Ese pedido ya está pagado." });
    return;
  }
  const { ctx } = await loadPricing(supabase, req.body);
  let evaluated;
  try {
    evaluated = evaluateOrder(req.body, ctx);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "No pudimos cotizar." });
    return;
  }
  if (evaluated.error || !evaluated.priced) {
    res.status(400).json({ error: evaluated.error || "No pudimos cotizar." });
    return;
  }
  const { error } = await supabase.from("orders").update({
    customer_name: clip(req.body.customerName, 80),
    phone: evaluated.phone,
    email: clip(req.body.email, 120) || null,
    address_line: clip(req.body.addressLine, 160),
    district: clip(req.body.district, 80),
    province: clip(req.body.province, 80),
    city: clip(req.body.city || req.body.district, 80),
    department: clip(req.body.department, 80),
    reference: clip(req.body.reference, 160) || null,
    zone: evaluated.zone,
    subtotal_cents: evaluated.priced.subtotalCents,
    frame_discount_cents: evaluated.priced.frameDiscountCents,
    frame_discount_label: evaluated.priced.frameDiscountLabel,
    promo_discount_cents: evaluated.priced.promoDiscountCents,
    referral_discount_cents: evaluated.priced.referralDiscountCents,
    credit_applied_cents: evaluated.priced.creditAppliedCents,
    gift_card_applied_cents: evaluated.priced.giftCardAppliedCents,
    gift_wrap_cents: evaluated.priced.giftWrapCents,
    total_cents: evaluated.priced.totalCents,
    christmas_guaranteed: evaluated.christmasGuaranteed,
    christmas_note: evaluated.christmasNote,
    eta_min: evaluated.etaMin,
    eta_max: evaluated.etaMax,
    eta_label: evaluated.etaLabel,
    updated_at: new Date().toISOString(),
  }).eq("id", existing.id);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  await supabase.from("order_items").delete().eq("order_id", existing.id);
  const rows = (req.body.items ?? []).map((item) => ({
    order_id: existing.id,
    frame_id: item.card?.sizeId || item.frameId,
    photo_path: item.photoPrintPath || null,
    crop: item.crop ?? {},
    orientation: item.orientation === "landscape" ? "landscape" : "portrait",
    quantity: 1,
    unit_price_cents: linePrice(item, ctx.prices),
    dpi: Number.isFinite(item.dpi) ? item.dpi : null,
    resolution_status: item.resolutionStatus || null,
    text_overlay: item.textOverlay || null,
    card: item.card || null,
    voice: item.voice || null,
    bundle_id: item.bundleId || null,
    bundle_label: item.bundleLabel || null,
  }));
  const itemError = (await supabase.from("order_items").insert(rows)).error;
  if (itemError) {
    res.status(500).json({ error: itemError.message });
    return;
  }
  res.status(200).json({ token: existing.public_token });
}

async function markPaid(req, res) {
  const supabase = serviceSupabase();
  if (!supabase) {
    res.status(503).json({ error: "Supabase no está configurado." });
    return;
  }
  const key = String(req.body?.token || req.body?.orderId || "");
  if (!/^[0-9a-f-]{8,40}$/i.test(key)) {
    res.status(400).json({ error: "No encontramos el pedido." });
    return;
  }
  const lookup = key.includes("-")
    ? supabase.from("orders").select("*, order_items(*)").eq("id", key).maybeSingle()
    : supabase.from("orders").select("*, order_items(*)").eq("public_token", key).maybeSingle();
  const { data: row } = await lookup;
  if (!row) {
    res.status(404).json({ error: "No encontramos el pedido." });
    return;
  }
  if (row.payment_status !== "approved") {
    const order = mapOrderRow(row);
    for (const item of order.items) {
      if (item.card || !item.frameId) continue;
    }
    const { data: stockRows } = await supabase.from("inventory").select("*");
    const stock = Object.fromEntries((stockRows ?? []).map((item) => [item.sku, item]));
    const { frameById } = await import("../src/lib/catalog.ts");
    for (const item of order.items) {
      if (item.card) continue;
      let frame;
      try {
        frame = frameById(item.frameId);
      } catch {
        continue;
      }
      for (const part of frame.consumes) {
        const current = stock[part.sku];
        if (!current) continue;
        if (current.quantity < part.qty) {
          res.status(409).json({ error: `Sin stock al confirmar (${part.sku}).` });
          return;
        }
        current.quantity -= part.qty;
      }
    }
    for (const sku of Object.keys(stock)) {
      await supabase.from("inventory").update({ quantity: stock[sku].quantity }).eq("sku", sku);
    }
    if (row.promo_code) {
      const { data: promo } = await supabase.from("promo_codes").select("used_count").eq("code", row.promo_code).maybeSingle();
      if (promo) await supabase.from("promo_codes").update({ used_count: promo.used_count + 1 }).eq("code", row.promo_code);
    }
    if (row.gift_card_code && row.gift_card_applied_cents > 0) {
      const { data: card } = await supabase.from("gift_cards").select("balance_cents").eq("code", row.gift_card_code).maybeSingle();
      if (card) await supabase.from("gift_cards").update({ balance_cents: Math.max(0, card.balance_cents - row.gift_card_applied_cents) }).eq("code", row.gift_card_code);
    }
    if (row.credit_applied_cents > 0) {
      const { data: credit } = await supabase.from("credits").select("balance_cents").eq("phone", row.phone).maybeSingle();
      if (credit) await supabase.from("credits").update({ balance_cents: Math.max(0, credit.balance_cents - row.credit_applied_cents) }).eq("phone", row.phone);
    }
    if (row.referral_code) {
      const { data: referral } = await supabase.from("referrals").select("*").eq("code", row.referral_code).maybeSingle();
      if (referral && referral.owner_phone !== row.phone) {
        await supabase.from("referrals").update({ redeemed_count: referral.redeemed_count + 1 }).eq("code", row.referral_code);
        const { data: owner } = await supabase.from("credits").select("balance_cents").eq("phone", referral.owner_phone).maybeSingle();
        const next = (owner?.balance_cents ?? 0) + (referral.referrer_credit_cents || 1500);
        await supabase.from("credits").upsert({ phone: referral.owner_phone, balance_cents: next });
      }
    }
    await supabase.from("orders").update({
      payment_status: "approved",
      status: "paid",
      payment_method: req.body?.method,
      payment_provider: req.body?.provider,
      payment_ref: req.body?.ref,
      updated_at: new Date().toISOString(),
    }).eq("id", row.id);
  }
  const { data } = await supabase.from("orders").select("*, order_items(*)").eq("id", row.id).single();
  res.status(200).json(customerOrder(mapOrderRow(data)));
}

async function signPhoto(req, res) {
  const supabase = serviceSupabase();
  const session = await adminSession(req, supabase);
  if (!session) {
    res.status(401).json({ error: "Solo el admin puede abrir las fotos." });
    return;
  }
  const path = String(req.body?.path || "");
  if (!path.startsWith("uploads/")) {
    res.status(400).json({ error: "Ruta inválida." });
    return;
  }
  const signed = await supabase.storage.from("photos").createSignedUrl(path, 60 * 15);
  if (signed.error || !signed.data?.signedUrl) {
    res.status(404).json({ error: "No encontramos esa foto." });
    return;
  }
  res.status(200).json({ url: signed.data.signedUrl });
}

async function adminSession(req, supabase) {
  if (!supabase) return false;
  const token = bearer(req);
  if (!token) return false;
  const user = await supabase.auth.getUser(token);
  if (!user.data.user) return false;
  const row = await supabase.from("admin_users").select("user_id").eq("user_id", user.data.user.id).maybeSingle();
  return Boolean(row.data);
}

async function voiceUrl(req, res) {
  const supabase = serviceSupabase();
  if (!supabase) {
    res.status(404).json({ error: "Sin audio." });
    return;
  }
  const token = String(req.query.token || req.body?.token || "");
  const { data } = await supabase.from("voice_notes").select("storage_path").eq("token", token).maybeSingle();
  if (!data?.storage_path) {
    res.status(404).json({ error: "Sin audio." });
    return;
  }
  const signed = await supabase.storage.from("photos").createSignedUrl(data.storage_path, 60 * 30);
  res.status(200).json({ url: signed.data?.signedUrl ?? null });
}

async function profile(req, res) {
  const session = await sessionPhone(req);
  if (!session) {
    res.status(401).json({ error: "Entra con el código de WhatsApp." });
    return;
  }
  const supabase = serviceSupabase();
  if (!supabase) {
    res.status(200).json({ profile: null });
    return;
  }
  if (req.method === "GET" || req.body?.read) {
    res.status(200).json(await readAccount(supabase, session.phone));
    return;
  }
  const body = req.body?.profile ?? {};
  const name = clip(body.name, 80);
  const email = clip(body.email, 120);
  if (name && name.length < 2) {
    res.status(400).json({ error: "Escribe tu nombre." });
    return;
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "Revisa el correo." });
    return;
  }
  const addresses = Array.isArray(body.addresses) ? body.addresses.slice(0, 5) : [];
  for (const item of addresses) {
    if (!clip(item.addressLine, 160) || !clip(item.district, 80) || !clip(item.province, 80) || !clip(item.department, 80)) {
      res.status(400).json({ error: "Completa la dirección." });
      return;
    }
  }
  const { data: customer, error } = await supabase
    .from("customers")
    .upsert({ phone: session.phone, name: name || null, email: email || null, updated_at: new Date().toISOString() }, { onConflict: "phone" })
    .select("id")
    .single();
  if (error || !customer) {
    res.status(400).json({ error: error?.message || "No pudimos guardar la cuenta." });
    return;
  }
  await supabase.from("customer_addresses").delete().eq("customer_id", customer.id);
  if (addresses.length) {
    const inserted = await supabase.from("customer_addresses").insert(
      addresses.map((item) => ({
        customer_id: customer.id,
        address_line: clip(item.addressLine, 160),
        district: clip(item.district, 80),
        province: clip(item.province, 80),
        department: clip(item.department, 80),
        city: clip(item.city || item.district, 80),
        reference: clip(item.reference, 160) || null,
      })),
    );
    if (inserted.error && !/customer_addresses|schema cache/i.test(inserted.error.message)) {
      res.status(400).json({ error: inserted.error.message });
      return;
    }
  }
  res.status(200).json(await readAccount(supabase, session.phone));
}

async function readAccount(supabase, phone) {
  const { data } = await supabase.from("customers").select("*, customer_addresses(*)").eq("phone", phone).maybeSingle();
  const { data: credit } = await supabase.from("credits").select("balance_cents").eq("phone", phone).maybeSingle();
  return { profile: mapProfile(data, data?.customer_addresses ?? []), creditCents: credit?.balance_cents ?? 0 };
}

async function giftCard(req, res) {
  const supabase = serviceSupabase();
  if (!supabase) {
    res.status(503).json({ error: "Supabase no está configurado." });
    return;
  }
  if (!(await adminSession(req, supabase))) {
    res.status(401).json({ error: "Solo el admin puede crear gift cards." });
    return;
  }
  const code = giftCode();
  const row = {
    code,
    initial_cents: req.body.amountCents,
    balance_cents: req.body.amountCents,
    buyer_name: req.body.buyerName,
    buyer_phone: normalizePhone(req.body.buyerPhone || ""),
    recipient_name: req.body.recipientName,
    recipient_phone: normalizePhone(req.body.recipientPhone || ""),
    recipient_email: req.body.recipientEmail || null,
    message: req.body.message || null,
    status: "active",
  };
  const { data, error } = await supabase.from("gift_cards").insert(row).select("*").single();
  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }
  res.status(200).json(mapGiftRow(data));
}

async function claim(req, res) {
  const session = await sessionPhone(req);
  const supabase = serviceSupabase();
  if (!session || !supabase) {
    res.status(401).json({ error: "Entra con el código de WhatsApp." });
    return;
  }
  const { data: order } = await supabase.from("orders").select("id, number").eq("public_token", req.body.token).eq("phone", session.phone).maybeSingle();
  if (!order) {
    res.status(404).json({ error: "No coincide el pedido con ese celular." });
    return;
  }
  const { data, error } = await supabase
    .from("claims")
    .insert({ order_id: order.id, phone: session.phone, note: req.body.note, photo_path: req.body.photoPath || null, status: "open" })
    .select("*")
    .single();
  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }
  res.status(200).json({ id: data.id, orderId: order.id, phone: session.phone, note: data.note, status: data.status, createdAt: data.created_at });
}
