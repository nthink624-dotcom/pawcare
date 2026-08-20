import Image from "next/image";
import { useId, type ReactNode } from "react";
import { BatteryFull, ChevronLeft, Signal, Wifi } from "lucide-react";

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
  aspectClassName,
}: {
  src: string;
  alt: string;
  label: string;
  priority?: boolean;
  compact?: boolean;
  aspectClassName?: string;
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
      <div className={`relative w-full ${aspectClassName ?? (compact ? "aspect-[16/12]" : "aspect-[16/11]")}`}>
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          className="object-cover object-top"
          sizes={compact ? "(min-width: 1024px) 420px, 100vw" : "(min-width: 1024px) 900px, 100vw"}
          quality={90}
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
  children,
}: {
  src?: string;
  alt?: string;
  className?: string;
  screenClassName?: string;
  sizes?: string;
  priority?: boolean;
  overlay?: ReactNode;
  children?: ReactNode;
}) {
  const screenMaskId = `iphone-screen-${useId().replace(/:/g, "")}`;

  return (
    <div className={`relative aspect-[823/1677] ${className}`}>
      <div
        className="absolute bottom-[1.61%] left-[4.62%] right-[4.74%] top-[1.91%] z-10 overflow-hidden bg-black"
        style={{ borderRadius: "11.5% / 5.3%" }}
      >
        {children ? (
          <>
            <div className="absolute inset-x-0 bottom-[5.7%] top-[5.7%] overflow-hidden bg-white">
              {children}
            </div>
            <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex h-[5.7%] items-center justify-between border-b border-[#f2f3f5] bg-white px-[5.1%] text-[#111827]" aria-hidden="true">
              <time className="text-[8px] font-semibold leading-none">9:41</time>
              <div className="flex items-center gap-1">
                <Signal className="h-2.5 w-2.5" strokeWidth={2.4} />
                <Wifi className="h-2.5 w-2.5" strokeWidth={2.4} />
                <BatteryFull className="h-3 w-3.5" strokeWidth={2.2} />
              </div>
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex h-[5.7%] items-center justify-around border-t border-[#f2f3f5] bg-white text-[#111827]" aria-hidden="true">
              <span className="flex h-3 w-3 items-center justify-center gap-[1.5px]">
                <i className="h-2.5 w-[1.5px] rounded-full bg-[#111827]" />
                <i className="h-2.5 w-[1.5px] rounded-full bg-[#111827]" />
                <i className="h-2.5 w-[1.5px] rounded-full bg-[#111827]" />
              </span>
              <span className="h-3 w-4 rounded-[3px] border-[1.5px] border-[#111827]" />
              <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.4} />
            </div>
          </>
        ) : src ? (
          <div
            className="absolute inset-[1.75%] overflow-hidden bg-black"
            style={{ borderRadius: "10.5% / 4.9%" }}
          >
            <Image
              src={src}
              alt={alt ?? ""}
              fill
              priority={priority}
              className={screenClassName}
              sizes={sizes}
              quality={90}
            />
          </div>
        ) : null}
      </div>
      {overlay}
      {children ? (
        <>
          <svg
            viewBox="0 0 823 1677"
            className="pointer-events-none absolute inset-0 z-20 h-full w-full"
            aria-hidden="true"
          >
            <defs>
              <mask id={screenMaskId}>
                <rect width="823" height="1677" fill="white" />
                <rect x="38" y="32" width="746" height="1618" rx="86" fill="black" />
              </mask>
            </defs>
            <image
              href="/images/iphone-14-pro-phone-template.svg"
              width="823"
              height="1677"
              preserveAspectRatio="none"
              mask={`url(#${screenMaskId})`}
            />
          </svg>
          <span
            className="pointer-events-none absolute left-1/2 top-[2.4%] z-50 h-[2.1%] w-[27%] -translate-x-1/2 rounded-full bg-[#050505]"
            aria-hidden="true"
          />
        </>
      ) : (
        <Image
          src="/images/iphone-14-pro-phone-template.svg"
          alt=""
          fill
          unoptimized
          aria-hidden="true"
          className="pointer-events-none z-20 object-contain"
          sizes={sizes}
        />
      )}
    </div>
  );
}

export function GalaxyPhoneMockup({
  className = "",
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`relative aspect-[9/19.5] ${className}`}>
      <div className="absolute inset-0 rounded-[11%/5.2%] border border-[#8d9296] bg-[linear-gradient(105deg,#6f7478_0%,#e5e7e8_13%,#8d9296_27%,#f0f1f1_50%,#777c80_72%,#d8dadb_88%,#686d71_100%)] p-[1.05%] shadow-[0_7px_16px_rgba(15,23,42,0.08)]">
        <div className="relative h-full w-full rounded-[10.4%/4.9%] bg-[#08090a] p-[1.25%] shadow-[inset_0_0_0_1px_#24272a]">
          <div className="relative isolate h-full w-full overflow-hidden rounded-[9.35%/4.42%] bg-white [clip-path:inset(0_round_9.35%_/_4.42%)]">
          <div className="absolute inset-x-0 bottom-[5.7%] top-[4.7%] isolate overflow-hidden bg-white [contain:paint]">
            {children}
          </div>
          <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex h-[4.7%] items-center justify-between bg-white px-[5.2%] text-[#111827]" aria-hidden="true">
            <time className="text-[8px] font-semibold leading-none">9:41</time>
            <div className="flex items-center gap-1">
              <Signal className="h-2.5 w-2.5" strokeWidth={2.4} />
              <Wifi className="h-2.5 w-2.5" strokeWidth={2.4} />
              <BatteryFull className="h-3 w-3.5" strokeWidth={2.2} />
            </div>
          </div>
          <span className="pointer-events-none absolute left-1/2 top-[1.35%] z-50 aspect-square w-[2.35%] -translate-x-1/2 rounded-full bg-[#08090a] ring-1 ring-[#34383b]" aria-hidden="true" />
          <span className="pointer-events-none absolute left-1/2 top-[0.45%] z-40 h-[0.35%] w-[10%] -translate-x-1/2 rounded-full bg-[#d7d9da]/80" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex h-[5.7%] items-center justify-around border-t border-[#f0f1f3] bg-white text-[#111827]" aria-hidden="true">
            <span className="flex h-3 w-3 items-center justify-center gap-[1.5px]">
              <i className="h-2.5 w-[1.5px] rounded-full bg-[#111827]" />
              <i className="h-2.5 w-[1.5px] rounded-full bg-[#111827]" />
              <i className="h-2.5 w-[1.5px] rounded-full bg-[#111827]" />
            </span>
            <span className="h-3 w-4 rounded-[3px] border-[1.5px] border-[#111827]" />
            <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.4} />
          </div>
        </div>
        </div>
      </div>
      <span className="pointer-events-none absolute -left-[0.65%] top-[19%] h-[9%] w-[1.45%] rounded-l-full border-l border-[#d9dbdc] bg-[#858a8e] shadow-[inset_1px_0_0_#eef0f0]" aria-hidden="true" />
      <span className="pointer-events-none absolute -right-[0.65%] top-[18%] h-[13%] w-[1.45%] rounded-r-full border-r border-[#d9dbdc] bg-[#858a8e] shadow-[inset_-1px_0_0_#eef0f0]" aria-hidden="true" />
      <span className="pointer-events-none absolute -right-[0.65%] top-[33%] h-[7%] w-[1.45%] rounded-r-full border-r border-[#d9dbdc] bg-[#858a8e] shadow-[inset_-1px_0_0_#eef0f0]" aria-hidden="true" />
      <span className="pointer-events-none absolute inset-x-[8%] top-[0.18%] h-px rounded-full bg-white/75" aria-hidden="true" />
      <span className="pointer-events-none absolute inset-x-[9%] bottom-[0.2%] h-px rounded-full bg-[#f5f6f6]/70" aria-hidden="true" />
    </div>
  );
}

export function DesktopMonitorMockup({
  src,
  alt,
  className = "",
  sizes = "(min-width: 1024px) 980px, 100vw",
}: {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
}) {
  return <LaptopMockup src={src} alt={alt} className={className} sizes={sizes} />;
}

export function LaptopMockup({
  src,
  alt,
  className = "",
  sizes = "(min-width: 1024px) 720px, 100vw",
  children,
}: {
  src?: string;
  alt?: string;
  className?: string;
  sizes?: string;
  children?: ReactNode;
}) {
  return (
    <figure className={`mx-auto w-full ${className}`}>
      <div className="relative aspect-[2548/1421]">
        <Image
          src="/images/laptop.svg"
          alt=""
          fill
          priority
          className="pointer-events-none object-contain"
          sizes={sizes}
        />
        <div className="absolute left-[10.91%] top-[3.17%] h-[90.43%] w-[78.18%] overflow-hidden bg-white">
          {children ?? (src ? <Image src={src} alt={alt ?? ""} fill className="object-cover object-top" sizes={sizes} quality={90} /> : null)}
        </div>
      </div>
    </figure>
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
