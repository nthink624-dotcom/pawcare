"use client";

import { useLayoutEffect } from "react";

import { Capacitor } from "@capacitor/core";

export default function NativeSafeAreaPlatform() {
  useLayoutEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const root = document.documentElement;
    const platform = Capacitor.getPlatform();
    root.dataset.pmNativePlatform = platform;

    if (platform === "android") {
      root.style.setProperty("--pm-native-safe-top", "0px");
      root.style.setProperty("--pm-safe-top", "0px");
    }
  }, []);

  return null;
}
