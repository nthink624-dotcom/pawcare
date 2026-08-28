export type AlimtalkCreditProductId = "credits_1000" | "credits_3000" | "credits_10000";

export type LegacyAlimtalkCreditProduct = {
  id: AlimtalkCreditProductId;
  creditCount: number;
  price: number;
};

// Historical reconciliation only. This catalog must never be rendered or used
// to initiate a new payment after the single-plan cutover.
const LEGACY_ALIMTALK_CREDIT_PRODUCTS: readonly LegacyAlimtalkCreditProduct[] = [
  { id: "credits_1000", creditCount: 1000, price: 11000 },
  { id: "credits_3000", creditCount: 3000, price: 29700 },
  { id: "credits_10000", creditCount: 10000, price: 77000 },
];

export function getLegacyAlimtalkCreditProduct(id: string | null | undefined) {
  return LEGACY_ALIMTALK_CREDIT_PRODUCTS.find((product) => product.id === id) ?? null;
}
