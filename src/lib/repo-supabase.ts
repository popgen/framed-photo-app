import { defaultCampaign, type Campaign } from "./campaign";
import { createLocalRepo } from "./repo-local";
import { getSupabase } from "./supabase";
import { frames as catalogFrames } from "./catalog";
import { mapFrameRow, mapGiftRow, mapInventoryRow, mapOrderRow, mapProfile, mapPromoRow } from "./db-map";
import { frameLowStock, framesWhenStockUnknown } from "./inventory";
import { uploadOrderPhotos } from "./photo-upload";
import { readPhoneSession } from "./phone-session";
import type { CheckoutInput, CustomerProfile, OrderStatus } from "./types";

const PATHS: Record<string, string> = {
  "otp-send": "/api/otp-send",
  "otp-verify": "/api/otp-verify",
  "orders-by-phone": "/api/track-orders",
  "orders-by-token": "/api/track-orders",
  "orders-create": "/api/create-order",
  profile: "/api/account",
  "customers-list": "/api/account",
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

export function createSupabaseRepo() {
  const local = createLocalRepo();
  const db = () => getSupabase();
  return {
    ...local,
    mode: (): "local" | "supabase" => "supabase",
    async init() {
      const { error } = await db().from("frames").select("id").limit(1);
      if (error) throw new Error(`Supabase no respondió: ${error.message}. Corre las migraciones del README.`);
      await local.init();
    },
    async adminLogin(email: string, password: string) {
      const supabase = db();
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error || !data.user) return { ok: false as const, error: error?.message ?? "No pudimos entrar." };
      const row = await supabase.from("admin_users").select("user_id").eq("user_id", data.user.id).maybeSingle();
      if (row.error || !row.data) {
        await supabase.auth.signOut();
        return { ok: false as const, error: "Esta cuenta no está autorizada como administrador." };
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
      try {
        const json = await shop("frames", {});
        if (Array.isArray(json.frames) && json.frames.length && !json.stockUncertain) return json.frames;
      } catch {
        // The shop route can be down. Fall through to a direct read, then assume stock is available.
      }
      try {
        const [{ data, error }, stock] = await Promise.all([
          db().from("frames").select("*").order("sort"),
          db().from("inventory").select("sku, quantity, low_stock_at"),
        ]);
        if (error || !data?.length) return framesWhenStockUnknown(catalogFrames);
        if (stock.error || !stock.data) {
          return data.map((row) => ({ ...mapFrameRow(row, {}), available: 99, lowStock: false, stockUncertain: true }));
        }
        const quantities = Object.fromEntries(stock.data.map((row) => [row.sku, row.quantity]));
        const lowAt = Object.fromEntries(stock.data.map((row) => [row.sku, row.low_stock_at ?? 5]));
        return data.map((row) => {
          const offer = mapFrameRow(row, quantities);
          return { ...offer, lowStock: frameLowStock(offer, quantities, lowAt), stockUncertain: false };
        });
      } catch {
        return framesWhenStockUnknown(catalogFrames);
      }
    },
    async listReviews() {
      const { data, error } = await db().from("reviews").select("*").order("sort");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    async getCampaign() {
      const { data, error } = await db().from("campaigns").select("id, config").eq("active", true).limit(1).maybeSingle();
      if (error) throw new Error(error.message);
      const config = (data?.config ?? {}) as Partial<Campaign>;
      return { ...defaultCampaign, ...config, id: config.id || data?.id || defaultCampaign.id, cardsPromo: config.cardsPromo ?? defaultCampaign.cardsPromo };
    },
    async setSeasonalMotion(on: boolean) {
      const current = await this.getCampaign();
      const { error } = await db().from("campaigns").update({ config: { ...current, seasonalMotion: on }, updated_at: new Date().toISOString() }).eq("id", current.id);
      if (error) throw new Error(error.message);
    },
    async listCustomers() {
      try {
        const { data } = await db().auth.getSession();
        const json = await shop("customers-list", {}, data.session?.access_token);
        return json.customers ?? [];
      } catch {
        return [];
      }
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
    async createGiftCard(input: Parameters<ReturnType<typeof createLocalRepo>["createGiftCard"]>[0]) {
      return shop("gift-card", input);
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
      const { data } = await db().from("credits").select("balance_cents").eq("phone", phone).maybeSingle();
      return data?.balance_cents ?? 0;
    },
    async listOrders(status?: string) {
      let query = db().from("orders").select("*, order_items(*)").order("created_at", { ascending: false });
      if (status && status !== "all") query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data ?? []).map(mapOrderRow);
    },
    async getOrder(id: string) {
      const { data, error } = await db().from("orders").select("*, order_items(*)").eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? mapOrderRow(data) : null;
    },
    async placeOrder(input: CheckoutInput) {
      const items = [];
      for (const item of input.items) {
        const photos = await uploadOrderPhotos(item.photoId);
        items.push({ ...item, photoOriginalPath: photos.original, photoPrintPath: photos.print });
      }
      return shop("orders-create", { ...input, items });
    },
    async markPaid(orderId: string, payment: { method: string; provider: string; ref: string }) {
      return shop("orders-mark-paid", { orderId, ...payment });
    },
    async listOrdersByPhone(_phone: string) {
      const session = readPhoneSession();
      if (!session) return [];
      const json = await shop("orders-by-phone", {}, session.token);
      return json.orders ?? [];
    },
    async getOrderByToken(token: string, phone: string) {
      const session = readPhoneSession();
      if (!session) return null;
      const json = await shop("orders-by-token", { token }, session.token);
      return json.order ?? null;
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
    async createClaim(input: { token: string; phone: string; note: string; photoId?: string }) {
      return shop("claim", input, readPhoneSession()?.token);
    },
    async listRetabloInquiries() {
      const { data, error } = await db().from("retablo_inquiries").select("*").order("created_at", { ascending: false });
      if (error) return local.listRetabloInquiries();
      return (data ?? []).map((row) => ({ id: row.id, size: row.size, status: row.status, createdAt: row.created_at }));
    },
    async createRetabloInquiry(size: string) {
      const clean = size.trim();
      const createdAt = new Date().toISOString();
      const { error } = await db().from("retablo_inquiries").insert({ size: clean });
      if (error) throw new Error(error.message);
      return { id: createdAt, size: clean, status: "new" as const, createdAt };
    },
    async setRetabloInquiryStatus(id: string, status: "new" | "contacted" | "closed") {
      const { error } = await db().from("retablo_inquiries").update({ status }).eq("id", id);
      if (error) throw new Error(error.message);
      return { id, size: "", status, createdAt: new Date().toISOString() };
    },
    async getProfile() {
      const session = readPhoneSession();
      if (!session) return null;
      const json = await shop("profile", { read: true }, session.token);
      return (json.profile ?? null) as CustomerProfile | null;
    },
    async saveProfile(profile: CustomerProfile) {
      const session = readPhoneSession();
      if (!session) throw new Error("Entra con el código de WhatsApp.");
      const json = await shop("profile", { profile }, session.token);
      return json.profile as CustomerProfile;
    },
    async signPhoto(path: string) {
      const { data } = await db().auth.getSession();
      const json = await shop("photos-sign", { path }, data.session?.access_token);
      return json.url as string;
    },
  };
}
