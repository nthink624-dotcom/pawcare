import type { MetadataRoute } from "next";

import {
  PETMANAGER_BRAND_MARK_PATH,
  PETMANAGER_SERVICE_DESCRIPTION,
  PETMANAGER_SERVICE_NAME,
} from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: PETMANAGER_SERVICE_NAME,
    short_name: PETMANAGER_SERVICE_NAME,
    description: PETMANAGER_SERVICE_DESCRIPTION,
    start_url: "/owner/mobile",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      {
        src: PETMANAGER_BRAND_MARK_PATH,
        sizes: "100x100",
        type: "image/png",
      },
    ],
  };
}
