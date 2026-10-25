import Image from "next/image";

import {
  PETMANAGER_BRAND_LOGO_PATH,
  PETMANAGER_MASTER_BRAND_NAME,
  PETMANAGER_PRODUCT_NAME,
} from "@/lib/brand";

type ServiceBrandProps = {
  className?: string;
  compact?: boolean;
  size?: "default" | "large";
};

export function ServiceBrand({ className = "", compact = false, size = "default" }: ServiceBrandProps) {
  const isLarge = !compact && size === "large";

  return (
    <div className={`flex min-w-0 items-center gap-2 ${className}`.trim()}>
      <Image
        src={PETMANAGER_BRAND_LOGO_PATH}
        alt={PETMANAGER_MASTER_BRAND_NAME}
        width={1240}
        height={360}
        priority
        unoptimized
        className={`${compact ? "h-[18px]" : isLarge ? "h-7" : "h-5"} w-auto shrink-0 object-contain`}
      />
      <span aria-hidden="true" className={`${compact ? "h-4" : isLarge ? "h-6" : "h-[18px]"} w-px shrink-0 bg-[#cbd5e1]`} />
      <span className={`whitespace-nowrap font-semibold tracking-[-0.03em] text-[#17223a] ${isLarge ? "text-[18px] leading-6" : "text-[16px] leading-5"}`}>
        {PETMANAGER_PRODUCT_NAME}
      </span>
    </div>
  );
}
