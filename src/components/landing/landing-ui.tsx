import Image from "next/image";
import type { ReactNode } from "react";

import { PETMANAGER_SERVICE_NAME } from "@/lib/brand";

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  inverse = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  align?: "left" | "center";
  inverse?: boolean;
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-[820px] text-center" : "max-w-[760px]"}>
      <p className={`text-[15px] font-semibold ${inverse ? "text-[var(--landing-accent-on-dark)]" : "text-[var(--landing-accent)]"}`}>{eyebrow}</p>
      <h2 className={`mt-3 break-keep text-[34px] font-semibold leading-[1.2] [text-wrap:balance] md:text-[44px] ${inverse ? "text-white" : "text-[#111827]"}`}>
        {title}
      </h2>
      <p className={`mt-5 max-w-[720px] break-keep text-[16px] leading-7 md:text-[17px] md:leading-8 ${inverse ? "text-white/68" : "text-[#526071]"}`}>
        {description}
      </p>
    </div>
  );
}

export function ScreenshotFrame({
  src,
  alt,
  label,
  priority = false,
  compact = false,
}: {
  src: string;
  alt: string;
  label: string;
  priority?: boolean;
  compact?: boolean;
}) {
  return (
    <figure className="overflow-hidden rounded-[8px] border border-[#d8e0e9] bg-white shadow-[0_14px_38px_rgba(15,23,42,0.08)]">
      <figcaption className="flex h-11 items-center justify-between border-b border-[#e7edf3] bg-[#fbfcfe] px-4 text-[15px] font-medium text-[#64748b]">
        <span className="flex items-center gap-2.5">
          <span className="flex gap-1" aria-hidden="true">
            <span className="h-2 w-2 rounded-full bg-[#cfd8e3]" />
            <span className="h-2 w-2 rounded-full bg-[#cfd8e3]" />
            <span className="h-2 w-2 rounded-full bg-[#cfd8e3]" />
          </span>
          {label}
        </span>
        <span>{PETMANAGER_SERVICE_NAME}</span>
      </figcaption>
      <div className={`relative w-full ${compact ? "aspect-[16/12]" : "aspect-[16/11]"}`}>
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          className="object-cover object-top"
          sizes={compact ? "(min-width: 1024px) 420px, 100vw" : "(min-width: 1024px) 900px, 100vw"}
        />
      </div>
    </figure>
  );
}

export function IPhoneMockup({
  src,
  alt,
  className = "",
  screenClassName = "object-contain object-center",
  sizes = "260px",
  priority = false,
  overlay,
}: {
  src: string;
  alt: string;
  className?: string;
  screenClassName?: string;
  sizes?: string;
  priority?: boolean;
  overlay?: ReactNode;
}) {
  return (
    <div className={`relative aspect-[823/1677] ${className}`}>
      <div
        className="absolute bottom-[1.61%] left-[4.62%] right-[4.74%] top-[1.91%] overflow-hidden bg-black"
        style={{ borderRadius: "11.5% / 5.3%" }}
      >
        <div
          className="absolute inset-[1.75%] overflow-hidden bg-black"
          style={{ borderRadius: "10.5% / 4.9%" }}
        >
          <Image
            src={src}
            alt={alt}
            fill
            priority={priority}
            className={screenClassName}
            sizes={sizes}
          />
        </div>
      </div>
      {overlay}
      <Image
        src="/images/iphone-14-pro-phone-template.svg"
        alt=""
        fill
        unoptimized
        aria-hidden="true"
        className="pointer-events-none z-20 object-contain"
        sizes={sizes}
      />
    </div>
  );
}

export function PhoneScreenshot({ src, alt, label }: { src: string; alt: string; label: string }) {
  return (
    <figure className="min-w-0">
      <IPhoneMockup
        src={src}
        alt={alt}
        className="mx-auto w-full max-w-[260px] drop-shadow-[0_18px_28px_rgba(15,23,42,0.14)]"
        sizes="260px"
      />
      <figcaption className="mt-3 text-center text-[15px] font-medium text-[#64748b]">{label}</figcaption>
    </figure>
  );
}

export function ValueItem({
  icon,
  title,
  body,
  inverse = false,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  inverse?: boolean;
}) {
  return (
    <div className="min-w-0 border-t border-current/15 pt-4">
      <div className={`flex h-9 w-9 items-center justify-center rounded-[8px] ${inverse ? "bg-white/10 text-[var(--landing-accent-on-dark)]" : "bg-[var(--landing-accent-soft)] text-[var(--landing-accent)]"}`}>
        {icon}
      </div>
      <h3 className={`mt-4 text-[18px] font-semibold ${inverse ? "text-white" : "text-[#111827]"}`}>{title}</h3>
      <p className={`mt-2 text-[15px] leading-6 ${inverse ? "text-white/65" : "text-[#64748b]"}`}>{body}</p>
    </div>
  );
}
