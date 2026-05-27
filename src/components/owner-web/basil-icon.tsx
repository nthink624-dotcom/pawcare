import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

export const basilIconPaths = {
  calendar: "/icons/basil/outline/general/calendar.svg",
  "caret-left": "/icons/basil/outline/interface/caret-left.svg",
  "caret-right": "/icons/basil/outline/interface/caret-right.svg",
  copy: "/icons/basil/outline/files/copy.svg",
  download: "/icons/basil/outline/files/download.svg",
  eye: "/icons/basil/outline/status/eye.svg",
  "eye-closed": "/icons/basil/outline/status/eye-closed.svg",
  "info-circle": "/icons/basil/outline/status/info-circle.svg",
  "info-triangle": "/icons/basil/outline/status/info-triangle.svg",
  location: "/icons/basil/outline/navigation/location.svg",
  "map-location": "/icons/basil/outline/navigation/map-location.svg",
  "notification-on": "/icons/basil/outline/status/notification-on.svg",
  picture: "/icons/basil/outline/files/picture.svg",
  search: "/icons/basil/outline/interface/search.svg",
  share: "/icons/basil/outline/communication/share.svg",
  trash: "/icons/basil/outline/interface/trash.svg",
  upload: "/icons/basil/outline/files/upload.svg",
  "user-plus-solid": "/icons/basil/solid/communication/user-plus.svg",
} as const;

export type BasilIconName = keyof typeof basilIconPaths;

export function BasilIcon({ name, className }: { name: BasilIconName; className?: string }) {
  const defaultSizeClass = name === "trash" ? "h-6 w-6" : "h-5 w-5";

  return (
    <span
      className={cn("inline-block shrink-0 bg-current align-middle", defaultSizeClass, className)}
      style={
        {
          WebkitMaskImage: `url(${basilIconPaths[name]})`,
          maskImage: `url(${basilIconPaths[name]})`,
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
          maskPosition: "center",
          WebkitMaskSize: "contain",
          maskSize: "contain",
        } as CSSProperties
      }
      aria-hidden="true"
    />
  );
}
