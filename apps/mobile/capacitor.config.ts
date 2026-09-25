import type { CapacitorConfig } from "@capacitor/cli";

/// <reference types="@capacitor/push-notifications" />

import { PETMANAGER_SERVICE_NAME } from "./src/lib/brand";

const serverUrl = process.env.CAPACITOR_SERVER_URL?.trim();
const capacitorBuildMode = process.env.CAPACITOR_BUILD_MODE?.trim().toLowerCase();

if (capacitorBuildMode === "release") {
  if (!serverUrl) {
    throw new Error("CAPACITOR_SERVER_URL is required for an Android release sync.");
  }

  const releaseServerUrl = new URL(serverUrl);
  const releaseHostname = releaseServerUrl.hostname.toLowerCase();
  if (
    releaseServerUrl.protocol !== "https:" ||
    releaseHostname === "localhost" ||
    releaseHostname === "127.0.0.1" ||
    releaseServerUrl.port === "3000" ||
    releaseServerUrl.port === "3100"
  ) {
    throw new Error("Android release server URL must use a production HTTPS endpoint.");
  }
}

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
          cleartext: capacitorBuildMode !== "release" && serverUrl.startsWith("http://"),
        },
      }
    : {}),
};

export default config;
