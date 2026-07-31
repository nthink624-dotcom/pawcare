import type { CapacitorConfig } from "@capacitor/cli";

import { PETMANAGER_SERVICE_NAME } from "./src/lib/brand";

const serverUrl = process.env.CAPACITOR_SERVER_URL?.trim();

const config: CapacitorConfig = {
  appId: "kr.petmanager.owner",
  appName: PETMANAGER_SERVICE_NAME,
  webDir: "capacitor-web",
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
