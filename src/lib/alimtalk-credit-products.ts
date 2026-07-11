export type AlimtalkCreditProductId = "credits_1000" | "credits_3000" | "credits_10000";

export type AlimtalkCreditProduct = {
  id: AlimtalkCreditProductId;
  title: string;
  creditCount: number;
  price: number;
  badge?: string;
  description: string;
};

export const ALIMTALK_CREDIT_UNIT_PRICE = 11;

export const alimtalkCreditProducts: AlimtalkCreditProduct[] = [
  {
    id: "credits_1000",
    title: "1,000건 충전",
    creditCount: 1000,
    price: 11000,
    description: "예약 안내가 많아지는 달에 가볍게 추가",
  },
  {
    id: "credits_3000",
    title: "3,000건 충전",
    creditCount: 3000,
    price: 33000,
    badge: "추천",
    description: "정기 방문 안내와 미용 완료 알림을 넉넉하게",
  },
  {
    id: "credits_10000",
    title: "10,000건 충전",
    creditCount: 10000,
    price: 110000,
    description: "예약량이 많은 매장이나 다점포 운영에 적합",
  },
];

export function getAlimtalkCreditProduct(id: string | null | undefined) {
  return alimtalkCreditProducts.find((product) => product.id === id) ?? null;
}
