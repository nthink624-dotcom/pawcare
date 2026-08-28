export type PriceGuideOnboardingEntryMode = "photo" | "manual";

function preferredModeStorageKey(shopId: string) {
  return `petmanager.owner.price-guide-onboarding-mode:${shopId}`;
}

export function setPreferredPriceGuideOnboardingMode(
  shopId: string,
  mode: PriceGuideOnboardingEntryMode,
) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(preferredModeStorageKey(shopId), mode);
  } catch {
    // 저장소를 사용할 수 없어도 서비스 화면의 기본 선택지는 계속 노출됩니다.
  }
}

export function consumePreferredPriceGuideOnboardingMode(
  shopId: string,
): PriceGuideOnboardingEntryMode | null {
  if (typeof window === "undefined") return null;

  try {
    const key = preferredModeStorageKey(shopId);
    const value = window.sessionStorage.getItem(key);
    window.sessionStorage.removeItem(key);
    return value === "photo" || value === "manual" ? value : null;
  } catch {
    return null;
  }
}
