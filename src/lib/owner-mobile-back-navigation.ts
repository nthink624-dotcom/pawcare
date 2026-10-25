import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

type OwnerBackNavigationPlugin = {
  addListener(eventName: "backButton", listenerFunc: () => void): Promise<PluginListenerHandle>;
};

const OwnerBackNavigation = registerPlugin<OwnerBackNavigationPlugin>("OwnerBackNavigation");

export async function addOwnerAndroidBackButtonListener(listener: () => void) {
  if (Capacitor.getPlatform() !== "android") return null;
  const handle = await OwnerBackNavigation.addListener("backButton", listener);
  return () => handle.remove();
}
