import "dotenv/config";
import type { CapacitorConfig } from "@capacitor/cli";

import { buildOwnerShellConfig } from "./src/config/owner-web";

const ownerShell = buildOwnerShellConfig(process.env.OWNER_MOBILE_WEB_URL);

const config: CapacitorConfig = {
  appId: "kr.petmanager.owner",
  appName: "넘친데이 펫매니저",
  webDir: "www",
  server: ownerShell.url
    ? {
        url: ownerShell.url,
        cleartext: ownerShell.cleartext,
        allowNavigation: ownerShell.allowNavigation.length > 0 ? ownerShell.allowNavigation : undefined,
      }
    : undefined,
};

export default config;
