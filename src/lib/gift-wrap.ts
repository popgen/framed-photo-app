/** Gift wrap is only charged, and only stored, when the order has something to wrap (not a card-only order). */
export function chargedGiftWrap(input: { giftWrap?: boolean; items?: { card?: unknown }[] | null }): boolean {
  return Boolean(input.giftWrap) && (input.items ?? []).some((item) => !item.card);
}

/** A wrapped box never includes a price list, even when the buyer did not tick that box themselves. */
export function hidePricesForOrder(noteHidePrices: boolean, giftWrap: boolean): boolean {
  return Boolean(noteHidePrices) || Boolean(giftWrap);
}
