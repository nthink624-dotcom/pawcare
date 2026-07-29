import Image from "next/image";

import { PETMANAGER_BRAND_MARK_SRC, PETMANAGER_SERVICE_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

export default function PetManagerBrand({
  className,
  imageClassName,
  nameClassName,
  markSize = 34,
  priority = false,
}: {
  className?: string;
  imageClassName?: string;
  nameClassName?: string;
  markSize?: number;
  priority?: boolean;
}) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2.5", className)}>
      <Image
        src={PETMANAGER_BRAND_MARK_SRC}
        alt=""
        width={markSize}
        height={markSize}
        priority={priority}
        className={cn("shrink-0 object-contain", imageClassName)}
      />
      <span className={cn("whitespace-nowrap font-semibold tracking-[-0.03em]", nameClassName)}>
        {PETMANAGER_SERVICE_NAME}
      </span>
    </span>
  );
}
