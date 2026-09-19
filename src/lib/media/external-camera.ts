import { Capacitor, registerPlugin } from "@capacitor/core";

type ExternalCameraPlugin = {
  getCapabilities(): Promise<{ available: boolean; handlerCount: number }>;
  capture(options: { chooser: boolean }): Promise<{ base64: string; mimeType?: string; fileName?: string }>;
};

const ExternalCamera = registerPlugin<ExternalCameraPlugin>("ExternalCamera");

export type ExternalCameraAppsAvailability =
  | "checking"
  | "available"
  | "web"
  | "plugin-unavailable"
  | "camera-unavailable";

export function canUseExternalCameraApps() {
  return Capacitor.getPlatform() === "android" && Capacitor.isPluginAvailable("ExternalCamera");
}

export async function resolveExternalCameraAppsAvailability(): Promise<Exclude<ExternalCameraAppsAvailability, "checking">> {
  if (Capacitor.getPlatform() !== "android") return "web";
  if (!Capacitor.isPluginAvailable("ExternalCamera")) return "plugin-unavailable";

  try {
    const capability = await ExternalCamera.getCapabilities();
    return capability.available && capability.handlerCount > 0 ? "available" : "camera-unavailable";
  } catch {
    return "plugin-unavailable";
  }
}

export async function captureWithAndroidCameraApp(mode: "default" | "chooser") {
  if (Capacitor.getPlatform() !== "android") throw new Error("Android 앱에서만 카메라 앱을 열 수 있습니다.");
  if (!Capacitor.isPluginAvailable("ExternalCamera")) {
    throw new Error("현재 앱 버전에서는 카메라 앱을 연결할 수 없습니다.");
  }
  const result = await ExternalCamera.capture({ chooser: mode === "chooser" });
  const decoded = atob(result.base64);
  const bytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0));
  try {
    const mimeType = result.mimeType || "image/jpeg";
    return new File([bytes], result.fileName || `petmanager-photo-${Date.now()}.jpg`, { type: mimeType });
  } finally {
    bytes.fill(0);
    result.base64 = "";
  }
}
