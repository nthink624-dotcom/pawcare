"use client";

import { useEffect, useRef, useState } from "react";

import {
  fetchOwnerAppointmentVisitWeight,
  putOwnerAppointmentVisitWeight,
} from "@/components/owner-web/calendar-owner-api";
import type { AppointmentVisitWeightResponse } from "@/types/visit-weight";

function formatMeasuredAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric" }).format(date);
}

export function AppointmentVisitWeightEditor({ shopId, appointmentId }: { shopId: string; appointmentId: string }) {
  const [data, setData] = useState<AppointmentVisitWeightResponse>({ current: null, recent: null });
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const requestRef = useRef<{ value: string; key: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotice("");
    void fetchOwnerAppointmentVisitWeight(shopId, appointmentId)
      .then((next) => {
        if (cancelled) return;
        setData(next);
        setValue(next.current ? String(next.current.weightKg) : "");
      })
      .catch((error) => {
        if (!cancelled) setNotice(error instanceof Error ? error.message : "방문 몸무게를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [appointmentId, shopId]);

  async function save() {
    const normalized = value.trim().replace(",", ".");
    const weightKg = Number(normalized);
    if (!Number.isFinite(weightKg) || weightKg < 0.1 || weightKg > 200) {
      setNotice("몸무게는 0.1kg부터 200kg 사이로 입력해 주세요.");
      return;
    }

    const request = requestRef.current?.value === normalized
      ? requestRef.current
      : { value: normalized, key: crypto.randomUUID() };
    requestRef.current = request;
    setSaving(true);
    setNotice("");
    try {
      await putOwnerAppointmentVisitWeight({ shopId, appointmentId, weightKg, idempotencyKey: request.key });
      const canonical = await fetchOwnerAppointmentVisitWeight(shopId, appointmentId);
      if (!canonical.current || canonical.current.weightKg !== weightKg) {
        throw new Error("저장된 몸무게를 다시 확인하지 못했습니다. 입력한 값은 유지되었어요.");
      }
      setData(canonical);
      setValue(String(canonical.current.weightKg));
      setNotice("오늘 몸무게가 저장되었습니다.");
      requestRef.current = null;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "오늘 몸무게를 저장하지 못했습니다. 입력한 값은 유지되었어요.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="border-b border-[#eef0f2] py-4" aria-labelledby="visit-weight-title">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id="visit-weight-title" className="text-[14px] font-medium leading-5 text-[#334155]">오늘 몸무게</h3>
          <p className="mt-1 text-[13px] font-normal leading-5 text-[#64748b]">
            이 예약에서 직접 측정한 값만 저장해요.
          </p>
        </div>
        {data.recent && !data.current ? (
          <p className="shrink-0 text-right text-[13px] font-normal leading-5 text-[#64748b] tabular-nums">
            최근 몸무게<br />
            <span className="font-medium text-[#334155]">{data.recent.weightKg}kg · {formatMeasuredAt(data.recent.measuredAt)}</span>
          </p>
        ) : null}
      </div>
      <div className="mt-3 grid min-w-0 grid-cols-[minmax(0,1fr)_88px] gap-2">
        <label className="relative block min-w-0">
          <span className="sr-only">오늘 몸무게</span>
          <input
            type="number"
            inputMode="decimal"
            min="0.1"
            max="200"
            step="0.1"
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setNotice("");
              requestRef.current = null;
            }}
            disabled={loading || saving}
            placeholder={loading ? "불러오는 중" : "0.0"}
            className="min-h-11 w-full min-w-0 rounded-[8px] border border-[#dbe2ea] bg-white px-3 pr-10 text-[16px] font-medium leading-6 text-[#15213b] outline-none placeholder:text-[#94a3b8] focus-visible:border-[#607080] focus-visible:ring-2 focus-visible:ring-[#2563eb] disabled:bg-[#f8fafc] disabled:text-[#94a3b8]"
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[14px] font-medium leading-5 text-[#64748b]">kg</span>
        </label>
        <button
          type="button"
          onClick={() => void save()}
          disabled={loading || saving || !value.trim()}
          className="inline-flex min-h-11 items-center justify-center rounded-[8px] bg-[#15213b] px-3 text-[16px] font-medium leading-6 text-white transition hover:bg-[#223252] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] disabled:cursor-not-allowed disabled:bg-[#cbd5e1]"
        >
          {saving ? "저장 중" : "저장"}
        </button>
      </div>
      {data.current ? (
        <p className="mt-2 text-[13px] font-normal leading-5 text-[#64748b] tabular-nums">
          이 예약에 저장된 오늘 몸무게 {data.current.weightKg}kg
        </p>
      ) : null}
      {notice ? (
        <p className="mt-2 text-[13px] font-normal leading-5 text-[#64748b]" role="status" aria-live="polite">{notice}</p>
      ) : null}
    </section>
  );
}
