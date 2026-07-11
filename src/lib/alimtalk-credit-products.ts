export type AlimtalkCreditProductId = "credits_1000" | "credits_3000" | "credits_10000";

export type AlimtalkCreditProduct = {
  id: AlimtalkCreditProductId;
  title: string;
  creditCount: number;
  unitPriceBeforeVat: number;
  supplyPrice: number;
  price: number;
  badge?: string;
};

export const ALIMTALK_CREDIT_VAT_RATE = 0.1;

export const alimtalkCreditProducts: AlimtalkCreditProduct[] = [
  {
    id: "credits_1000",
    title: "1,000건 충전",
    creditCount: 1000,
    unitPriceBeforeVat: 10,
    supplyPrice: 10000,
    price: 11000,
  },
  {
    id: "credits_3000",
    title: "3,000건 충전",
    creditCount: 3000,
    unitPriceBeforeVat: 9,
    supplyPrice: 27000,
    price: 29700,
    badge: "추천",
  },
  {
    id: "credits_10000",
    title: "10,000건 충전",
    creditCount: 10000,
    unitPriceBeforeVat: 7,
    supplyPrice: 70000,
    price: 77000,
  },
];

export function getAlimtalkCreditProduct(id: string | null | undefined) {
  return alimtalkCreditProducts.find((product) => product.id === id) ?? null;
}
