import Image from "next/image";
import type { ReactNode } from "react";

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
    <div className={align === "center" ? "mx-auto max-w-[840px] text-center" : "max-w-[840px]"}>
      <p className={`text-[14px] font-semibold ${inverse ? "text-[#86efac]" : "text-[#1f6b5b]"}`}>{eyebrow}</p>
      <h2 className={`mt-3 break-keep text-[34px] font-semibold leading-[1.2] [text-wrap:balance] md:text-[46px] ${inverse ? "text-white" : "text-[#111827]"}`}>
        {title}
      </h2>
      <p className={`mt-4 text-[16px] leading-7 md:text-[17px] md:leading-8 ${inverse ? "text-white/68" : "text-[#526071]"}`}>
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
    <figure className="overflow-hidden rounded-[8px] border border-[#dbe2ea] bg-white shadow-[0_18px_48px_rgba(15,23,42,0.09)]">
      <figcaption className="flex h-10 items-center justify-between border-b border-[#e7edf3] bg-[#fbfdff] px-3.5 text-[12px] font-medium text-[#64748b]">
        <span className="flex items-center gap-2.5">
          <span className="flex gap-1" aria-hidden="true">
            <span className="h-2 w-2 rounded-full bg-[#d6dde6]" />
            <span className="h-2 w-2 rounded-full bg-[#d6dde6]" />
            <span className="h-2 w-2 rounded-full bg-[#d6dde6]" />
          </span>
          {label}
        </span>
        <span>넘친 Day</span>
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

export function PhoneScreenshot({ src, alt, label }: { src: string; alt: string; label: string }) {
  return (
    <figure className="min-w-0">
      <div className="mx-auto w-full max-w-[260px] overflow-hidden rounded-[28px] border-[7px] border-[#1e293b] bg-white shadow-[0_18px_44px_rgba(15,23,42,0.13)]">
        <div className="relative aspect-[430/860] w-full">
          <Image src={src} alt={alt} fill className="object-cover object-top" sizes="260px" />
        </div>
      </div>
      <figcaption className="mt-3 text-center text-[13px] font-medium text-[#64748b]">{label}</figcaption>
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
      <div className={`flex h-9 w-9 items-center justify-center rounded-[8px] ${inverse ? "bg-white/10 text-[#86efac]" : "bg-[#edf7f1] text-[#1f6b5b]"}`}>
        {icon}
      </div>
      <h3 className={`mt-4 text-[18px] font-semibold ${inverse ? "text-white" : "text-[#111827]"}`}>{title}</h3>
      <p className={`mt-2 text-[14px] leading-6 ${inverse ? "text-white/65" : "text-[#64748b]"}`}>{body}</p>
    </div>
  );
}
