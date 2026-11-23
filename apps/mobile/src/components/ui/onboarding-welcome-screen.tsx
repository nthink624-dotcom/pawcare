import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import styles from "./onboarding-welcome-screen.module.css";

type WelcomeScreenProps = {
  imageUrl: string;
  /** Leave empty when the image only decorates the title. */
  imageAlt?: string;
  title: ReactNode;
  description: ReactNode;
  buttonText: string;
  onButtonClick: () => void;
  secondaryActionText?: ReactNode;
  onSecondaryActionClick?: () => void;
  className?: string;
};

const delay = (order: number) => ({ "--welcome-delay": `${order * 200}ms` }) as CSSProperties;

/** Full-screen welcome: a curved image on top, a short message, and one main action at the bottom. */
export function WelcomeScreen({
  imageUrl,
  imageAlt = "",
  title,
  description,
  buttonText,
  onButtonClick,
  secondaryActionText,
  onSecondaryActionClick,
  className,
}: WelcomeScreenProps) {
  return (
    <main data-onboarding-welcome className={cn("owner-font mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-white text-[#15213b]", className)}>
      <div className={cn(styles.image, "w-full shrink-0")}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a local static illustration; the image optimizer is not used in the app build. */}
        <img src={imageUrl} alt={imageAlt} className="block aspect-[3/2] h-auto w-full object-cover" style={{ clipPath: "ellipse(100% 60% at 50% 40%)" }} />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 py-6 text-center max-[359px]:px-5">
        <h1 className={cn(styles.item, "break-keep text-[28px] font-bold leading-[1.3] tracking-[-0.02em]")} style={delay(1)}>
          {title}
        </h1>
        <p className={cn(styles.item, "max-w-[320px] break-keep text-[16px] leading-6 text-[#526175]")} style={delay(2)}>
          {description}
        </p>
      </div>

      <div className="flex w-full shrink-0 flex-col gap-1 px-6 pb-[calc(var(--pm-safe-bottom,0px)+20px)] max-[359px]:px-4">
        <button
          type="button"
          onClick={onButtonClick}
          className={cn(styles.item, "min-h-[52px] w-full rounded-[12px] bg-[#111a30] px-4 text-[17px] font-semibold text-white outline-none hover:bg-[#1b2742] focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 active:bg-[#0b1222]")}
          style={delay(3)}
        >
          {buttonText}
        </button>
        {secondaryActionText && onSecondaryActionClick ? (
          <button
            type="button"
            onClick={onSecondaryActionClick}
            className={cn(styles.item, "mx-auto min-h-11 rounded-[8px] px-3 text-[15px] text-[#64748b] underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-blue-600")}
            style={delay(4)}
          >
            {secondaryActionText}
          </button>
        ) : null}
      </div>
    </main>
  );
}
