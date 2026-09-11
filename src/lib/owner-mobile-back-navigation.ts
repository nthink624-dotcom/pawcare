import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

type OwnerBackNavigationPlugin = {
  addListener(eventName: "backButton", listenerFunc: () => void): Promise<PluginListenerHandle>;
  exitApp(): Promise<void>;
};

const OwnerBackNavigation = registerPlugin<OwnerBackNavigationPlugin>("OwnerBackNavigation");

export const OWNER_ROOT_BACK_CONFIRMATION_MS = 2_000;

export function shouldExitOwnerApp(lastRequestedAt: number | null, now: number) {
  return lastRequestedAt !== null && now - lastRequestedAt <= OWNER_ROOT_BACK_CONFIRMATION_MS;
}

export async function addOwnerAndroidBackButtonListener(listener: () => void) {
  if (Capacitor.getPlatform() !== "android") return null;
  const handle = await OwnerBackNavigation.addListener("backButton", listener);
  return () => handle.remove();
}

export async function exitOwnerAndroidApp() {
  if (Capacitor.getPlatform() !== "android") return;
  await OwnerBackNavigation.exitApp();
}
