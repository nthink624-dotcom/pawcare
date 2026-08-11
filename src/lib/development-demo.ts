export const DEVELOPMENT_DEMO_SHOP_ID = "shop-950db4fa";
export const DEVELOPMENT_DEMO_SHOP_NAME = "멍샵몽샵";

export function isDevelopmentDemoEnvironment() {
  return process.env.NEXT_PUBLIC_SUPABASE_ENV_NAME === "development";
}

export function getLandingDemoShopId() {
  return isDevelopmentDemoEnvironment() ? DEVELOPMENT_DEMO_SHOP_ID : "owner-demo";
}

export function isDevelopmentDemoShopId(shopId: string) {
  return isDevelopmentDemoEnvironment() && shopId === DEVELOPMENT_DEMO_SHOP_ID;
}
