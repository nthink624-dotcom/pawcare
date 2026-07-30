import Image from "next/image";

import {
  PETMANAGER_BRAND_LOGO_SRC,
  PETMANAGER_MASTER_BRAND_NAME,
  PETMANAGER_PRODUCT_NAME,
} from "@/lib/brand";
import { cn } from "@/lib/utils";

const BRAND_LOGO_WIDTH = 1240;
const BRAND_LOGO_HEIGHT = 360;

export default function PetManagerBrand({
  className,
  imageClassName,
  nameClassName,
  priority = false,
}: {
  className?: string;
  imageClassName?: string;
  nameClassName?: string;
  priority?: boolean;
}) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <Image
        src={PETMANAGER_BRAND_LOGO_SRC}
        alt={PETMANAGER_MASTER_BRAND_NAME}
        width={BRAND_LOGO_WIDTH}
        height={BRAND_LOGO_HEIGHT}
        priority={priority}
        className={cn("h-5 w-auto shrink-0 object-contain", imageClassName)}
      />
      <span aria-hidden="true" className="h-[18px] w-px shrink-0 bg-[#cbd5e1]" />
      <span className={cn("whitespace-nowrap font-semibold tracking-[-0.03em]", nameClassName)}>
        {PETMANAGER_PRODUCT_NAME}
      </span>
    </span>
  );
}
