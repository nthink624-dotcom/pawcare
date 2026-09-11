export const DEVELOPMENT_DEMO_SHOP_ID = "shop-950db4fa";
export const DEVELOPMENT_DEMO_SHOP_NAME = "멍샵몽샵";
export const LANDING_DEMO_SHOP_ID = "petmanager-demo-salon";
export const LANDING_DEMO_MOCK_SHOP_ID = "demo-shop";
export const LANDING_DEMO_SHOP_NAME = "펫매니저 데모 살롱";
export const LANDING_DEMO_FULL_GROOMING_SERVICE_ID = "petmanager-demo-service-full";

export function isDevelopmentDemoEnvironment() {
  return process.env.NEXT_PUBLIC_SUPABASE_ENV_NAME === "development";
}

export function getLandingDemoShopId() {
  return LANDING_DEMO_MOCK_SHOP_ID;
}

export function isLandingDemoShopId(shopId: string) {
  return shopId === LANDING_DEMO_SHOP_ID || shopId === LANDING_DEMO_MOCK_SHOP_ID;
}

export function resolveLandingDemoServiceId(
  requestedServiceId: string | undefined,
  services: ReadonlyArray<{ id: string; name: string; is_active?: boolean }>,
) {
  if (requestedServiceId !== LANDING_DEMO_FULL_GROOMING_SERVICE_ID) return requestedServiceId ?? "";

  return (
    services.find(
      (service) => service.is_active !== false && service.name.trim().replace(/\s+/g, " ") === "전체 미용",
    )?.id ?? ""
  );
}

export function isDevelopmentDemoShopId(shopId: string) {
  return isDevelopmentDemoEnvironment() && shopId === DEVELOPMENT_DEMO_SHOP_ID;
}
