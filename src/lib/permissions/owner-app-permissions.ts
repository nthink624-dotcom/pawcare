import { Capacitor, registerPlugin } from "@capacitor/core";

export type OwnerAppPermission = "camera" | "microphone" | "notifications";
export type OwnerAppPermissionState = "granted" | "prompt" | "denied" | "permanently_denied" | "unsupported";
export type OwnerAppPermissionStates = Record<OwnerAppPermission, OwnerAppPermissionState>;

type OwnerAppPermissionsPlugin = {
  checkAll(): Promise<OwnerAppPermissionStates>;
  request(options: { permission: OwnerAppPermission }): Promise<{ state: OwnerAppPermissionState }>;
  openAppSettings(): Promise<void>;
};

const OwnerAppPermissions = registerPlugin<OwnerAppPermissionsPlugin>("OwnerAppPermissions");
const unsupportedStates: OwnerAppPermissionStates = {
  camera: "unsupported",
  microphone: "unsupported",
  notifications: "unsupported",
};

async function withPermissionTimeout<T>(work: () => Promise<T>, timeoutMs = 8_000) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("권한 상태 확인 시간이 길어지고 있습니다. 다시 시도해 주세요."));
    }, timeoutMs);
  });
  try {
    return await Promise.race([work(), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function canManageOwnerAndroidPermissions() {
  return Capacitor.getPlatform() === "android";
}

export async function readOwnerAppPermissionStates() {
  if (!canManageOwnerAndroidPermissions()) return unsupportedStates;
  return withPermissionTimeout(() => OwnerAppPermissions.checkAll());
}

export async function requestOwnerAppPermission(permission: OwnerAppPermission) {
  if (!canManageOwnerAndroidPermissions()) return "unsupported" as const;
  const result = await withPermissionTimeout(() => OwnerAppPermissions.request({ permission }), 60_000);
  return result.state;
}

export async function openOwnerAppPermissionSettings() {
  if (!canManageOwnerAndroidPermissions()) throw new Error("Android 앱에서 휴대폰 설정을 열 수 있습니다.");
  await withPermissionTimeout(() => OwnerAppPermissions.openAppSettings());
}
