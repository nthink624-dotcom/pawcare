export const CURRENT_OWNER_SHOP_STORAGE = "petmanager:owner-current-shop";

export function readCurrentOwnerShopId() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(CURRENT_OWNER_SHOP_STORAGE);
  } catch {
    return null;
  }
}

export function writeCurrentOwnerShopId(shopId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CURRENT_OWNER_SHOP_STORAGE, shopId);
  } catch {
    // The shop hint only accelerates entry and must never block authentication.
  }
}
