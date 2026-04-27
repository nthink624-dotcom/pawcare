import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ComponentProps } from "react";

import { cn } from "@/lib/utils";

export const mobileBackButtonClassName =
  "inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#e3ded3] bg-[#fffdf8] text-[#3b3834] shadow-[0_6px_16px_rgba(59,56,52,0.05)] transition hover:bg-[#faf7f2] active:scale-[0.98]";

export const mobileBackIconClassName = "h-5 w-5";

type MobileBackButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label?: string;
};

export function MobileBackButton({
  className,
  label = "뒤로가기",
  type = "button",
  ...props
}: MobileBackButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={cn(mobileBackButtonClassName, className)}
      {...props}
    >
      <ChevronLeft className={mobileBackIconClassName} />
    </button>
  );
}

type MobileBackLinkButtonProps = ComponentProps<typeof Link> &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    label?: string;
  };

export function MobileBackLinkButton({
  className,
  label = "뒤로가기",
  children,
  ...props
}: MobileBackLinkButtonProps) {
  return (
    <Link
      aria-label={label}
      className={cn(mobileBackButtonClassName, className)}
      {...props}
    >
      {children ?? <ChevronLeft className={mobileBackIconClassName} />}
    </Link>
  );
}

type MobileBackAnchorButtonProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  label?: string;
};

export function MobileBackAnchorButton({
  className,
  label = "뒤로가기",
  children,
  ...props
}: MobileBackAnchorButtonProps) {
  return (
    <a
      aria-label={label}
      className={cn(mobileBackButtonClassName, className)}
      {...props}
    >
      {children ?? <ChevronLeft className={mobileBackIconClassName} />}
    </a>
  );
}
