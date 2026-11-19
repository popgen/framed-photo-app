import { frames as catalogFrames } from "./catalog";
import { readStoredGiftNote, readStoredIsGift } from "./gift-note";
import { framesAvailable } from "./inventory";
import type { CustomerProfile, FrameOffer, GiftCard, InventoryItem, Order, OrderItem, Promo, SavedAddress } from "./types";

function mappedGiftNote(row: Record<string, any>) {
  const note = readStoredGiftNote(row);
  return {
    isGift: readStoredIsGift(row),
    giftNote: note?.message ?? null,
    giftNoteTo: note?.to ?? null,
    giftNoteMessage: note?.message ?? null,
    giftNoteFrom: note?.from ?? null,
    hidePrices: note?.hidePrices ?? false,
  };
}

export function mapOrderRow(row: Record<string, any>): Order {
  const items = (row.order_items ?? []).map(mapItemRow);
  return {
    id: row.id,
    userId: row.user_id ?? null,
    publicToken: row.public_token,
    number: row.number,
    status: row.status,
    customerName: row.customer_name,
    phone: row.phone,
    email: row.email,
    taxId: row.tax_id ?? null,
    taxIdType: row.tax_id_type ?? null,
    taxIdSkipped: Boolean(row.tax_id_skipped),
    recipientName: row.recipient_name,
    recipientPhone: row.recipient_phone,
    ...mappedGiftNote(row),
    giftWrap: Boolean(row.gift_wrap),
    addressLine: row.address_line,
    district: row.district,
    province: row.province,
    city: row.city,
    department: row.department,
    reference: row.reference,
    zone: row.zone,
    subtotalCents: row.subtotal_cents,
    frameDiscountCents: row.frame_discount_cents,
    frameDiscountLabel: row.frame_discount_label,
    promoCode: row.promo_code,
    promoDiscountCents: row.promo_discount_cents ?? 0,
    referralCode: row.referral_code,
    referralDiscountCents: row.referral_discount_cents ?? 0,
    creditAppliedCents: row.credit_applied_cents ?? 0,
    giftCardCode: row.gift_card_code,
    giftCardAppliedCents: row.gift_card_applied_cents ?? 0,
    giftWrapCents: row.gift_wrap_cents ?? 0,
    giftNoteCents: row.gift_note_cents ?? 0,
    totalCents: row.total_cents,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    paymentProvider: row.payment_provider,
    paymentRef: row.payment_ref,
    trackingNumber: row.tracking_number,
    christmasGuaranteed: Boolean(row.christmas_guaranteed),
    christmasNote: row.christmas_note ?? "",
    etaMin: row.eta_min,
    etaMax: row.eta_max,
    etaLabel: row.eta_label ?? "",
    referralCodeIssued: row.referral_code_issued,
    replacementFor: row.replacement_for,
    channel: row.channel ?? "web",
    needsHuman: Boolean(row.needs_human),
    items,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapItemRow(row: Record<string, any>): OrderItem {
  return {
    id: row.id,
    frameId: row.frame_id ?? "",
    photoId: row.photo_path ?? row.print_path ?? "",
    crop: row.crop,
    orientation: row.orientation ?? "portrait",
    quantity: row.quantity ?? 1,
    unitPriceCents: row.unit_price_cents,
    bundleId: row.bundle_id,
    bundleLabel: row.bundle_label,
    dpi: row.dpi ?? 0,
    resolutionStatus: row.resolution_status ?? "good",
    blurry: Boolean(row.blurry),
    blurryNote: row.blurry_note,
    textOverlay: row.text_overlay,
    card: row.card,
    voice: row.voice,
    collage: row.collage ?? null,
    photoOriginalPath: row.original_path,
    photoPrintPath: row.print_path ?? row.photo_path,
  };
}

export function mapFrameRow(row: Record<string, any>, stock: Record<string, number>): FrameOffer {
  const frame = {
    id: row.id,
    name: row.name,
    sizeLabel: row.size_label,
    tier: row.tier,
    tierLabel: row.tier_label,
    priceCents: row.price_cents,
    printWcm: Number(row.print_w_cm),
    printHcm: Number(row.print_h_cm),
    outerWcm: Number(row.outer_w_cm),
    outerHcm: Number(row.outer_h_cm),
    mouldingCm: Number(row.moulding_cm),
    aspect: row.aspect,
    material: row.material,
    mat: Boolean(row.mat),
    stand: Boolean(row.stand),
    hanging: Boolean(row.hanging),
    consumes: row.consumes ?? [],
    blurb: row.blurb ?? "",
    sort: row.sort ?? 0,
    category: row.category || catalogFrames.find((item) => item.id === row.id)?.category || undefined,
    style: row.style || catalogFrames.find((item) => item.id === row.id)?.style || undefined,
    border: row.border ?? undefined,
  };
  return { ...frame, available: framesAvailable(frame, stock) };
}

export function mapPromoRow(row: Record<string, any>): Promo {
  return {
    code: row.code,
    kind: row.kind,
    value: row.value,
    expiresAt: row.expires_at,
    maxUses: row.max_uses,
    usedCount: row.used_count ?? 0,
    active: row.active,
    note: row.note,
  };
}

export function mapInventoryRow(row: Record<string, any>): InventoryItem {
  return { sku: row.sku, name: row.name, quantity: row.quantity, lowStockAt: row.low_stock_at ?? 5 };
}

export function mapGiftRow(row: Record<string, any>): GiftCard {
  return {
    code: row.code,
    initialCents: row.initial_cents,
    balanceCents: row.balance_cents,
    buyerName: row.buyer_name ?? "",
    buyerPhone: row.buyer_phone ?? "",
    recipientName: row.recipient_name ?? "",
    recipientPhone: row.recipient_phone ?? "",
    recipientEmail: row.recipient_email,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
  };
}

export function mapProfile(row: Record<string, any> | null, addresses: Record<string, any>[] = []): CustomerProfile | null {
  if (!row) return null;
  return {
    name: row.name ?? "",
    phone: row.phone,
    email: row.email ?? "",
    addresses: addresses.map(mapAddress),
  };
}

export function mapAddress(row: Record<string, any>): SavedAddress {
  return {
    id: row.id,
    addressLine: row.address_line,
    district: row.district,
    province: row.province,
    department: row.department,
    city: row.city ?? row.district,
    reference: row.reference,
  };
}
