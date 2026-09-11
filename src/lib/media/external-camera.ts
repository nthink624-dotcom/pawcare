import { Capacitor, registerPlugin } from "@capacitor/core";

type ExternalCameraPlugin = {
  capture(options: { chooser: boolean }): Promise<{ base64: string; mimeType?: string; fileName?: string }>;
};

const ExternalCamera = registerPlugin<ExternalCameraPlugin>("ExternalCamera");

export function canUseExternalCameraApps() {
  return Capacitor.getPlatform() === "android";
}

export async function captureWithAndroidCameraApp(mode: "default" | "chooser") {
  if (!canUseExternalCameraApps()) throw new Error("Android 카메라 앱에서만 촬영할 수 있습니다.");
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
