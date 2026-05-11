import "dotenv/config";
import type { CapacitorConfig } from "@capacitor/cli";

import { buildOwnerShellConfig } from "./src/config/owner-web";

const ownerShell = buildOwnerShellConfig(process.env.OWNER_WEB_URL);

const config: CapacitorConfig = {
  appId: "kr.co.petmanager.owner",
  appName: "PetManager Owner",
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
