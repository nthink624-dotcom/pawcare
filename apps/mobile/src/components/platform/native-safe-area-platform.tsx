"use client";

import { useLayoutEffect } from "react";

import { Capacitor, registerPlugin } from "@capacitor/core";

type OwnerSystemBarsPlugin = {
  getStatusBarInset(): Promise<{ statusBarInsetTop: number }>;
};

const OwnerSystemBars = registerPlugin<OwnerSystemBarsPlugin>("OwnerSystemBars");

export default function NativeSafeAreaPlatform() {
  useLayoutEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const root = document.documentElement;
    const platform = Capacitor.getPlatform();
    root.dataset.pmNativePlatform = platform;

    if (platform !== "android") return;
    void OwnerSystemBars.getStatusBarInset().then(({ statusBarInsetTop }) => {
      if (Number.isFinite(statusBarInsetTop) && statusBarInsetTop > 0) {
        const inset = `${statusBarInsetTop}px`;
        root.style.setProperty("--pm-native-safe-top", inset);
        root.style.setProperty("--pm-safe-top", inset);
        root.style.setProperty("--pm-android-statusbar-inset", inset);
      }
    }).catch(() => undefined);
  }, []);

  return null;
}
