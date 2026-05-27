"use client";

import { Plus } from "lucide-react";
import { useEffect, useState } from "react";

import { BasilIcon } from "@/components/owner-web/basil-icon";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type ServicePreview = {
  id: string;
  name: string;
  category: string;
  duration: string;
  price: string;
  visible: boolean;
  description: string;
  capacity?: string;
  staff?: string;
};

type DurationRow = {
  id: string;
  label: string;
  minutes: string;
};

type ExtraCostRow = {
  id: string;
  label: string;
  price: string;
};

const durationGuideStorageKey = "petmanager.ownerWeb.serviceDurationGuide";
const extraCostGuideStorageKey = "petmanager.ownerWeb.serviceExtraCostGuide";

const defaultBaseDurations: DurationRow[] = [
  { id: "quick_bath", label: "부분or목욕", minutes: "60" },
  { id: "partial_bath", label: "부분목욕", minutes: "75" },
  { id: "full_grooming", label: "전체미용", minutes: "120" },
  { id: "sporting", label: "스포팅", minutes: "120" },
  { id: "full_scissor", label: "전체가위컷", minutes: "150" },
];

const defaultAdditionalDurations: DurationRow[] = [
  { id: "weight_7kg", label: "7kg 이상", minutes: "15" },
  { id: "weight_10kg", label: "10kg 이상", minutes: "30" },
  { id: "special_coat", label: "특수견/이중모", minutes: "30" },
  { id: "matting", label: "털엉킴", minutes: "30" },
  { id: "sensitive", label: "예민함/입질", minutes: "30" },
  { id: "first_visit", label: "첫 방문 상담", minutes: "15" },
  { id: "clean_buffer", label: "예약 간 정리", minutes: "10" },
];

const defaultExtraCosts: ExtraCostRow[] = [
  { id: "face_cut", label: "기본 얼굴컷", price: "5,000" },
  { id: "nail", label: "발톱컷", price: "10,000" },
  { id: "matting_fee", label: "털엉킴", price: "5,000~" },
  { id: "manner_fee", label: "매너 추가", price: "5,000" },
  { id: "coat_length", label: "모량/기장 추가", price: "5,000" },
];

function createRowId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeMinutes(value: string) {
  return value.replace(/[^0-9]/g, "");
}

function formatServicePrice(value: string) {
  const numericValue = Number(value.replace(/[^0-9]/g, ""));
  if (!numericValue) return "상담";
  return `${numericValue.toLocaleString("ko-KR")}원~`;
}

function normalizeDurationRows(value: unknown, fallback: DurationRow[]) {
  if (!Array.isArray(value)) return fallback;
  const rows = value
    .map((row, index) => {
      if (!row || typeof row !== "object") return null;
      const source = row as Partial<DurationRow>;
      return {
        id: typeof source.id === "string" && source.id ? source.id : createRowId(`duration_${index}`),
        label: typeof source.label === "string" && source.label.trim() ? source.label : fallback[index]?.label ?? `항목 ${index + 1}`,
        minutes: normalizeMinutes(String(source.minutes ?? fallback[index]?.minutes ?? "0")),
      };
    })
    .filter((row): row is DurationRow => Boolean(row));
  return rows.length > 0 ? rows : fallback;
}

function normalizeExtraCostRows(value: unknown) {
  if (!Array.isArray(value)) return defaultExtraCosts;
  const rows = value
    .map((row, index) => {
      if (!row || typeof row !== "object") return null;
      const source = row as Partial<ExtraCostRow>;
      return {
        id: typeof source.id === "string" && source.id ? source.id : createRowId(`cost_${index}`),
        label: typeof source.label === "string" && source.label.trim() ? source.label : defaultExtraCosts[index]?.label ?? `추가 비용 ${index + 1}`,
        price: typeof source.price === "string" ? source.price : defaultExtraCosts[index]?.price ?? "",
      };
    })
    .filter((row): row is ExtraCostRow => Boolean(row));
  return rows.length > 0 ? rows : defaultExtraCosts;
}

export function ReservationServicesSection<TService extends ServicePreview>({
  services,
  selectedServiceId,
  onSelect,
  onToggleVisibility,
  onUpdate,
}: {
  services: TService[];
  selectedServiceId: string;
  onSelect: (service: TService) => void;
  onToggleVisibility: (service: TService) => void;
  onUpdate: (service: TService, patch: Partial<Pick<ServicePreview, "price" | "duration">>) => void;
}) {
  return (
    <section className="rounded-[10px] border border-[#dbe2ea] bg-white">
      <div className="grid grid-cols-[1.5fr_220px_100px] border-b border-[#e5eaf0] bg-[#f8fafc] px-4 py-3 text-center text-[14px] font-semibold text-[#526176]">
        <span className="text-left">예약 서비스</span>
        <span>금액 / 예상소요 시간</span>
        <span>노출</span>
      </div>
      {services.map((service) => (
        <div
          key={service.id}
          onClick={() => onSelect(service)}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") onSelect(service);
          }}
          className={cn(
            "grid w-full cursor-pointer grid-cols-[1.5fr_220px_100px] items-center border-b border-[#edf2f7] px-4 py-3 text-left text-[15px] last:border-b-0 hover:bg-[#f8fafc]",
            selectedServiceId === service.id ? "bg-[#fbfdff]" : "bg-white",
          )}
        >
          <span className="min-w-0">
            <span className="block truncate font-normal text-[#111827]">{service.name}</span>
            <span className="mt-1 block truncate text-[13px] text-[#64748b]">{service.description || service.category}</span>
          </span>
          <span className="flex items-center justify-center gap-2 px-2">
            <input
              type="text"
              inputMode="numeric"
              value={formatServicePrice(service.price).replace("원~", "")}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => onUpdate(service, { price: event.target.value })}
              className="h-9 w-[86px] rounded-[8px] border border-transparent bg-[#f8fafc] px-2 text-right text-[14px] font-normal text-[#111827] outline-none focus:border-[#2f7866] focus:bg-white"
              aria-label={`${service.name} 금액`}
            />
            <span className="text-[13px] text-[#94a3b8]">/</span>
            <input
              type="text"
              inputMode="numeric"
              value={service.duration.replace(/[^0-9]/g, "")}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => onUpdate(service, { duration: event.target.value })}
              className="h-9 w-14 rounded-[8px] border border-transparent bg-[#f8fafc] px-2 text-right text-[14px] font-normal text-[#111827] outline-none focus:border-[#2f7866] focus:bg-white"
              aria-label={`${service.name} 예상소요 시간`}
            />
            <span className="text-[13px] text-[#64748b]">분</span>
          </span>
          <span className="flex justify-center" onClick={(event) => event.stopPropagation()}>
            <Switch
              checked={service.visible}
              size="sm"
              aria-label={`${service.name} 예약 노출`}
              onCheckedChange={() => onToggleVisibility(service)}
            />
          </span>
        </div>
      ))}
    </section>
  );
}

export function DurationGuideSection() {
  const [baseRows, setBaseRows] = useState<DurationRow[]>(() => {
    if (typeof window === "undefined") return defaultBaseDurations;
    try {
      const stored = window.localStorage.getItem(durationGuideStorageKey);
      if (!stored) return defaultBaseDurations;
      const parsed = JSON.parse(stored) as { baseRows?: unknown; extraRows?: unknown };
      return normalizeDurationRows(parsed.baseRows, defaultBaseDurations);
    } catch {
      window.localStorage.removeItem(durationGuideStorageKey);
      return defaultBaseDurations;
    }
  });
  const [extraRows, setExtraRows] = useState<DurationRow[]>(() => {
    if (typeof window === "undefined") return defaultAdditionalDurations;
    try {
      const stored = window.localStorage.getItem(durationGuideStorageKey);
      if (!stored) return defaultAdditionalDurations;
      const parsed = JSON.parse(stored) as { baseRows?: unknown; extraRows?: unknown };
      return normalizeDurationRows(parsed.extraRows, defaultAdditionalDurations);
    } catch {
      window.localStorage.removeItem(durationGuideStorageKey);
      return defaultAdditionalDurations;
    }
  });

  useEffect(() => {
    window.localStorage.setItem(durationGuideStorageKey, JSON.stringify({ baseRows, extraRows }));
  }, [baseRows, extraRows]);

  return (
    <section className="space-y-4">
      <DurationTable title="서비스 기본 시간" rows={baseRows} onChange={setBaseRows} addLabel="기본 시간 추가" />
      <DurationTable title="추가 조건 시간" rows={extraRows} onChange={setExtraRows} addLabel="조건 추가" />
    </section>
  );
}

function DurationTable({
  title,
  rows,
  onChange,
  addLabel,
}: {
  title: string;
  rows: DurationRow[];
  onChange: (rows: DurationRow[]) => void;
  addLabel: string;
}) {
  return (
    <div className="rounded-[10px] border border-[#dbe2ea] bg-white">
      <div className="flex items-center justify-between border-b border-[#e5eaf0] bg-[#f8fafc] px-4 py-3">
        <p className="text-[14px] font-semibold text-[#334155]">{title}</p>
        <button
          type="button"
          onClick={() => onChange([...rows, { id: createRowId("duration"), label: "새 항목", minutes: "10" }])}
          className="inline-flex h-8 items-center gap-1 rounded-[8px] border border-[#dbe2ea] bg-white px-2.5 text-[13px] font-medium text-[#334155]"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.9} />
          {addLabel}
        </button>
      </div>
      {rows.map((row) => (
        <div key={row.id} className="grid grid-cols-[1fr_120px_44px] items-center gap-2 border-b border-[#edf2f7] px-4 py-2.5 last:border-b-0">
          <input
            value={row.label}
            onChange={(event) => onChange(rows.map((item) => (item.id === row.id ? { ...item, label: event.target.value } : item)))}
            className="h-9 min-w-0 rounded-[8px] border border-transparent bg-[#f8fafc] px-3 text-[14px] text-[#111827] outline-none focus:border-[#2f7866] focus:bg-white"
          />
          <div className="flex items-center justify-end gap-1">
            <input
              value={row.minutes}
              inputMode="numeric"
              onChange={(event) => onChange(rows.map((item) => (item.id === row.id ? { ...item, minutes: normalizeMinutes(event.target.value) } : item)))}
              className="h-9 w-20 rounded-[8px] border border-transparent bg-[#f8fafc] px-2 text-right text-[14px] text-[#111827] outline-none focus:border-[#2f7866] focus:bg-white"
            />
            <span className="text-[13px] text-[#64748b]">분</span>
          </div>
          <button
            type="button"
            onClick={() => onChange(rows.filter((item) => item.id !== row.id))}
            disabled={rows.length <= 1}
            className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] text-[#94a3b8] hover:bg-[#f8fafc] disabled:opacity-35"
            aria-label="소요시간 항목 삭제"
          >
            <BasilIcon name="trash" />
          </button>
        </div>
      ))}
    </div>
  );
}

export function ExtraCostGuideSection() {
  const [rows, setRows] = useState<ExtraCostRow[]>(() => {
    if (typeof window === "undefined") return defaultExtraCosts;
    try {
      const stored = window.localStorage.getItem(extraCostGuideStorageKey);
      if (!stored) return defaultExtraCosts;
      return normalizeExtraCostRows(JSON.parse(stored));
    } catch {
      window.localStorage.removeItem(extraCostGuideStorageKey);
      return defaultExtraCosts;
    }
  });

  useEffect(() => {
    window.localStorage.setItem(extraCostGuideStorageKey, JSON.stringify(rows));
  }, [rows]);

  return (
    <section className="rounded-[10px] border border-[#dbe2ea] bg-white">
      <div className="flex items-center justify-between border-b border-[#e5eaf0] bg-[#f8fafc] px-4 py-3">
        <p className="text-[14px] font-semibold text-[#334155]">추가 비용</p>
        <button
          type="button"
          onClick={() => setRows([...rows, { id: createRowId("cost"), label: "새 항목", price: "" }])}
          className="inline-flex h-8 items-center gap-1 rounded-[8px] border border-[#dbe2ea] bg-white px-2.5 text-[13px] font-medium text-[#334155]"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.9} />
          항목 추가
        </button>
      </div>
      {rows.map((row) => (
        <div key={row.id} className="grid grid-cols-[1fr_160px_44px] items-center gap-2 border-b border-[#edf2f7] px-4 py-2.5 last:border-b-0">
          <input
            value={row.label}
            onChange={(event) => setRows(rows.map((item) => (item.id === row.id ? { ...item, label: event.target.value } : item)))}
            className="h-9 min-w-0 rounded-[8px] border border-transparent bg-[#f8fafc] px-3 text-[14px] text-[#111827] outline-none focus:border-[#2f7866] focus:bg-white"
          />
          <input
            value={row.price}
            onChange={(event) => setRows(rows.map((item) => (item.id === row.id ? { ...item, price: event.target.value } : item)))}
            placeholder="예: 5,000~"
            className="h-9 rounded-[8px] border border-transparent bg-[#f8fafc] px-3 text-right text-[14px] text-[#111827] outline-none placeholder:text-[#a3afbd] focus:border-[#2f7866] focus:bg-white"
          />
          <button
            type="button"
            onClick={() => setRows(rows.filter((item) => item.id !== row.id))}
            disabled={rows.length <= 1}
            className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] text-[#94a3b8] hover:bg-[#f8fafc] disabled:opacity-35"
            aria-label="추가 비용 항목 삭제"
          >
            <BasilIcon name="trash" />
          </button>
        </div>
      ))}
    </section>
  );
}
