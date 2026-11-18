import type { CardSnapshot } from "./cards";
import type { FrameDef } from "./catalog";
import type { Zone } from "./cutoff";
import type { TextOverlay } from "./overlay";
import type { Crop, Orientation, ResolutionStatus } from "./print-size";
import type { PromoRule } from "./pricing";
import type { VoiceNote } from "./voice";

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "in_review"
  | "printed"
  | "framed"
  | "shipped"
  | "delivered"
  | "cancelled";

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Por pagar",
  paid: "Pagado",
  in_review: "En revisión",
  printed: "Impreso",
  framed: "Enmarcado",
  shipped: "En camino",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

export const STATUS_FLOW: OrderStatus[] = ["paid", "in_review", "printed", "framed", "shipped", "delivered"];

export type OrderItem = {
  id: string;
  frameId: string;
  photoId: string;
  crop: Crop;
  orientation: Orientation;
  quantity: number;
  unitPriceCents: number;
  bundleId?: string | null;
  bundleLabel?: string | null;
  dpi: number;
  resolutionStatus: ResolutionStatus;
  blurry: boolean;
  blurryNote?: string | null;
  textOverlay?: TextOverlay | null;
  card?: CardSnapshot | null;
  voice?: VoiceNote | null;
  photoOriginalPath?: string | null;
  photoPrintPath?: string | null;
};

export type Order = {
  id: string;
  publicToken: string;
  number: string;
  status: OrderStatus;
  customerName: string;
  phone: string;
  email?: string | null;
  taxId?: string | null;
  taxIdType?: "DNI" | "RUC" | null;
  recipientName?: string | null;
  recipientPhone?: string | null;
  giftNote?: string | null;
  giftWrap: boolean;
  addressLine: string;
  district: string;
  province: string;
  city: string;
  department: string;
  reference?: string | null;
  zone: Zone;
  subtotalCents: number;
  frameDiscountCents: number;
  frameDiscountLabel: string | null;
  promoCode?: string | null;
  promoDiscountCents: number;
  referralCode?: string | null;
  referralDiscountCents: number;
  creditAppliedCents: number;
  giftCardCode?: string | null;
  giftCardAppliedCents: number;
  giftWrapCents: number;
  totalCents: number;
  paymentMethod?: string | null;
  paymentStatus: "pending" | "approved" | "rejected";
  paymentProvider?: string | null;
  paymentRef?: string | null;
  trackingNumber?: string | null;
  christmasGuaranteed: boolean;
  christmasNote: string;
  etaMin: string;
  etaMax: string;
  etaLabel: string;
  referralCodeIssued?: string | null;
  replacementFor?: string | null;
  channel: "web" | "whatsapp";
  needsHuman?: boolean;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
};

export type Promo = PromoRule & { note?: string | null };

export type InventoryItem = {
  sku: string;
  name: string;
  quantity: number;
  lowStockAt: number;
};

export type GiftCard = {
  code: string;
  initialCents: number;
  balanceCents: number;
  buyerName: string;
  buyerPhone: string;
  recipientName: string;
  recipientPhone: string;
  recipientEmail?: string | null;
  message?: string | null;
  status: "active" | "void";
  createdAt: string;
};

export type Referral = {
  code: string;
  ownerPhone: string;
  ownerName: string;
  friendDiscountCents: number;
  referrerCreditCents: number;
  redeemedCount: number;
  createdAt: string;
  orderId?: string | null;
};

export type Claim = {
  id: string;
  orderId: string;
  orderNumber?: string;
  phone: string;
  note: string;
  photoId?: string | null;
  status: "open" | "remaking" | "closed";
  replacementOrderId?: string | null;
  createdAt: string;
};

export type SavedAddress = {
  id: string;
  addressLine: string;
  district: string;
  province: string;
  department: string;
  city: string;
  reference?: string | null;
};

export type CustomerProfile = {
  name: string;
  phone: string;
  email: string;
  addresses: SavedAddress[];
};

export type RetabloInquiry = {
  id: string;
  size: string;
  status: "new" | "contacted" | "closed";
  createdAt: string;
};

export type Notice = {
  id: string;
  orderId?: string | null;
  channel: "whatsapp" | "email";
  to: string;
  body: string;
  event: string;
  createdAt: string;
};

export type CheckoutInput = {
  items: {
    frameId: string;
    photoId: string;
    crop: Crop;
    orientation: Orientation;
    dpi: number;
    resolutionStatus: ResolutionStatus;
    bundleId?: string | null;
    bundleLabel?: string | null;
    textOverlay?: TextOverlay | null;
    card?: CardSnapshot | null;
    voice?: VoiceNote | null;
    photoOriginalPath?: string | null;
    photoPrintPath?: string | null;
  }[];
  customerName: string;
  phone: string;
  email?: string;
  taxId?: string;
  taxIdType?: "DNI" | "RUC";
  province: string;
  recipientName?: string;
  recipientPhone?: string;
  giftNote?: string;
  giftWrap: boolean;
  addressLine: string;
  district: string;
  city: string;
  department: string;
  reference?: string;
  promoCode?: string;
  referralCode?: string;
  useCredit: boolean;
  giftCardCode?: string;
  paymentMethod: "card" | "yape" | "plin" | "gift_card";
  ackLowRes: boolean;
  channel?: "web" | "whatsapp";
  orderId?: string;
};

export type WaPhotoRef = { photoId: string; width: number; height: number };

export type WaDraft = {
  token: string;
  phone: string;
  step: string;
  photos: WaPhotoRef[];
  frameId?: string | null;
  mode?: "single" | "wall" | "set" | null;
  orderId?: string | null;
  needsHuman?: boolean;
  taxId?: string | null;
  taxIdType?: "DNI" | "RUC" | null;
};

export type FrameOffer = FrameDef & { available: number };

export type GiftCardDraft = {
  amountCents: number;
  buyerName: string;
  buyerPhone: string;
  recipientName: string;
  recipientPhone: string;
  recipientEmail?: string;
  message?: string;
};

export class AppError extends Error {}
