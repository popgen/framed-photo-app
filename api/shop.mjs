import { mapGiftRow, mapOrderRow, mapProfile, mapPromoRow } from "../src/lib/db-map.ts";
import { checkOtp, otpFailureMessage, otpTemplateBody, prepareSend, publicSendResult, readSession, SESSION_TTL_MS, signSession } from "../src/lib/otp.ts";
import { evaluateOrder } from "../src/lib/server-order.ts";
import { serviceSupabase, signingSecret, whatsAppConfigured } from "../src/lib/service-supabase.ts";
import { maskPhone, maskStreet } from "../src/lib/order-number.ts";
import { toTrackingCard } from "../src/lib/tracking.ts";
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
    if (op === "orders-create") return await createOrder(req, res);
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
  await supabase.from("phone_otps").upsert({
    phone,
    code_hash: record.codeHash,
    salt: record.salt,
    expires_at: new Date(record.expiresAt).toISOString(),
    attempts: record.attempts,
    updated_at: new Date().toISOString(),
  });
  await supabase.from("otp_sends").insert({ phone, ip });
}

async function loadRecord(phone) {
  const supabase = serviceSupabase();
  if (!supabase) return memory().records.get(phone) ?? null;
  const { data } = await supabase.from("phone_otps").select("*").eq("phone", phone).maybeSingle();
  if (!data) return null;
  return { phone: data.phone, codeHash: data.code_hash, salt: data.salt, expiresAt: Date.parse(data.expires_at), attempts: data.attempts };
}

async function saveRecord(record) {
  const supabase = serviceSupabase();
  if (!supabase) {
    memory().records.set(record.phone, record);
    return;
  }
  await supabase.from("phone_otps").upsert({
    phone: record.phone,
    code_hash: record.codeHash,
    salt: record.salt,
    expires_at: new Date(record.expiresAt).toISOString(),
    attempts: record.attempts,
    updated_at: new Date().toISOString(),
  });
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
  const demo = !whatsAppConfigured();
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
    await supabase.from("customers").upsert({ phone, auth_user_id: userId, updated_at: new Date().toISOString() }, { onConflict: "phone" });
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
  res.status(200).json({ orders: (data ?? []).map((row) => toTrackingCard(mapOrderRow(row))) });
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
  const order = mapOrderRow(data);
  order.addressLine = maskStreet(order.addressLine, order.district, order.department);
  order.reference = null;
  order.email = null;
  order.recipientPhone = maskPhone(order.recipientPhone);
  res.status(200).json({ order });
}

async function createOrder(req, res) {
  const supabase = serviceSupabase();
  if (!supabase) {
    res.status(503).json({ error: "Supabase no está configurado." });
    return;
  }
  const [{ data: promos }, { data: stockRows }] = await Promise.all([
    supabase.from("promo_codes").select("*"),
    supabase.from("inventory").select("sku, quantity"),
  ]);
  const stock = Object.fromEntries((stockRows ?? []).map((row) => [row.sku, row.quantity]));
  const evaluated = evaluateOrder(req.body, { promos: (promos ?? []).map(mapPromoRow), stock });
  if (evaluated.error || !evaluated.priced) {
    res.status(400).json({ error: evaluated.error || "No pudimos cotizar." });
    return;
  }
  const { data: number, error: numberError } = await supabase.rpc("next_order_number");
  if (numberError || !number) {
    res.status(500).json({ error: numberError?.message || "No pudimos numerar el pedido." });
    return;
  }
  const { data: customer } = await supabase
    .from("customers")
    .upsert({ phone: evaluated.phone, name: req.body.customerName, email: req.body.email || null, updated_at: new Date().toISOString() }, { onConflict: "phone" })
    .select("id")
    .single();
  const now = new Date().toISOString();
  const { data: inserted, error } = await supabase
    .from("orders")
    .insert({
      public_token: crypto.randomUUID().replace(/-/g, "").slice(0, 12),
      number,
      status: "pending_payment",
      customer_name: String(req.body.customerName || "").trim(),
      phone: evaluated.phone,
      email: req.body.email || null,
      recipient_name: req.body.recipientName || null,
      recipient_phone: normalizePhone(req.body.recipientPhone || "") || null,
      gift_note: req.body.giftNote || null,
      gift_wrap: Boolean(req.body.giftWrap),
      address_line: req.body.addressLine,
      district: req.body.district,
      province: req.body.province,
      city: req.body.city || req.body.district,
      department: req.body.department,
      reference: req.body.reference || null,
      zone: evaluated.zone,
      subtotal_cents: evaluated.priced.subtotalCents,
      frame_discount_cents: evaluated.priced.frameDiscountCents,
      frame_discount_label: evaluated.priced.frameDiscountLabel,
      promo_code: evaluated.priced.promoDiscountCents > 0 ? evaluated.promo?.code : null,
      promo_discount_cents: evaluated.priced.promoDiscountCents,
      referral_discount_cents: 0,
      credit_applied_cents: 0,
      gift_card_applied_cents: 0,
      gift_wrap_cents: evaluated.priced.giftWrapCents,
      total_cents: evaluated.priced.totalCents,
      payment_method: req.body.paymentMethod,
      payment_status: "pending",
      christmas_guaranteed: evaluated.christmasGuaranteed,
      christmas_note: evaluated.christmasNote,
      eta_min: evaluated.etaMin,
      eta_max: evaluated.etaMax,
      eta_label: evaluated.etaLabel,
      channel: req.body.channel || "web",
      customer_id: customer?.id ?? null,
      created_at: now,
      updated_at: now,
    })
    .select("id, public_token")
    .single();
  if (error || !inserted) {
    res.status(500).json({ error: error?.message || "No pudimos guardar el pedido." });
    return;
  }
  if ((req.body.items ?? []).length) {
    const { error: itemError } = await supabase.from("order_items").insert(
      req.body.items.map((item) => ({
        order_id: inserted.id,
        frame_id: item.frameId || "card",
        photo_path: item.photoPrintPath || null,
        original_path: item.photoOriginalPath || null,
        print_path: item.photoPrintPath || null,
        crop: item.crop ?? {},
        orientation: item.orientation || "portrait",
        quantity: 1,
        unit_price_cents: linePrice(item),
        dpi: item.dpi || null,
        resolution_status: item.resolutionStatus || null,
        text_overlay: item.textOverlay || null,
        card: item.card || null,
        voice: item.voice || null,
        bundle_id: item.bundleId || null,
        bundle_label: item.bundleLabel || null,
      })),
    );
    if (itemError) {
      res.status(500).json({ error: itemError.message });
      return;
    }
  }
  const { data } = await supabase.from("orders").select("*, order_items(*)").eq("id", inserted.id).single();
  res.status(200).json(mapOrderRow(data));
}

function linePrice(item) {
  if (item.card) return priceCards(item.card.quantity).cents;
  try {
    return frameById(item.frameId).priceCents + (item.voice ? item.voice.addonCents || 0 : 0);
  } catch {
    return 0;
  }
}

async function markPaid(req, res) {
  const supabase = serviceSupabase();
  if (!supabase) {
    res.status(503).json({ error: "Supabase no está configurado." });
    return;
  }
  const { data: row } = await supabase.from("orders").select("*, order_items(*)").eq("id", req.body?.orderId).single();
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
        if (!current || current.quantity < part.qty) {
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
  res.status(200).json(mapOrderRow(data));
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
    const { data } = await supabase.from("customers").select("*, customer_addresses(*)").eq("phone", session.phone).maybeSingle();
    res.status(200).json({ profile: mapProfile(data, data?.customer_addresses ?? []) });
    return;
  }
  const body = req.body?.profile ?? {};
  const { data: customer } = await supabase
    .from("customers")
    .upsert({ phone: session.phone, name: body.name || null, email: body.email || null, updated_at: new Date().toISOString() }, { onConflict: "phone" })
    .select("id")
    .single();
  if (customer && Array.isArray(body.addresses)) {
    await supabase.from("customer_addresses").delete().eq("customer_id", customer.id);
    if (body.addresses.length) {
      await supabase.from("customer_addresses").insert(
        body.addresses.map((item) => ({
          customer_id: customer.id,
          address_line: item.addressLine,
          district: item.district,
          province: item.province,
          department: item.department,
          city: item.city,
          reference: item.reference || null,
        })),
      );
    }
  }
  const { data } = await supabase.from("customers").select("*, customer_addresses(*)").eq("phone", session.phone).maybeSingle();
  res.status(200).json({ profile: mapProfile(data, data?.customer_addresses ?? []) });
}

async function giftCard(req, res) {
  const supabase = serviceSupabase();
  if (!supabase) {
    res.status(503).json({ error: "Supabase no está configurado." });
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
  res.status(200).json({ id: data.id, orderId: order.id, orderNumber: order.number, phone: session.phone, note: data.note, status: data.status, createdAt: data.created_at });
}
