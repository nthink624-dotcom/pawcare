export const DEVELOPMENT_DEMO_SHOP_ID = "shop-950db4fa";
export const DEVELOPMENT_DEMO_SHOP_NAME = "멍샵몽샵";
export const LANDING_DEMO_SHOP_ID = "petmanager-demo-salon";
export const LANDING_DEMO_SHOP_NAME = "펫매니저 데모 살롱";

export function isDevelopmentDemoEnvironment() {
  return process.env.NEXT_PUBLIC_SUPABASE_ENV_NAME === "development";
}

export function getLandingDemoShopId() {
  return LANDING_DEMO_SHOP_ID;
}

export function isLandingDemoShopId(shopId: string) {
  return shopId === LANDING_DEMO_SHOP_ID;
}

export function isDevelopmentDemoShopId(shopId: string) {
  return isDevelopmentDemoEnvironment() && shopId === DEVELOPMENT_DEMO_SHOP_ID;
}
