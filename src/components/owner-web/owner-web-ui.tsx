import type { LucideIcon } from "lucide-react";
import { CalendarDays, Check, ChevronDown } from "lucide-react";
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import {
  OWNER_WEB_PRIMARY_ACTION_BUTTON_CLASS,
  OWNER_WEB_SECONDARY_ACTION_BUTTON_CLASS,
} from "@/components/owner-web/owner-web-action-button-styles";
import { cn } from "@/lib/utils";

export function WebSurface({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-[8px] border border-[#e1e1dd] bg-white shadow-[0_8px_20px_rgba(32,33,36,0.04)]", className)}>
      {children}
    </section>
  );
}

export function WebSectionTitle({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-[24px] font-semibold text-[#202124]">{title}</h2>
        {description ? <p className="mt-2 text-[14px] leading-6 text-[#6f747a]">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function ToolbarRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-center gap-3", className)}>{children}</div>;
}

export function SearchField({ placeholder }: { placeholder: string }) {
  return (
    <label className="flex h-11 min-w-[240px] flex-1 items-center gap-3 rounded-[8px] border border-[#e1e1dd] bg-white px-3 text-[#6f747a]">
      <AssetIcon src="/icons/phosphor/MagnifyingGlass.svg" className="h-5 w-5 text-[#9a9a94]" />
      <input
        className="w-full bg-transparent text-[16px] text-[#202124] outline-none placeholder:text-[#9a9a94]"
        placeholder={placeholder}
      />
    </label>
  );
}

export function SelectLike({ label, icon: Icon = ChevronDown, onClick }: { label: string; icon?: LucideIcon; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-[42px] items-center gap-2 whitespace-nowrap rounded-[8px] border border-[#e1e1dd] bg-white px-4 text-[14px] font-medium text-[#30312f] hover:bg-[#f7f7f4]"
    >
      <span>{label}</span>
      <Icon className="h-4 w-4 text-[#6f747a]" />
    </button>
  );
}

export type SoftSelectOption<T extends string = string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

export function SoftSelect<T extends string = string>({
  value,
  options,
  onChange,
  label,
  className,
  buttonClassName,
  labelClassName,
  valueClassName,
  menuClassName,
  align = "right",
  direction = "down",
  disabled = false,
}: {
  value: T;
  options: Array<SoftSelectOption<T>>;
  onChange: (value: T) => void;
  label?: string;
  className?: string;
  buttonClassName?: string;
  labelClassName?: string;
  valueClassName?: string;
  menuClassName?: string;
  align?: "left" | "right";
  direction?: "down" | "up";
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "grid h-10 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-[8px] border border-[#e1e1dd] bg-white px-3 text-left transition",
          "hover:border-[#c8c8c2] hover:bg-[#f7f7f4] focus:outline-none focus:ring-[3px] focus:ring-[#d7d7d2]/45 disabled:cursor-not-allowed disabled:opacity-60",
          open && "border-[#c8c8c2] bg-white",
          buttonClassName,
        )}
      >
        {label ? <span className={cn("text-[12px] text-[#6f747a]", labelClassName)}>{label}</span> : <span />}
        <span className={cn("truncate text-right text-[14px] font-medium text-[#202124]", valueClassName)}>{selectedOption?.label ?? ""}</span>
        <ChevronDown className={cn("h-4 w-4 text-[#6f747a] transition", open && "rotate-180")} />
      </button>
      {open ? (
        <div
          role="listbox"
          className={cn(
            "absolute z-50 mt-2 min-w-full overflow-hidden rounded-[10px] border border-[#e1e1dd] bg-white p-1 shadow-[0_18px_42px_rgba(32,33,36,0.12)]",
            align === "right" ? "right-0" : "left-0",
            direction === "up" && "bottom-full mb-2 mt-0",
            menuClassName,
          )}
        >
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                disabled={option.disabled}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex h-9 w-full items-center justify-between gap-3 rounded-[8px] px-3 text-left text-[14px] transition",
                  selected ? "bg-[#f1f0ec] font-semibold text-[#202124]" : "text-[#30312f] hover:bg-[#f7f7f4]",
                  option.disabled && "cursor-not-allowed opacity-45",
                )}
              >
                <span className="truncate">{option.label}</span>
                {selected ? <Check className="h-4 w-4 shrink-0" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function AssetIcon({ src, className }: { src: string; className?: string }) {
  return (
    <span
      className={cn("inline-block h-5 w-5 shrink-0 bg-current align-middle", className)}
      style={
        {
          WebkitMaskImage: `url(${src})`,
          maskImage: `url(${src})`,
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

export function PrimaryButton({ label, onClick, icon }: { label: string; onClick?: () => void; icon?: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={OWNER_WEB_PRIMARY_ACTION_BUTTON_CLASS}
    >
      {icon}
      {label}
    </button>
  );
}

export function GhostButton({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={OWNER_WEB_SECONDARY_ACTION_BUTTON_CLASS}
    >
      {label}
    </button>
  );
}

export function Chip({
  label,
  active = false,
  tone = "default",
  onClick,
}: {
  label: string;
  active?: boolean;
  tone?: "default" | "soft" | "danger";
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-[34px] items-center justify-center rounded-[8px] border px-3.5 text-[13px] font-medium transition",
        active && tone === "default" && "border-[#c8c8c2] bg-[#f1f0ec] text-[#30312f]",
        active && tone === "soft" && "border-[#bae6fd] bg-[#f0f9ff] text-[#0369a1]",
        active && tone === "danger" && "border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]",
        !active && "border-[#e1e1dd] bg-white text-[#6f747a]",
      )}
    >
      {label}
    </button>
  );
}

export function DetailPanel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <WebSurface className="sticky top-6 p-5">
      <p className="text-[12px] font-semibold tracking-[0.12em] text-[#94a3b8]">DETAIL</p>
      <h3 className="mt-2 text-[22px] font-semibold text-[#111827]">{title}</h3>
      {subtitle ? <p className="mt-2 text-[14px] leading-6 text-[#64748b]">{subtitle}</p> : null}
      <div className="mt-6 space-y-5">{children}</div>
    </WebSurface>
  );
}

export function DetailBlock({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description?: string;
}) {
  return (
    <div className="border-b border-[#edf2f7] pb-4 last:border-b-0 last:pb-0">
      <p className="text-[12px] font-medium text-[#94a3b8]">{label}</p>
      <p className="mt-2 text-[16px] font-semibold text-[#111827]">{value}</p>
      {description ? <p className="mt-2 text-[13px] leading-6 text-[#64748b]">{description}</p> : null}
    </div>
  );
}

export function TableShell({
  children,
  columns,
  align = "left",
}: {
  children: React.ReactNode;
  columns: string[];
  align?: "left" | "center";
}) {
  return (
    <WebSurface className="overflow-hidden">
      <div
        className={cn(
          "grid border-b border-[#e2e8f0] bg-[#f8fafc] px-5 py-3 text-[15px] font-semibold tracking-[0.08em] text-[#64748b]",
          align === "center" && "text-center",
        )}
        style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
      >
        {columns.map((column) => (
          <span key={column} className={cn("min-w-0", align === "center" && "justify-self-center")}>
            {column}
          </span>
        ))}
      </div>
      <div>{children}</div>
    </WebSurface>
  );
}

export function TableRow({
  columns,
  active = false,
  onClick,
  className,
  align = "left",
}: {
  columns: React.ReactNode[];
  active?: boolean;
  onClick?: () => void;
  className?: string;
  align?: "left" | "center";
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!onClick) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#334155]/20",
        "grid w-full border-b border-[#edf2f7] px-5 py-4 transition last:border-b-0",
        align === "center" ? "items-center text-center" : "text-left",
        active ? "bg-[#f8fafc]" : "bg-white hover:bg-[#f8fafc]",
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
    >
      {columns.map((column, index) => (
        <div key={index} className={cn("min-w-0", align === "center" && "flex justify-center")}>
          {column}
        </div>
      ))}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  tone = "green",
  meta,
}: {
  label: string;
  value: string;
  tone?: "green" | "sand" | "rose" | "mint" | "slate";
  meta?: string;
}) {
  const toneClasses =
    tone === "green"
      ? "border-[#d7e8e0] bg-[#f6fbf8]"
      : tone === "sand"
        ? "border-[#ead9cf] bg-[#fffaf6]"
        : tone === "rose"
          ? "border-[#eed6cd] bg-[#fff6f3]"
          : tone === "mint"
            ? "border-[#d6ece5] bg-[#f8fcfb]"
            : "border-[#e5e3df] bg-[#fbfaf8]";

  return (
    <WebSurface className={cn("p-5", toneClasses)}>
      <p className="text-[13px] font-medium text-[#7c746b]">{label}</p>
      <p className="mt-3 text-[32px] font-semibold tracking-[-0.05em] text-[#17211f]">{value}</p>
      {meta ? <p className="mt-2 text-[13px] text-[#7a7269]">{meta}</p> : null}
    </WebSurface>
  );
}

export function MiniSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <WebSurface className="p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[18px] font-semibold tracking-[-0.03em] text-[#17211f]">{title}</h3>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </WebSurface>
  );
}

export function SimpleLineChart({ points }: { points: Array<{ label: string; value: number }> }) {
  const max = Math.max(...points.map((point) => point.value));
  const height = 180;
  const width = 520;
  const step = width / (points.length - 1);
  const path = points
    .map((point, index) => {
      const x = index * step;
      const y = height - (point.value / max) * (height - 28) - 14;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[180px] w-full">
        <defs>
          <linearGradient id="owner-web-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#64748b" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#64748b" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((line) => (
          <line key={line} x1="0" x2={width} y1={18 + line * 46} y2={18 + line * 46} stroke="#efe8e2" strokeWidth="1" />
        ))}
        <path d={`${path} L ${width} ${height} L 0 ${height} Z`} fill="url(#owner-web-fill)" />
        <path d={path} fill="none" stroke="#64748b" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point, index) => {
          const x = index * step;
          const y = height - (point.value / max) * (height - 28) - 14;
          return <circle key={point.label} cx={x} cy={y} r="4.5" fill="#64748b" />;
        })}
      </svg>
      <div className="mt-3 flex justify-between text-[12px] font-medium text-[#8a8178]">
        {points.map((point) => (
          <span key={point.label}>{point.label}</span>
        ))}
      </div>
    </div>
  );
}

export function DonutChart({
  items,
}: {
  items: Array<{ label: string; value: number; color: string }>;
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const stops = items
    .reduce(
      (acc, item) => {
        const start = acc.cursor;
        const end = start + (item.value / total) * 360;
        acc.cursor = end;
        acc.values.push(`${item.color} ${start}deg ${end}deg`);
        return acc;
      },
      { cursor: 0, values: [] as string[] },
    )
    .values.join(", ");

  return (
    <div className="flex items-center gap-6">
      <div className="relative h-40 w-40 rounded-full" style={{ background: `conic-gradient(${stops})` }}>
        <div className="absolute inset-[22px] rounded-full bg-white" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-[12px] font-medium text-[#8f877d]">총 서비스</p>
            <p className="mt-1 text-[24px] font-semibold tracking-[-0.04em] text-[#17211f]">{total}%</p>
          </div>
        </div>
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
            <div>
              <p className="text-[14px] font-medium text-[#17211f]">{item.label}</p>
              <p className="text-[12px] text-[#8f877d]">{item.value}%</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SimpleBarChart({
  items,
}: {
  items: Array<{ label: string; value: number }>;
}) {
  const max = Math.max(...items.map((item) => item.value));
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-4">
          <span className="w-6 text-[12px] font-medium text-[#8f877d]">{item.label}</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-[#f1ece7]">
            <div className="h-full rounded-full bg-[#64748b]" style={{ width: `${(item.value / max) * 100}%` }} />
          </div>
          <span className="w-7 text-right text-[12px] font-medium text-[#4d5551]">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

export function EmptyCalendarHint() {
  return (
    <div className="rounded-[18px] border border-dashed border-[#dfd8d1] bg-[#fcfaf8] p-4 text-[13px] leading-6 text-[#81796f]">
      예약 블록을 클릭하면 오른쪽 패널에서 고객, 서비스, 메모, 빠른 상태 변경을 바로 처리할 수 있어요.
    </div>
  );
}

export function DateToolbarBadge() {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[#e4ddd6] bg-white px-3 py-1.5 text-[13px] font-medium text-[#6d655c]">
      <CalendarDays className="h-4 w-4 text-[#8b8279]" />
      이번 주 기준
    </span>
  );
}
