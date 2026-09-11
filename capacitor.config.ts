import type { CapacitorConfig } from "@capacitor/cli";

/// <reference types="@capacitor/push-notifications" />

import { PETMANAGER_SERVICE_NAME } from "./src/lib/brand";

const serverUrl = process.env.CAPACITOR_SERVER_URL?.trim();

const config: CapacitorConfig = {
  appId: "kr.petmanager.owner",
  appName: PETMANAGER_SERVICE_NAME,
  webDir: "capacitor-web",
  android: {
    // Camera results can include base64 data. Keep Capacitor's bridge output out of Android logs.
    loggingBehavior: "none",
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
  ...(serverUrl
    ? {
        server: {
          url: serverUrl,
          cleartext: serverUrl.startsWith("http://"),
        },
      }
    : {}),
};

export default config;
