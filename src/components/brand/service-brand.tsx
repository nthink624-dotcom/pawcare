import Image from "next/image";

import {
  PETMANAGER_BRAND_LOGO_PATH,
  PETMANAGER_MASTER_BRAND_NAME,
  PETMANAGER_PRODUCT_NAME,
} from "@/lib/brand";

type ServiceBrandProps = {
  className?: string;
  compact?: boolean;
};

export function ServiceBrand({ className = "", compact = false }: ServiceBrandProps) {
  return (
    <div className={`flex min-w-0 items-center gap-2 ${className}`.trim()}>
      <Image
        src={PETMANAGER_BRAND_LOGO_PATH}
        alt={PETMANAGER_MASTER_BRAND_NAME}
        width={1240}
        height={360}
        priority
        className={`${compact ? "h-[18px]" : "h-5"} w-auto shrink-0 object-contain`}
      />
      <span aria-hidden="true" className={`${compact ? "h-4" : "h-[18px]"} w-px shrink-0 bg-[#cbd5e1]`} />
      <span className="whitespace-nowrap text-[15px] font-semibold leading-5 tracking-[-0.03em] text-[#17223a]">
        {PETMANAGER_PRODUCT_NAME}
      </span>
    </div>
  );
}
