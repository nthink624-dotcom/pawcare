export type RelayAccessMode = "full" | "read-only";

const relayReadPaths = new Set([
  "/health",
  "/debug/templates",
  "/admin/templates",
  "/admin/templates/categories",
]);
const providerReadPaths = new Set([
  "/kakao/template/detail",
  "/kakao/template/list",
  "/kakao/template/category/all",
]);

export const READ_ONLY_MESSAGE = "로컬 조회 모드에서는 문안 등록·검수·중지 및 실제 발송을 사용할 수 없습니다.";

export function readRelayAccessMode(value: string | undefined): RelayAccessMode {
  // Preserve the existing production runtime unless its operator opts in.
  // The supported local launcher always sets and verifies read-only mode.
  if (value === undefined || value === "" || value === "full") return "full";
  if (value === "read-only") return value;
  throw new Error("RELAY_ACCESS_MODE must be full or read-only.");
}

export function isRelayOperationAllowed(mode: RelayAccessMode, method: string, pathname: string) {
  return mode === "full" || method === "GET" && relayReadPaths.has(pathname);
}

export function isProviderOperationAllowed(mode: RelayAccessMode, url: string) {
  if (mode === "full") return true;
  const parsed = new URL(url);
  return parsed.origin === "https://apis.ssodaa.com" && providerReadPaths.has(parsed.pathname);
}
