import { aspectParts, frameById, frames } from "./catalog";
import { defaultCampaign, type Campaign } from "./campaign";
import { mapFrameRow, mapGiftRow, mapInventoryRow, mapOrderRow, mapPromoRow } from "./db-map";
import { AppError, type CheckoutInput, type CustomerProfile, type CustomerRow, type Order, type OrderStatus, type WaDraft } from "./types";
import { uploadOrderPhotos } from "./photo-upload";
import { readPhoneSession } from "./phone-session";
import { assessResolution, centeredCrop } from "./print-size";
import { quote } from "./pricing";
import { normalizePhone } from "./phone";
import { getSupabase } from "./supabase";

const PATHS: Record<string, string> = {
  "orders-preview": "/api/create-order",
  "orders-create": "/api/create-order",
  "orders-update": "/api/create-order",
  "orders-mark-paid": "/api/mark-paid",
  "orders-by-phone": "/api/track-orders",
  "orders-by-token": "/api/track-orders",
  profile: "/api/account",
  "photos-sign": "/api/sign-photo",
  claim: "/api/claim",
  "gift-card": "/api/gift-card",
};

async function shop(op: string, body: unknown, auth?: string | null) {
  const response = await fetch(PATHS[op] || `/api/shop?op=${op}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(auth ? { authorization: `Bearer ${auth}` } : {}) },
    body: JSON.stringify(body ?? {}),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error || "El servidor no respondió.");
  return json;
}

function mapCampaign(row: { id?: string; config?: Partial<Campaign> } | null): Campaign {
  const config = row?.config ?? {};
  return {
    ...defaultCampaign,
    ...config,
    id: config.id || row?.id || defaultCampaign.id,
    cardsPromo: config.cardsPromo ?? defaultCampaign.cardsPromo,
  };
}

function receipt(input: CheckoutInput, priced: Record<string, any>, token: string): Order {
  const now = new Date().toISOString();
  return {
    id: token,
    publicToken: token,
    number: "",
    status: "pending_payment",
    customerName: input.customerName,
    phone: normalizePhone(input.phone) || input.phone,
    email: input.email ?? null,
    recipientName: input.recipientName ?? null,
    recipientPhone: input.recipientPhone ?? null,
    giftNote: input.giftNote ?? null,
    giftWrap: input.giftWrap,
    addressLine: input.addressLine,
    district: input.district,
    province: input.province,
    city: input.city,
    department: input.department,
    reference: input.reference ?? null,
    zone: priced.zone ?? "lima",
    subtotalCents: priced.subtotalCents ?? 0,
    frameDiscountCents: priced.frameDiscountCents ?? 0,
    frameDiscountLabel: priced.frameDiscountLabel ?? null,
    promoCode: input.promoCode ?? null,
    promoDiscountCents: priced.promoDiscountCents ?? 0,
    referralCode: input.referralCode ?? null,
    referralDiscountCents: priced.referralDiscountCents ?? 0,
    creditAppliedCents: priced.creditAppliedCents ?? 0,
    giftCardCode: input.giftCardCode ?? null,
    giftCardAppliedCents: priced.giftCardAppliedCents ?? 0,
    giftWrapCents: priced.giftWrapCents ?? 0,
    totalCents: priced.totalCents ?? 0,
    paymentMethod: input.paymentMethod,
    paymentStatus: "pending",
    paymentProvider: null,
    paymentRef: null,
    trackingNumber: null,
    christmasGuaranteed: Boolean(priced.christmasGuaranteed),
    christmasNote: priced.christmasNote ?? "",
    etaMin: priced.etaMin ?? now.slice(0, 10),
    etaMax: priced.etaMax ?? now.slice(0, 10),
    etaLabel: priced.etaLabel ?? "",
    referralCodeIssued: null,
    replacementFor: null,
    channel: input.channel ?? "web",
    items: input.items.map((item, index) => ({
      id: `${token}-${index}`,
      frameId: item.frameId,
      photoId: item.photoPrintPath || item.photoId,
      crop: item.crop,
      orientation: item.orientation,
      quantity: 1,
      unitPriceCents: 0,
      bundleId: item.bundleId,
      bundleLabel: item.bundleLabel,
      dpi: item.dpi,
      resolutionStatus: item.resolutionStatus,
      blurry: false,
      textOverlay: item.textOverlay,
      card: item.card,
      voice: item.voice,
      photoOriginalPath: item.photoOriginalPath,
      photoPrintPath: item.photoPrintPath,
    })),
    createdAt: now,
    updatedAt: now,
  };
}

function wallFrame(index: number, count: number): string {
  if (count >= 4) return "square-black-20";
  if (count === 3 && index === 1) return "black-30";
  return "wood-15";
}

export function createSupabaseRepo() {
  const db = () => getSupabase();
  return {
    mode: (): "local" | "supabase" => "supabase",
    async init() {
      const { error } = await db().from("frames").select("id").limit(1);
      if (error) throw new Error(`Supabase no respondió: ${error.message}`);
    },
    async adminLogin(email: string, password: string) {
      const supabase = db();
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error || !data.user) return { ok: false as const, error: error?.message ?? "No pudimos entrar." };
      const row = await supabase.from("admin_users").select("user_id").eq("user_id", data.user.id).maybeSingle();
      if (row.error || !row.data) {
        await supabase.auth.signOut();
        return { ok: false as const, error: "Esta cuenta no está en admin_users. Entra una vez y pide que agreguen tu usuario." };
      }
      return { ok: true as const };
    },
    async adminLogout() {
      await db().auth.signOut();
    },
    async adminSession() {
      const { data } = await db().auth.getSession();
      return Boolean(data.session);
    },
    async listFrames() {
      const { data, error } = await db().from("frames").select("*").order("sort");
      if (error) throw new Error(error.message);
      const stockRpc = await db().rpc("public_stock");
      const stock = stockRpc.error ? {} : Object.fromEntries((stockRpc.data ?? []).map((row: { sku: string; quantity: number }) => [row.sku, row.quantity]));
      return (data ?? []).map((row) => mapFrameRow(row, stock));
    },
    async listReviews() {
      const { data, error } = await db().from("reviews").select("*").order("sort");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    async getCampaign() {
      const { data, error } = await db().from("campaigns").select("id, config").eq("active", true).limit(1).maybeSingle();
      if (error) throw new Error(error.message);
      return mapCampaign(data);
    },
    async setSeasonalMotion(on: boolean) {
      const current = await this.getCampaign();
      const { error } = await db().from("campaigns").update({ config: { ...current, seasonalMotion: on }, updated_at: new Date().toISOString() }).eq("id", current.id);
      if (error) throw new Error(error.message);
    },
    async quoteCheckout(input: CheckoutInput) {
      const empty = { ...quote({ items: [] }), zone: "lima" as const, stockError: null as string | null, promoError: null as string | null, referralError: null as string | null, giftCardError: null as string | null };
      if (!input.items.length) return empty;
      try {
        return await shop("orders-preview", { ...input, preview: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : "No pudimos cotizar.";
        const stock = /stock/i.test(message);
        return { ...empty, stockError: stock ? message : null, promoError: stock ? null : message };
      }
    },
    async placeOrder(input: CheckoutInput) {
      const priced = await this.quoteCheckout(input);
      const problem = priced.promoError || priced.referralError || priced.giftCardError || priced.stockError;
      if (problem) throw new AppError(problem);
      const items = [];
      for (const item of input.items) {
        const photos = await uploadOrderPhotos(item.photoId);
        items.push({ ...item, photoPrintPath: photos.print || item.photoPrintPath || item.voice?.storagePath || null, photoOriginalPath: photos.original });
      }
      const created = await shop("orders-create", { ...input, items });
      return receipt({ ...input, items }, priced, created.token);
    },
    async markPaid(orderId: string, payment: { method: string; provider: string; ref: string }) {
      return shop("orders-mark-paid", { token: orderId, ...payment });
    },
    async updatePendingOrder(orderId: string, input: CheckoutInput) {
      const priced = await this.quoteCheckout(input);
      const items = [];
      for (const item of input.items) {
        const photos = item.photoPrintPath ? { print: item.photoPrintPath, original: item.photoOriginalPath ?? null } : await uploadOrderPhotos(item.photoId);
        items.push({ ...item, photoPrintPath: photos.print, photoOriginalPath: photos.original });
      }
      const updated = await shop("orders-update", { ...input, items, orderToken: orderId });
      return receipt({ ...input, items }, priced, updated.token);
    },
    async getOrder(id: string) {
      const { data, error } = await db().from("orders").select("*, order_items(*)").eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? mapOrderRow(data) : null;
    },
    async listOrdersByPhone(_phone: string) {
      const session = readPhoneSession();
      if (!session) return [];
      const json = await shop("orders-by-phone", {}, session.token);
      return json.orders ?? [];
    },
    async getOrderByToken(token: string, _phone: string) {
      const session = readPhoneSession();
      if (!session) return null;
      const json = await shop("orders-by-token", { token }, session.token);
      return json.order ?? null;
    },
    async listOrders(status?: string) {
      let query = db().from("orders").select("*, order_items(*)").order("created_at", { ascending: false });
      if (status && status !== "all") query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data ?? []).map(mapOrderRow);
    },
    async setStatus(id: string, status: OrderStatus) {
      const { error } = await db().from("orders").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw new Error(error.message);
      return (await this.getOrder(id))!;
    },
    async setTracking(id: string, tracking: string) {
      const { error } = await db().from("orders").update({ tracking_number: tracking, status: "shipped", updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw new Error(error.message);
      return (await this.getOrder(id))!;
    },
    async flagBlurry(orderId: string, itemId: string, note: string) {
      await db().from("order_items").update({ blurry: true, blurry_note: note }).eq("id", itemId);
      await db().from("orders").update({ status: "in_review", updated_at: new Date().toISOString() }).eq("id", orderId);
      return (await this.getOrder(orderId))!;
    },
    async listInventory() {
      const { data, error } = await db().from("inventory").select("*").order("sku");
      if (error) throw new Error(error.message);
      return (data ?? []).map(mapInventoryRow);
    },
    async setInventory(sku: string, quantity: number) {
      const { error } = await db().from("inventory").update({ quantity }).eq("sku", sku);
      if (error) throw new Error(error.message);
    },
    async listPromos() {
      const { data, error } = await db().from("promo_codes").select("*");
      if (error) throw new Error(error.message);
      return (data ?? []).map(mapPromoRow);
    },
    async savePromo(promo: { code: string; kind: "percent" | "fixed"; value: number; expiresAt?: string | null; maxUses?: number | null; active: boolean; note?: string | null; usedCount: number }) {
      const { error } = await db().from("promo_codes").upsert({
        code: promo.code,
        kind: promo.kind,
        value: promo.value,
        expires_at: promo.expiresAt ?? null,
        max_uses: promo.maxUses ?? null,
        used_count: promo.usedCount,
        active: promo.active,
        note: promo.note ?? null,
      });
      if (error) throw new Error(error.message);
    },
    async listGiftCards() {
      const { data, error } = await db().from("gift_cards").select("*").order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map(mapGiftRow);
    },
    async createGiftCard(input: { amountCents: number; buyerName: string; buyerPhone: string; recipientName: string; recipientPhone: string; recipientEmail?: string; message?: string }) {
      const { data } = await db().auth.getSession();
      return shop("gift-card", input, data.session?.access_token);
    },
    async listReferrals() {
      const { data, error } = await db().from("referrals").select("*");
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        code: row.code,
        ownerPhone: row.owner_phone,
        ownerName: row.owner_name ?? "",
        friendDiscountCents: row.friend_discount_cents,
        referrerCreditCents: row.referrer_credit_cents,
        redeemedCount: row.redeemed_count,
        createdAt: row.created_at,
        orderId: row.order_id,
      }));
    },
    async creditBalance(phone: string) {
      const session = readPhoneSession();
      if (!session || session.phone !== (normalizePhone(phone) || phone)) return 0;
      const json = await shop("profile", { read: true }, session.token);
      return json.creditCents ?? 0;
    },
    async createClaim(input: { token: string; phone: string; note: string; photoId?: string }) {
      return shop("claim", input, readPhoneSession()?.token);
    },
    async listClaims() {
      const { data, error } = await db().from("claims").select("*, orders(number)").order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        id: row.id,
        orderId: row.order_id,
        orderNumber: row.orders?.number,
        phone: row.phone,
        note: row.note ?? "",
        photoId: row.photo_path,
        status: row.status,
        replacementOrderId: row.replacement_order_id,
        createdAt: row.created_at,
      }));
    },
    async startRemake(claimId: string) {
      const claims = await this.listClaims();
      const claim = claims.find((item) => item.id === claimId);
      if (!claim) throw new AppError("No encontramos el reclamo.");
      const source = await this.getOrder(claim.orderId);
      if (!source) throw new AppError("No encontramos el pedido.");
      const { data, error } = await db().from("orders").insert({
        status: "in_review",
        customer_name: source.customerName,
        phone: source.phone,
        email: source.email,
        recipient_name: source.recipientName,
        recipient_phone: source.recipientPhone,
        gift_note: source.giftNote,
        gift_wrap: false,
        address_line: source.addressLine,
        district: source.district,
        province: source.province,
        city: source.city,
        department: source.department,
        reference: source.reference,
        zone: source.zone,
        subtotal_cents: 0,
        frame_discount_cents: 0,
        frame_discount_label: "Reposición sin costo",
        total_cents: 0,
        payment_method: "replacement",
        payment_status: "approved",
        payment_provider: "remake",
        payment_ref: claimId,
        christmas_guaranteed: source.christmasGuaranteed,
        christmas_note: source.christmasNote,
        eta_min: source.etaMin,
        eta_max: source.etaMax,
        eta_label: source.etaLabel,
        replacement_for: source.id,
        channel: source.channel,
      }).select("id").single();
      if (error || !data) throw new AppError(error?.message || "No pudimos reponer.");
      if (source.items.length) {
        await db().from("order_items").insert(source.items.map((item) => ({
          order_id: data.id,
          frame_id: item.card?.sizeId || item.frameId,
          photo_path: item.photoPrintPath || item.photoId,
          crop: item.crop ?? {},
          orientation: item.orientation,
          quantity: item.quantity,
          unit_price_cents: 0,
          dpi: item.dpi,
          resolution_status: item.resolutionStatus,
          text_overlay: item.textOverlay ?? null,
          card: item.card ?? null,
          voice: item.voice ?? null,
        })));
      }
      await db().from("claims").update({ status: "remaking", replacement_order_id: data.id }).eq("id", claimId);
      return { ...claim, status: "remaking" as const, replacementOrderId: data.id };
    },
    async listNotifications(orderId?: string) {
      let query = db().from("notification_log").select("*").order("created_at", { ascending: false });
      if (orderId) query = query.eq("order_id", orderId);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        id: row.id,
        orderId: row.order_id,
        channel: row.channel,
        to: row.to_address,
        body: row.body,
        event: row.event ?? "",
        createdAt: row.created_at,
      }));
    },
    async listCustomers(): Promise<CustomerRow[]> {
      const { data, error } = await db().from("customers").select("id, name, phone, email, created_at").order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({ id: row.id, name: row.name ?? "", phone: row.phone, email: row.email ?? "", createdAt: row.created_at }));
    },
    async saveWhatsAppDraft(draft: WaDraft) {
      const { error } = await db().from("wa_events").insert({ phone: draft.phone, token: draft.token, payload: draft });
      if (error) throw new Error(error.message);
      return draft;
    },
    async getWhatsAppDraft(token: string) {
      const { data } = await db().from("wa_events").select("payload").eq("token", token).order("created_at", { ascending: false }).limit(1).maybeSingle();
      return (data?.payload as WaDraft | undefined) ?? null;
    },
    async createWhatsAppOrder(draft: WaDraft) {
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
      const order = await this.placeOrder({
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
      });
      await this.saveWhatsAppDraft({ ...draft, orderId: order.id, phone });
      return { ...order, needsHuman: draft.needsHuman };
    },
    async listRetabloInquiries() {
      const { data, error } = await db().from("retablo_inquiries").select("*").order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({ id: row.id, size: row.size, status: row.status, createdAt: row.created_at }));
    },
    async createRetabloInquiry(size: string) {
      const clean = size.trim().slice(0, 80);
      const { data, error } = await db().from("retablo_inquiries").insert({ size: clean }).select("*").single();
      if (error || !data) throw new AppError(error?.message || "No pudimos guardar la consulta.");
      return { id: data.id, size: data.size, status: data.status, createdAt: data.created_at };
    },
    async setRetabloInquiryStatus(id: string, status: "new" | "contacted" | "closed") {
      const { data, error } = await db().from("retablo_inquiries").update({ status }).eq("id", id).select("*").single();
      if (error || !data) throw new AppError(error?.message || "No pudimos actualizar.");
      return { id: data.id, size: data.size, status: data.status, createdAt: data.created_at };
    },
    async getProfile() {
      const session = readPhoneSession();
      if (!session) return null;
      const json = await shop("profile", { read: true }, session.token);
      return (json.profile ?? null) as CustomerProfile | null;
    },
    async saveProfile(profile: CustomerProfile) {
      const session = readPhoneSession();
      if (!session) throw new AppError("Entra con el código de WhatsApp.");
      const json = await shop("profile", { profile }, session.token);
      return json.profile as CustomerProfile;
    },
    async signPhoto(path: string) {
      const { data } = await db().auth.getSession();
      const json = await shop("photos-sign", { path }, data.session?.access_token);
      return json.url as string;
    },
    async resetDemo() {
      await db().auth.signOut();
    },
  };
}
