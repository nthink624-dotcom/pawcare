export function shouldInitializeOwnerWebNavigation(
  initializedShopId: string | null,
  nextShopId: string,
) {
  return initializedShopId !== nextShopId;
}
