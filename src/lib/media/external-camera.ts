import { Capacitor, registerPlugin } from "@capacitor/core";

type ExternalCameraPlugin = {
  capture(options: { chooser: boolean }): Promise<{
    path?: string;
    cacheFileName?: string;
    base64?: string;
    mimeType?: string;
    fileName?: string;
  }>;
  getCapabilities(): Promise<{
    availableAppCount: number;
    canChoose: boolean;
    externalAppPickerAvailable?: boolean;
  }>;
  openExternalCameraAppPicker(): Promise<void>;
  release(options: { cacheFileName: string }): Promise<void>;
};

const ExternalCamera = registerPlugin<ExternalCameraPlugin>("ExternalCamera");

export function canUseExternalCameraApps() {
  return Capacitor.getPlatform() === "android";
}

export type ExternalCameraCapabilities = {
  availableAppCount: number | null;
  canChoose: boolean | null;
  externalAppPickerAvailable: boolean;
};

const UNKNOWN_EXTERNAL_CAMERA_CAPABILITIES: ExternalCameraCapabilities = {
  availableAppCount: null,
  canChoose: null,
  externalAppPickerAvailable: false,
};

function cameraNow() {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

async function traceCameraStep<T>(step: string, work: () => Promise<T>) {
  const startedAt = cameraNow();
  try {
    const result = await work();
    console.info("[owner-camera]", { step, outcome: "success", durationMs: Math.round(cameraNow() - startedAt) });
    return result;
  } catch (error) {
    console.warn("[owner-camera]", {
      step,
      outcome: "failure",
      durationMs: Math.round(cameraNow() - startedAt),
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    throw error;
  }
}

export async function getExternalCameraCapabilities(): Promise<ExternalCameraCapabilities> {
  if (!canUseExternalCameraApps()) {
    return { availableAppCount: 0, canChoose: false, externalAppPickerAvailable: false };
  }
  try {
    const result = await ExternalCamera.getCapabilities();
    return {
      availableAppCount: Math.max(0, Math.trunc(result.availableAppCount)),
      canChoose: result.canChoose === true,
      externalAppPickerAvailable: result.externalAppPickerAvailable === true,
    };
  } catch {
    // Older installed shells do not expose capability discovery. Keep the UI
    // on the truthful default-camera label instead of claiming a chooser.
    return UNKNOWN_EXTERNAL_CAMERA_CAPABILITIES;
  }
}

export async function openExternalCameraAppPicker() {
  if (!canUseExternalCameraApps()) throw new Error("Android 앱에서만 다른 촬영 앱을 열 수 있습니다.");
  await traceCameraStep("open-external-camera-app-picker", () => ExternalCamera.openExternalCameraAppPicker());
}

export async function captureWithAndroidCameraApp(mode: "default" | "chooser") {
  if (!canUseExternalCameraApps()) throw new Error("Android 카메라 앱에서만 촬영할 수 있습니다.");
  const result = await traceCameraStep("native-capture", () => ExternalCamera.capture({ chooser: mode === "chooser" }));
  try {
    const mimeType = result.mimeType || "image/jpeg";
    if (result.path) {
      const localFilePath = result.path;
      const response = await traceCameraStep("file-bridge-read", () =>
        fetch(Capacitor.convertFileSrc(localFilePath), { cache: "no-store" }),
      );
      if (!response.ok) throw new Error("촬영한 사진 파일을 읽을 수 없습니다.");
      const blob = await traceCameraStep("file-to-blob", () => response.blob());
      return new File([blob], result.fileName || `petmanager-photo-${Date.now()}.jpg`, { type: mimeType });
    }

    if (!result.base64) throw new Error("촬영한 사진 파일을 찾을 수 없습니다.");
    const decoded = await traceCameraStep("legacy-base64-decode", async () => atob(result.base64!));
    const bytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0));
    try {
      return new File([bytes], result.fileName || `petmanager-photo-${Date.now()}.jpg`, { type: mimeType });
    } finally {
      bytes.fill(0);
    }
  } finally {
    if (result.cacheFileName) await ExternalCamera.release({ cacheFileName: result.cacheFileName }).catch(() => undefined);
    if (result.base64) result.base64 = "";
  }
}
