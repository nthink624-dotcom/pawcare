import type { LucideIcon } from "lucide-react";
import { CalendarDays, ChevronDown, Search } from "lucide-react";

import { cn } from "@/lib/utils";

export function WebSurface({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-[24px] border border-[#e6ddd6] bg-white shadow-[0_16px_36px_rgba(34,30,24,0.06)]", className)}>
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
        <h2 className="text-[28px] font-semibold tracking-[-0.04em] text-[#17211f]">{title}</h2>
        {description ? <p className="mt-2 text-[14px] leading-6 text-[#7a7269]">{description}</p> : null}
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
    <label className="flex min-w-[240px] flex-1 items-center gap-3 rounded-[16px] border border-[#e4ddd6] bg-[#fbfaf8] px-4 py-3 text-[#746f68]">
      <Search className="h-4 w-4 text-[#8f877d]" />
      <input
        className="w-full bg-transparent text-[14px] text-[#17211f] outline-none placeholder:text-[#958d84]"
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
      className="inline-flex h-[46px] items-center gap-2 rounded-[16px] border border-[#e4ddd6] bg-white px-4 text-[14px] font-medium text-[#263430]"
    >
      <span>{label}</span>
      <Icon className="h-4 w-4 text-[#7f796f]" />
    </button>
  );
}

export function PrimaryButton({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-[46px] items-center justify-center rounded-[16px] bg-[#2f7866] px-5 text-[14px] font-semibold text-white shadow-[0_10px_18px_rgba(47,120,102,0.16)]"
    >
      {label}
    </button>
  );
}

export function GhostButton({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-[42px] items-center justify-center rounded-[14px] border border-[#e4ddd6] bg-white px-4 text-[14px] font-medium text-[#3f4f4a]"
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
        "inline-flex h-[34px] items-center justify-center rounded-full border px-3.5 text-[13px] font-medium transition",
        active && tone === "default" && "border-[#2f7866] bg-[#2f7866] text-white",
        active && tone === "soft" && "border-[#d7e8e0] bg-[#eef7f3] text-[#2f7866]",
        active && tone === "danger" && "border-[#e7c8be] bg-[#fbefea] text-[#9a5b4a]",
        !active && "border-[#e5ddd6] bg-white text-[#6f675e]",
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
      <p className="text-[12px] font-semibold tracking-[0.12em] text-[#8a8178]">DETAIL</p>
      <h3 className="mt-2 text-[24px] font-semibold tracking-[-0.04em] text-[#17211f]">{title}</h3>
      {subtitle ? <p className="mt-2 text-[14px] leading-6 text-[#7a7269]">{subtitle}</p> : null}
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
    <div className="border-b border-[#f0e8e1] pb-4 last:border-b-0 last:pb-0">
      <p className="text-[12px] font-medium text-[#8f877d]">{label}</p>
      <p className="mt-2 text-[16px] font-semibold tracking-[-0.02em] text-[#17211f]">{value}</p>
      {description ? <p className="mt-2 text-[13px] leading-6 text-[#7a7269]">{description}</p> : null}
    </div>
  );
}

export function TableShell({
  children,
  columns,
}: {
  children: React.ReactNode;
  columns: string[];
}) {
  return (
    <WebSurface className="overflow-hidden">
      <div className="grid border-b border-[#efe8e2] bg-[#fbfaf8] px-5 py-3 text-[12px] font-semibold tracking-[0.08em] text-[#8f877d]" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
        {columns.map((column) => (
          <span key={column}>{column}</span>
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
}: {
  columns: React.ReactNode[];
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "grid w-full border-b border-[#f3ece6] px-5 py-4 text-left transition last:border-b-0",
        active ? "bg-[#f4faf7]" : "bg-white hover:bg-[#fcfaf8]",
      )}
      style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
    >
      {columns.map((column, index) => (
        <div key={index} className="min-w-0">
          {column}
        </div>
      ))}
    </button>
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
            <stop offset="0%" stopColor="#2f7866" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#2f7866" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((line) => (
          <line key={line} x1="0" x2={width} y1={18 + line * 46} y2={18 + line * 46} stroke="#efe8e2" strokeWidth="1" />
        ))}
        <path d={`${path} L ${width} ${height} L 0 ${height} Z`} fill="url(#owner-web-fill)" />
        <path d={path} fill="none" stroke="#2f7866" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point, index) => {
          const x = index * step;
          const y = height - (point.value / max) * (height - 28) - 14;
          return <circle key={point.label} cx={x} cy={y} r="4.5" fill="#2f7866" />;
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
            <div className="h-full rounded-full bg-[#2f7866]" style={{ width: `${(item.value / max) * 100}%` }} />
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
