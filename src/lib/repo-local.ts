import commerceSeed from "../../data/commerce.json";
import reviews from "../../data/reviews.json";
import samples from "../../data/samples.json";
import { defaultCampaign, type Campaign } from "./campaign";
import { aspectParts, frameById, frames } from "./catalog";
import { guaranteeFor, type Zone } from "./cutoff";
import { estimateDelivery } from "./delivery";
import { notifyMode } from "./env";
import { giftCode, referralCodeFrom, uid } from "./ids";
import { priceCards } from "./cards";
import { formatOrderNumber } from "./order-number";
import { sortTracking, toTrackingCard } from "./tracking";
import { applyStock, expandNeeds, framesAvailable } from "./inventory";
import { inquiryFromSize } from "./retablo";
import { VOICE_ADDON_CENTS } from "./voice";
import { isEmail, normalizePhone } from "./phone";
import { REFERRAL_FRIEND_CENTS, REFERRAL_REWARD_CENTS, quote, type QuoteItem } from "./pricing";
import { assessResolution, centeredCrop } from "./print-size";
import { districtsFor, shippingZone } from "./zone";
import {
  blurryMessage,
  giftCardMessage,
  paidMessage,
  referralMessage,
  replacementMessage,
  statusMessage,
} from "./templates";
import {
  AppError,
  type CheckoutInput,
  type Claim,
  type FrameOffer,
  type GiftCard,
  type GiftCardDraft,
  type InventoryItem,
  type Notice,
  type Order,
  type OrderItem,
  type OrderStatus,
  type Promo,
  type Referral,
  type WaDraft,
} from "./types";

type DB = {
  inventory: InventoryItem[];
  promos: Promo[];
  giftCards: GiftCard[];
  referrals: Referral[];
  credits: Record<string, number>;
  orders: Order[];
  claims: Claim[];
  notifications: Notice[];
  campaign: Campaign;
  waDrafts: import("./types").WaDraft[];
  inquiries: import("./types").RetabloInquiry[];
  seq: number;
};

const DB_KEY = "recuerdo-db-v2";
const ADMIN_KEY = "recuerdo-admin";

let db: DB | null = null;

function stockRecord(state: DB): Record<string, number> {
  return Object.fromEntries(state.inventory.map((item) => [item.sku, item.quantity]));
}

function writeStock(state: DB, next: Record<string, number>) {
  state.inventory = state.inventory.map((item) => ({ ...item, quantity: next[item.sku] ?? item.quantity }));
}

function persist(state: DB) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(DB_KEY, JSON.stringify(state));
}

function load(): DB | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(DB_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DB;
  } catch {
    return null;
  }
}

function sampleItem(frameId: string, id: string): OrderItem {
  const frame = frameById(frameId);
  const [aw, ah] = aspectParts(frame, "portrait");
  const crop = centeredCrop(samples.sample.width, samples.sample.height, aw, ah);
  const assessed = assessResolution({
    cropWidthPx: crop.width,
    cropHeightPx: crop.height,
    printWcm: frame.printWcm,
    printHcm: frame.printHcm,
    orientation: "portrait",
  });
  return {
    id,
    frameId,
    photoId: "asset:sample",
    crop,
    orientation: "portrait",
    quantity: 1,
    unitPriceCents: frame.priceCents,
    dpi: Math.round(assessed.dpi),
    resolutionStatus: assessed.status,
    blurry: false,
    textOverlay: null,
    card: null,
    voice: null,
  };
}

function festive(zone: Zone, when: Date, campaign: Campaign) {
  const guarantee = guaranteeFor(when, zone, campaign);
  const eta = estimateDelivery(when, zone);
  return {
    christmasGuaranteed: guarantee.guaranteed,
    christmasNote: `${guarantee.headline}. ${guarantee.detail}`,
    etaMin: eta.min,
    etaMax: eta.max,
    etaLabel: eta.label,
  };
}

function seed(): DB {
  const commerce = structuredClone(commerceSeed) as unknown as Omit<DB, "orders" | "claims" | "notifications" | "campaign" | "seq" | "waDrafts" | "inquiries">;
  const campaign = structuredClone(defaultCampaign);
  const limaWhen = new Date("2026-11-17T15:00:00-05:00");
  const cuscoWhen = new Date("2026-11-16T11:00:00-05:00");
  const doneWhen = new Date("2026-11-02T11:00:00-05:00");
  const limaFestive = festive("lima", limaWhen, campaign);
  const cuscoFestive = festive("provinces", cuscoWhen, campaign);
  const doneFestive = festive("lima", doneWhen, campaign);
  const orders = [
    {
      id: "ord_seed_lima",
      publicToken: "demo-lima",
      number: "MF-26-1001",
      status: "in_review",
      customerName: "Ana Flores",
      phone: "51987654321",
      email: "ana@example.com",
      giftWrap: true,
      giftNote: "Para mamá, con todo mi cariño.",
      addressLine: "Calle Berlín 214",
      district: "Miraflores",
      province: "Lima",
      city: "Lima",
      department: "Lima",
      zone: "lima",
      subtotalCents: 5900,
      frameDiscountCents: 0,
      frameDiscountLabel: null,
      promoDiscountCents: 0,
      referralDiscountCents: 0,
      creditAppliedCents: 0,
      giftCardAppliedCents: 0,
      giftWrapCents: 1000,
      totalCents: 6900,
      paymentMethod: "yape",
      paymentStatus: "approved",
      paymentProvider: "mock",
      paymentRef: "mock_seed_lima",
      ...limaFestive,
      referralCodeIssued: "ANAF4821",
      items: [sampleItem("wood-15", "it_seed_lima")],
      createdAt: limaWhen.toISOString(),
      updatedAt: limaWhen.toISOString(),
    },
    {
      id: "ord_seed_cusco",
      publicToken: "demo-cusco",
      number: "MF-26-1002",
      status: "paid",
      customerName: "Mateo Quispe",
      phone: "51922222222",
      giftWrap: false,
      addressLine: "Av. El Sol 880",
      district: "Cusco",
      province: "Cusco",
      city: "Cusco",
      department: "Cusco",
      zone: "provinces",
      subtotalCents: 10900,
      frameDiscountCents: 0,
      frameDiscountLabel: null,
      promoDiscountCents: 0,
      referralDiscountCents: 0,
      creditAppliedCents: 0,
      giftCardAppliedCents: 0,
      giftWrapCents: 0,
      totalCents: 10900,
      paymentMethod: "card",
      paymentStatus: "approved",
      paymentProvider: "mock",
      paymentRef: "mock_seed_cusco",
      ...cuscoFestive,
      items: [sampleItem("black-30", "it_seed_cusco")],
      createdAt: cuscoWhen.toISOString(),
      updatedAt: cuscoWhen.toISOString(),
    },
    {
      id: "ord_seed_done",
      publicToken: "demo-listo",
      number: "MF-26-1003",
      status: "delivered",
      customerName: "Lucía Paredes",
      phone: "51933333333",
      giftWrap: false,
      addressLine: "Jr. Camaná 410",
      district: "Lima",
      province: "Lima",
      city: "Lima",
      department: "Lima",
      zone: "lima",
      subtotalCents: 5900,
      frameDiscountCents: 0,
      frameDiscountLabel: null,
      promoDiscountCents: 0,
      referralDiscountCents: 0,
      creditAppliedCents: 0,
      giftCardAppliedCents: 0,
      giftWrapCents: 0,
      totalCents: 5900,
      paymentMethod: "plin",
      paymentStatus: "approved",
      paymentProvider: "mock",
      paymentRef: "mock_seed_done",
      trackingNumber: "OLVA-88421",
      ...doneFestive,
      items: [sampleItem("square-black-20", "it_seed_done")],
      createdAt: doneWhen.toISOString(),
      updatedAt: doneWhen.toISOString(),
    },
  ];
  const state: DB = {
    ...commerce,
    orders: orders.map((order, index) => ({ ...order, channel: index === 1 ? ("whatsapp" as const) : ("web" as const) })) as Order[],
    claims: [
      {
        id: "clm_seed",
        orderId: "ord_seed_done",
        orderNumber: "MF-26-1003",
        phone: "51933333333",
        note: "El acrílico llegó rayado en una esquina.",
        photoId: "asset:sample",
        status: "open",
        createdAt: "2026-11-10T18:00:00-05:00",
      },
    ],
    notifications: [
      {
        id: "nt_seed",
        orderId: "ord_seed_lima",
        channel: "whatsapp",
        to: "51987654321",
        event: "paid",
        body: paidMessage(orders[0]),
        createdAt: "2026-11-17T15:01:00-05:00",
      },
    ],
    campaign,
    waDrafts: [],
    inquiries: [],
    seq: 1004,
  };
  return state;
}

async function notify(state: DB, notice: Omit<Notice, "id" | "createdAt">) {
  const row: Notice = { ...notice, id: uid("nt_"), createdAt: new Date().toISOString() };
  state.notifications.unshift(row);
  console.info(`[aviso:${row.event}]`, row.to, row.body);
  if (notifyMode() === "live" && notice.orderId) {
    const order = state.orders.find((item) => item.id === notice.orderId);
    if (order) {
      try {
        await fetch("/api/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: order.publicToken, phone: order.phone, event: notice.event, body: notice.body }),
        });
      } catch (error) {
        console.warn("No se pudo enviar el aviso", error);
      }
    }
  }
}

function priceInput(state: DB, input: CheckoutInput, phone: string | null) {
  const items: QuoteItem[] = input.items.flatMap((item) => {
    const lines: QuoteItem[] = item.card
      ? [{ unitPriceCents: priceCards(item.card.quantity).cents, quantity: 1, kind: "plain" }]
      : [{ unitPriceCents: frameById(item.frameId).priceCents, quantity: 1, kind: "frame" }];
    if (item.voice) lines.push({ unitPriceCents: item.voice.addonCents || VOICE_ADDON_CENTS, quantity: 1, kind: "plain" });
    return lines;
  });
  const promoCode = input.promoCode?.trim() || null;
  const promo = promoCode ? (state.promos.find((item) => item.code.toUpperCase() === promoCode.toUpperCase()) ?? null) : null;
  let referralDiscount: number | null = null;
  let referralError: string | null = null;
  const referralCode = input.referralCode?.trim() || "";
  if (referralCode) {
    const referral = state.referrals.find((item) => item.code.toUpperCase() === referralCode.toUpperCase());
    if (!referral) referralError = "Ese código de amigo no existe.";
    else if (phone && referral.ownerPhone === phone) referralError = "No puedes usar tu propio código.";
    else referralDiscount = referral.friendDiscountCents || REFERRAL_FRIEND_CENTS;
  }
  let giftCardError: string | null = null;
  let giftCardBalance: number | null = null;
  const giftCodeValue = input.giftCardCode?.trim() || "";
  if (giftCodeValue) {
    const card = state.giftCards.find((item) => item.code.toUpperCase() === giftCodeValue.toUpperCase());
    if (!card || card.status !== "active" || card.balanceCents <= 0) giftCardError = "Esa gift card no tiene saldo.";
    else giftCardBalance = card.balanceCents;
  }
  const priced = quote({
    items,
    giftWrap: input.giftWrap && input.items.some((item) => !item.card),
    promo,
    promoCode,
    referralDiscountCents: referralDiscount,
    referralError,
    creditAvailableCents: phone ? (state.credits[phone] ?? 0) : 0,
    useCredit: input.useCredit,
    giftCardBalanceCents: giftCardBalance,
    giftCardError,
  });
  const needs = expandNeeds(input.items.filter((item) => !item.card).map((item) => ({ consumes: frameById(item.frameId).consumes, quantity: 1 })));
  const stock = applyStock(stockRecord(state), needs);
  const stockError = stock.ok ? null : `No hay stock suficiente (${stock.missing.join(", ")}).`;
  return { priced, stockError, promo, phone };
}

function assertCheckout(input: CheckoutInput, phone: string | null) {
  if (!input.items.length) throw new AppError("Tu carrito está vacío.");
  if (input.items.some((item) => item.resolutionStatus === "low") && !input.ackLowRes) {
    throw new AppError("Confirma que aceptas la resolución baja, o elige una foto más grande.");
  }
  if (input.customerName.trim().length < 2) throw new AppError("Escribe el nombre de quien recibe el pedido.");
  if (!phone) throw new AppError("Ingresa un celular peruano de 9 dígitos.");
  if (!isEmail(input.email ?? "")) throw new AppError("Ingresa un correo válido.");
  if (!input.addressLine.trim() || !input.department.trim() || !input.province.trim() || !input.district.trim()) {
    throw new AppError("Completa la dirección y elige departamento, provincia y distrito.");
  }
  const known = districtsFor(input.department, input.province);
  if (!known.some((item) => item.toLowerCase() === input.district.trim().toLowerCase())) {
    throw new AppError("Ese distrito no corresponde a la provincia elegida.");
  }
}

function buildOrder(state: DB, input: CheckoutInput, phone: string, status: OrderStatus): Order {
  const { priced, stockError, promo } = priceInput(state, input, phone);
  if (stockError) throw new AppError(stockError);
  if (priced.promoError) throw new AppError(priced.promoError);
  if (priced.referralError) throw new AppError(priced.referralError);
  if (priced.giftCardError) throw new AppError(priced.giftCardError);
  const zone = shippingZone(input.department, input.province, input.district);
  const now = new Date();
  const fest = festive(zone, now, state.campaign);
  const number = formatOrderNumber(state.seq, now);
  state.seq += 1;
  const items: OrderItem[] = input.items.map((item) => ({
    id: uid("it_"),
    frameId: item.frameId,
    photoId: item.photoId,
    crop: item.crop,
    orientation: item.orientation,
    quantity: 1,
    unitPriceCents: item.card ? priceCards(item.card.quantity).cents : frameById(item.frameId).priceCents,
    bundleId: item.bundleId,
    bundleLabel: item.bundleLabel,
    dpi: Math.round(item.dpi),
    resolutionStatus: item.resolutionStatus,
    blurry: false,
    textOverlay: item.textOverlay ?? null,
    card: item.card ?? null,
    voice: item.voice ?? null,
  }));
  return {
    id: uid("ord_"),
    publicToken: uid("").replace(/-/g, "").slice(0, 12),
    number,
    status,
    customerName: input.customerName.trim(),
    phone,
    email: input.email?.trim() || null,
    province: input.province.trim(),
    recipientName: input.recipientName?.trim() || null,
    recipientPhone: input.recipientPhone ? normalizePhone(input.recipientPhone) : null,
    giftNote: input.giftNote?.trim() || null,
    giftWrap: input.giftWrap,
    addressLine: input.addressLine.trim(),
    district: input.district.trim(),
    city: (input.city || input.district).trim(),
    department: input.department.trim(),
    reference: input.reference?.trim() || null,
    zone,
    subtotalCents: priced.subtotalCents,
    frameDiscountCents: priced.frameDiscountCents,
    frameDiscountLabel: priced.frameDiscountLabel,
    promoCode: priced.promoDiscountCents > 0 && promo ? promo.code : null,
    promoDiscountCents: priced.promoDiscountCents,
    referralCode: priced.referralDiscountCents > 0 ? input.referralCode?.trim().toUpperCase() : null,
    referralDiscountCents: priced.referralDiscountCents,
    creditAppliedCents: priced.creditAppliedCents,
    giftCardCode: priced.giftCardAppliedCents > 0 ? input.giftCardCode?.trim().toUpperCase() : null,
    giftCardAppliedCents: priced.giftCardAppliedCents,
    giftWrapCents: priced.giftWrapCents,
    totalCents: priced.totalCents,
    paymentMethod: input.paymentMethod,
    paymentStatus: status === "pending_payment" ? "pending" : "approved",
    channel: input.channel ?? "web",
    ...fest,
    items,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

export function createLocalRepo() {
  return {
    mode: (): "local" | "supabase" => "local",
    async init() {
      const stored = load();
      db = stored?.waDrafts ? stored : seed();
      ensureCommerce(db);
      if (!stored?.waDrafts) persist(db);
    },
    async listFrames(): Promise<FrameOffer[]> {
      const state = required();
      const stock = stockRecord(state);
      return frames.map((frame) => ({ ...frame, available: framesAvailable(frame, stock) }));
    },
    async listReviews() {
      return reviews;
    },
    async getCampaign() {
      return required().campaign;
    },
    async setSeasonalMotion(on: boolean) {
      const state = required();
      state.campaign = { ...state.campaign, seasonalMotion: on };
      persist(state);
    },
    async quoteCheckout(input: CheckoutInput) {
      const state = required();
      const phone = normalizePhone(input.phone || "");
      const zone = input.department && input.province ? shippingZone(input.department, input.province, input.district || "") : ("lima" as Zone);
      const { priced, stockError } = priceInput(state, input, phone);
      return { ...priced, zone, stockError };
    },
    async placeOrder(input: CheckoutInput) {
      const state = required();
      const phone = normalizePhone(input.phone);
      assertCheckout(input, phone);
      const order = buildOrder(state, input, phone as string, "pending_payment");
      state.orders.unshift(order);
      persist(state);
      return order;
    },
    async markPaid(orderId: string, payment: { method: string; provider: string; ref: string }) {
      const state = required();
      const order = state.orders.find((item) => item.id === orderId);
      if (!order) throw new AppError("No encontramos el pedido.");
      if (order.paymentStatus === "approved") return order;
      const needs = expandNeeds(order.items.map((item) => ({ consumes: frameById(item.frameId).consumes, quantity: item.quantity })));
      const stock = applyStock(stockRecord(state), needs);
      if (!stock.ok) throw new AppError(`Sin stock al confirmar (${stock.missing.join(", ")}).`);
      writeStock(state, stock.next);
      if (order.promoCode) {
        const promo = state.promos.find((item) => item.code === order.promoCode);
        if (promo) promo.usedCount += 1;
      }
      if (order.giftCardCode && order.giftCardAppliedCents > 0) {
        const card = state.giftCards.find((item) => item.code === order.giftCardCode);
        if (card) card.balanceCents = Math.max(0, card.balanceCents - order.giftCardAppliedCents);
      }
      if (order.creditAppliedCents > 0) {
        state.credits[order.phone] = Math.max(0, (state.credits[order.phone] ?? 0) - order.creditAppliedCents);
      }
      if (order.referralCode) {
        const referral = state.referrals.find((item) => item.code === order.referralCode);
        if (referral && referral.ownerPhone !== order.phone) {
          referral.redeemedCount += 1;
          const reward = referral.referrerCreditCents || REFERRAL_REWARD_CENTS;
          state.credits[referral.ownerPhone] = (state.credits[referral.ownerPhone] ?? 0) + reward;
        }
      }
      let issued = state.referrals.find((item) => item.ownerPhone === order.phone)?.code;
      if (!issued) {
        issued = uniqueCode(state, referralCodeFrom(order.customerName));
        state.referrals.unshift({
          code: issued,
          ownerPhone: order.phone,
          ownerName: order.customerName,
          friendDiscountCents: REFERRAL_FRIEND_CENTS,
          referrerCreditCents: REFERRAL_REWARD_CENTS,
          redeemedCount: 0,
          createdAt: new Date().toISOString(),
          orderId: order.id,
        });
      }
      order.referralCodeIssued = issued;
      order.paymentMethod = payment.method;
      order.paymentProvider = payment.provider;
      order.paymentRef = payment.ref;
      order.paymentStatus = "approved";
      order.status = "paid";
      order.updatedAt = new Date().toISOString();
      await notify(state, { orderId: order.id, channel: "whatsapp", to: order.phone, event: "paid", body: paidMessage(order) });
      await notify(state, { orderId: order.id, channel: "whatsapp", to: order.phone, event: "referral", body: referralMessage(order.customerName, issued) });
      if (order.email) {
        await notify(state, { orderId: order.id, channel: "email", to: order.email, event: "paid", body: paidMessage(order) });
      }
      persist(state);
      return order;
    },
    async getOrder(id: string) {
      return required().orders.find((item) => item.id === id) ?? null;
    },
    async listOrdersByPhone(phone: string) {
      const normalized = normalizePhone(phone);
      if (!normalized) return [];
      return sortTracking(required().orders.filter((item) => item.phone === normalized).map(toTrackingCard));
    },
    async getOrderByToken(token: string, phone: string) {
      const normalized = normalizePhone(phone);
      if (!normalized) return null;
      return required().orders.find((item) => item.publicToken === token && item.phone === normalized) ?? null;
    },
    async listOrders(status?: string) {
      return required().orders.filter((item) => !status || status === "all" || item.status === status);
    },
    async setStatus(id: string, status: OrderStatus) {
      const state = required();
      const order = mustOrder(state, id);
      if (status === "shipped" && !order.trackingNumber) throw new AppError("Ingresa el número de guía antes de marcarlo en camino.");
      order.status = status;
      order.updatedAt = new Date().toISOString();
      await notify(state, { orderId: order.id, channel: "whatsapp", to: order.phone, event: "status", body: statusMessage(order, status) });
      persist(state);
      return order;
    },
    async flagBlurry(orderId: string, itemId: string, note: string) {
      const state = required();
      const order = mustOrder(state, orderId);
      const item = order.items.find((entry) => entry.id === itemId);
      if (!item) throw new AppError("No encontramos esa foto.");
      item.blurry = true;
      item.blurryNote = note.trim() || "La foto se ve borrosa para imprimir.";
      order.status = "in_review";
      order.updatedAt = new Date().toISOString();
      await notify(state, { orderId: order.id, channel: "whatsapp", to: order.phone, event: "blurry", body: blurryMessage(order, item.blurryNote) });
      persist(state);
      return order;
    },
    async setTracking(id: string, tracking: string) {
      const state = required();
      const order = mustOrder(state, id);
      if (!tracking.trim()) throw new AppError("Escribe el número de guía.");
      order.trackingNumber = tracking.trim();
      order.status = "shipped";
      order.updatedAt = new Date().toISOString();
      await notify(state, { orderId: order.id, channel: "whatsapp", to: order.phone, event: "tracking", body: statusMessage(order, "shipped") });
      persist(state);
      return order;
    },
    async listInventory() {
      return required().inventory;
    },
    async setInventory(sku: string, quantity: number) {
      const state = required();
      const item = state.inventory.find((entry) => entry.sku === sku);
      if (!item) throw new AppError("SKU desconocido.");
      item.quantity = Math.max(0, Math.round(quantity));
      persist(state);
    },
    async listPromos() {
      return required().promos;
    },
    async savePromo(promo: Promo) {
      const state = required();
      const code = promo.code.trim().toUpperCase();
      if (!code) throw new AppError("El código es obligatorio.");
      const next = { ...promo, code };
      const index = state.promos.findIndex((item) => item.code === code);
      if (index >= 0) state.promos[index] = next;
      else state.promos.unshift(next);
      persist(state);
    },
    async listGiftCards() {
      return required().giftCards;
    },
    async createGiftCard(input: GiftCardDraft) {
      const state = required();
      const buyer = normalizePhone(input.buyerPhone);
      const recipient = normalizePhone(input.recipientPhone);
      if (!buyer || !recipient) throw new AppError("Revisa los celulares. Deben ser números peruanos.");
      if (input.amountCents < 3000 || input.amountCents > 50000) throw new AppError("La gift card va de S/ 30 a S/ 500.");
      const card: GiftCard = {
        code: giftCode(),
        initialCents: input.amountCents,
        balanceCents: input.amountCents,
        buyerName: input.buyerName.trim(),
        buyerPhone: buyer,
        recipientName: input.recipientName.trim() || "Alguien especial",
        recipientPhone: recipient,
        recipientEmail: input.recipientEmail?.trim() || null,
        message: input.message?.trim() || null,
        status: "active",
        createdAt: new Date().toISOString(),
      };
      state.giftCards.unshift(card);
      await notify(state, { channel: "whatsapp", to: recipient, event: "gift_card", body: giftCardMessage(card) });
      if (card.recipientEmail) {
        await notify(state, { channel: "email", to: card.recipientEmail, event: "gift_card", body: giftCardMessage(card) });
      }
      persist(state);
      return card;
    },
    async listReferrals() {
      return required().referrals;
    },
    async creditBalance(phone: string) {
      const normalized = normalizePhone(phone);
      if (!normalized) return 0;
      return required().credits[normalized] ?? 0;
    },
    async createClaim(input: { token: string; phone: string; note: string; photoId?: string }) {
      const state = required();
      const order = await this.getOrderByToken(input.token, input.phone);
      if (!order) throw new AppError("No coincide el pedido con ese celular.");
      if (!input.note.trim()) throw new AppError("Cuéntanos qué llegó dañado.");
      const claim: Claim = {
        id: uid("clm_"),
        orderId: order.id,
        orderNumber: order.number,
        phone: order.phone,
        note: input.note.trim(),
        photoId: input.photoId,
        status: "open",
        createdAt: new Date().toISOString(),
      };
      state.claims.unshift(claim);
      persist(state);
      return claim;
    },
    async listClaims() {
      return required().claims;
    },
    async startRemake(claimId: string) {
      const state = required();
      const claim = state.claims.find((item) => item.id === claimId);
      if (!claim) throw new AppError("No encontramos el reclamo.");
      const source = mustOrder(state, claim.orderId);
      const needs = expandNeeds(source.items.map((item) => ({ consumes: frameById(item.frameId).consumes, quantity: item.quantity })));
      const stock = applyStock(stockRecord(state), needs);
      if (!stock.ok) throw new AppError(`No hay stock para la reposición (${stock.missing.join(", ")}).`);
      writeStock(state, stock.next);
      const now = new Date();
      const fest = festive(source.zone, now, state.campaign);
      const replacement: Order = {
        ...source,
        id: uid("ord_"),
        publicToken: uid("").replace(/-/g, "").slice(0, 12),
        number: formatOrderNumber(state.seq),
        status: "in_review",
        subtotalCents: 0,
        frameDiscountCents: 0,
        frameDiscountLabel: "Reposición sin costo",
        promoCode: null,
        promoDiscountCents: 0,
        referralCode: null,
        referralDiscountCents: 0,
        creditAppliedCents: 0,
        giftCardCode: null,
        giftCardAppliedCents: 0,
        giftWrapCents: 0,
        totalCents: 0,
        paymentMethod: "replacement",
        paymentStatus: "approved",
        paymentProvider: "remake",
        paymentRef: claim.id,
        trackingNumber: null,
        referralCodeIssued: null,
        replacementFor: source.id,
        items: source.items.map((item) => ({ ...item, id: uid("it_"), blurry: false, blurryNote: null })),
        ...fest,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      state.seq += 1;
      state.orders.unshift(replacement);
      claim.status = "remaking";
      claim.replacementOrderId = replacement.id;
      await notify(state, { orderId: replacement.id, channel: "whatsapp", to: replacement.phone, event: "replacement", body: replacementMessage(replacement) });
      persist(state);
      return claim;
    },
    async listNotifications(orderId?: string) {
      return required().notifications.filter((item) => !orderId || item.orderId === orderId);
    },
    async adminLogin(email: string, password: string) {
      const { demoAdmin } = await import("./env");
      const demo = demoAdmin();
      const ok = email.trim().toLowerCase() === demo.email.toLowerCase() && password === demo.password;
      if (typeof localStorage !== "undefined") localStorage.setItem(ADMIN_KEY, ok ? "1" : "0");
      return ok ? { ok: true } : { ok: false, error: "Correo o contraseña incorrectos." };
    },
    async adminLogout() {
      if (typeof localStorage !== "undefined") localStorage.setItem(ADMIN_KEY, "0");
    },
    async adminSession() {
      if (typeof localStorage === "undefined") return false;
      return localStorage.getItem(ADMIN_KEY) === "1";
    },
    async saveWhatsAppDraft(draft: WaDraft) {
      const state = required();
      const index = state.waDrafts.findIndex((item) => item.token === draft.token);
      if (index >= 0) state.waDrafts[index] = draft;
      else state.waDrafts.unshift(draft);
      persist(state);
      return draft;
    },
    async getWhatsAppDraft(token: string) {
      return required().waDrafts.find((item) => item.token === token) ?? null;
    },
    async createWhatsAppOrder(draft: WaDraft) {
      const state = required();
      const phone = normalizePhone(draft.phone) ?? draft.phone;
      const chosen = draft.frameId || "wood-15";
      const items = draft.photos.map((photo, index) => {
        const frame = frameById(draft.mode === "wall" ? wallFrame(index, draft.photos.length) : chosen);
        const [aw, ah] = aspectParts(frame, "portrait");
        const crop = centeredCrop(photo.width, photo.height, aw, ah);
        const assessed = assessResolution({
          cropWidthPx: crop.width,
          cropHeightPx: crop.height,
          printWcm: frame.printWcm,
          printHcm: frame.printHcm,
          orientation: "portrait",
          alternatives: frames.map((item) => ({ id: item.id, label: item.sizeLabel, printWcm: item.printWcm, printHcm: item.printHcm })),
        });
        return {
          frameId: frame.id,
          photoId: photo.photoId,
          crop,
          orientation: "portrait" as const,
          dpi: Math.round(assessed.dpi),
          resolutionStatus: assessed.status,
          bundleId: draft.mode === "wall" ? draft.token : null,
          bundleLabel: draft.mode === "wall" ? "Muro de WhatsApp" : null,
        };
      });
      const input: CheckoutInput = {
        items,
        customerName: "Cliente WhatsApp",
        phone,
        giftWrap: false,
        addressLine: "Por confirmar en el enlace",
        district: "Miraflores",
        province: "Lima",
        city: "Lima",
        department: "Lima",
        paymentMethod: "yape",
        ackLowRes: true,
        useCredit: false,
        channel: "whatsapp",
      };
      const order = buildOrder(state, input, phone, "pending_payment");
      order.needsHuman = draft.needsHuman;
      state.orders.unshift(order);
      const next = { ...draft, orderId: order.id, phone };
      const index = state.waDrafts.findIndex((item) => item.token === draft.token);
      if (index >= 0) state.waDrafts[index] = next;
      else state.waDrafts.unshift(next);
      await notify(state, {
        orderId: order.id,
        channel: "whatsapp",
        to: phone,
        event: "whatsapp_draft",
        body: `Armamos tu pedido ${order.number} por WhatsApp. Ábrelo aquí para ver la foto en el marco y pagar.`,
      });
      persist(state);
      return order;
    },
    async updatePendingOrder(orderId: string, input: CheckoutInput) {
      const state = required();
      const existing = mustOrder(state, orderId);
      if (existing.paymentStatus === "approved") return existing;
      const phone = normalizePhone(input.phone);
      assertCheckout(input, phone);
      const rebuilt = buildOrder(state, { ...input, channel: existing.channel }, phone as string, "pending_payment");
      state.seq -= 1;
      const order: Order = {
        ...rebuilt,
        id: existing.id,
        publicToken: existing.publicToken,
        number: existing.number,
        channel: existing.channel,
        needsHuman: existing.needsHuman,
        createdAt: existing.createdAt,
      };
      const index = state.orders.findIndex((item) => item.id === orderId);
      state.orders[index] = order;
      persist(state);
      return order;
    },
    async listRetabloInquiries() {
      return required().inquiries ?? [];
    },
    async createRetabloInquiry(size: string) {
      const state = required();
      const row = { ...inquiryFromSize(size), id: uid("ret_") };
      state.inquiries = [row, ...(state.inquiries ?? [])];
      persist(state);
      return row;
    },
    async setRetabloInquiryStatus(id: string, status: "new" | "contacted" | "closed") {
      const state = required();
      const row = (state.inquiries ?? []).find((item) => item.id === id);
      if (!row) throw new AppError("No encontramos la consulta.");
      row.status = status;
      persist(state);
      return row;
    },
    async getProfile() {
      if (typeof localStorage === "undefined") return null;
      const raw = localStorage.getItem("recuerdo-profile");
      if (!raw) return null;
      try {
        return JSON.parse(raw) as import("./types").CustomerProfile;
      } catch {
        return null;
      }
    },
    async saveProfile(profile: import("./types").CustomerProfile) {
      if (typeof localStorage !== "undefined") localStorage.setItem("recuerdo-profile", JSON.stringify(profile));
      return profile;
    },
    async signPhoto(_path: string): Promise<string> {
      throw new AppError("Las fotos de imprenta se abren con Supabase.");
    },
    async resetDemo() {
      db = seed();
      persist(db);
      if (typeof localStorage !== "undefined") localStorage.setItem(ADMIN_KEY, "0");
    },
  };
}

function ensureCommerce(state: DB) {
  const skus = new Set(state.inventory.map((item) => item.sku));
  for (const item of commerceSeed.inventory) {
    if (!skus.has(item.sku)) state.inventory.push(structuredClone(item));
  }
  if (!state.inquiries) state.inquiries = [];
}

function required(): DB {
  if (!db) throw new AppError("Los datos todavía no están listos.");
  return db;
}

function mustOrder(state: DB, id: string): Order {
  const order = state.orders.find((item) => item.id === id);
  if (!order) throw new AppError("No encontramos el pedido.");
  return order;
}

function wallFrame(index: number, count: number): string {
  if (count >= 4) return "square-black-20";
  if (count === 3 && index === 1) return "black-30";
  return "wood-15";
}

function uniqueCode(state: DB, base: string): string {
  let code = base;
  let guard = 0;
  while (state.referrals.some((item) => item.code === code) && guard < 8) {
    code = referralCodeFrom(base);
    guard += 1;
  }
  return code;
}
