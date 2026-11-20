import { uid } from "./ids";
import type { QuoteItem } from "./pricing";
import type { CartItem } from "./store";

export const TEST_PRODUCT_ID = "producto-prueba";
export const TEST_PRODUCT_CENTS = 500;
export const TEST_PRODUCT_NAME = "Producto de prueba";

type Env = Record<string, string | undefined>;

/** Default on. Set TEST_PRODUCT_ENABLED=false (and the EXPO_PUBLIC_ twin on the site) to hide it. */
export function testProductEnabled(env: Env = process.env): boolean {
  const raw = (env.TEST_PRODUCT_ENABLED ?? env.EXPO_PUBLIC_TEST_PRODUCT_ENABLED ?? "").trim().toLowerCase();
  if (!raw) return true;
  return raw === "true" || raw === "1" || raw === "on";
}

export function isTestProductItem(item: { testProduct?: boolean | null; frameId?: string | null } | null | undefined): boolean {
  return Boolean(item && (item.testProduct === true || item.frameId === TEST_PRODUCT_ID));
}

export function isTestOnlyCart(items: { testProduct?: boolean | null; frameId?: string | null }[] | null | undefined): boolean {
  return Boolean(items?.length) && items!.every((item) => isTestProductItem(item));
}

/** Server catalog price. Returns null when the line is a normal product. */
export function testProductQuoteLines(item: { testProduct?: boolean | null; frameId?: string | null }): QuoteItem[] | null {
  if (!isTestProductItem(item)) return null;
  return [{ unitPriceCents: TEST_PRODUCT_CENTS, quantity: 1, kind: "plain" }];
}

export function testCartItem(): CartItem {
  return {
    id: uid("ci_"),
    frameId: TEST_PRODUCT_ID,
    photoId: "test-product",
    crop: { imageWidth: 1, imageHeight: 1, x: 0, y: 0, width: 1, height: 1 },
    orientation: "portrait",
    dpi: 300,
    resolutionStatus: "good",
    testProduct: true,
    textOverlay: null,
    card: null,
    voice: null,
    collage: null,
  };
}
