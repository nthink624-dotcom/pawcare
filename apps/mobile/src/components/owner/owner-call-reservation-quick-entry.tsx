"use client";

import { useEffect, useMemo, useState } from "react";

import { fetchApiJsonWithAuth } from "@/lib/api";
import {
  clearOwnerCallReservationAction,
  isOwnerCallScreeningAvailable,
  syncOwnerCallScreeningEvents,
  type OwnerCallReservationAction,
} from "@/lib/owner-call-screening";
import { currentDateInTimeZone, phoneNormalize } from "@/lib/utils";
import type { BootstrapPayload } from "@/types/domain";

type CallEvent = {
  id: string;
  providerEventId: string;
  matchStatus: "matched" | "unmatched" | "ambiguous";
  appointmentId: string | null;
  matchedGuardian: { id: string; name: string } | null;
};

function nextQuarterHour() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "10");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  const rounded = Math.ceil((hour * 60 + minute) / 15) * 15;
  return `${String(Math.floor(rounded / 60) % 24).padStart(2, "0")}:${String(rounded % 60).padStart(2, "0")}`;
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return value;
}

export default function OwnerCallReservationQuickEntry({
  data,
  action,
  onClose,
  onSaved,
}: {
  data: BootstrapPayload;
  action: OwnerCallReservationAction;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [callEvent, setCallEvent] = useState<CallEvent | null>(null);
  const [petId, setPetId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [appointmentDate, setAppointmentDate] = useState(currentDateInTimeZone);
  const [appointmentTime, setAppointmentTime] = useState(nextQuarterHour);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedNumber = phoneNormalize(action.callerNumber);
  const localMatches = useMemo(
    () => data.guardians.filter((guardian) => !guardian.deleted_at && phoneNormalize(guardian.phone) === normalizedNumber),
    [data.guardians, normalizedNumber],
  );
  const localGuardian = localMatches.length === 1 ? localMatches[0] : null;
  const guardianId = callEvent?.matchedGuardian?.id ?? localGuardian?.id ?? "";
  const pets = useMemo(
    () => data.pets.filter((pet) => pet.guardian_id === guardianId),
    [data.pets, guardianId],
  );
  const activeServices = useMemo(() => data.services.filter((service) => service.is_active), [data.services]);
  const selectedPet = pets.find((pet) => pet.id === petId) ?? null;

  useEffect(() => {
    if (pets.length === 1) setPetId(pets[0].id);
    else if (!pets.some((pet) => pet.id === petId)) setPetId("");
  }, [pets, petId]);

  useEffect(() => {
    let active = true;
    const loadCallEvent = async () => {
      setLoading(true);
      setError(null);
      const listEvents = () => fetchApiJsonWithAuth<{ events: CallEvent[] }>(
        `/api/owner/call-events?shopId=${encodeURIComponent(data.shop.id)}&limit=30`,
        { cache: "no-store" },
      );
      try {
        const providerEventId = `${action.providerCallId}:incoming`;
        let events = (await listEvents()).events ?? [];
        if (!events.some((event) => event.providerEventId === providerEventId)) {
          if (isOwnerCallScreeningAvailable()) await syncOwnerCallScreeningEvents(data.shop.id);
          events = (await listEvents()).events ?? [];
        }
        if (!active) return;
        const target = events.find((event) => event.providerEventId === providerEventId);
        if (!target || target.matchStatus !== "matched" || !target.matchedGuardian || target.appointmentId) {
          setError(target?.appointmentId
            ? "이 통화에는 이미 예약이 연결되어 있어요."
            : "통화한 고객을 확인하지 못했어요. 연결을 다시 확인해 주세요.");
          return;
        }
        setCallEvent(target);
        void clearOwnerCallReservationAction();
      } catch {
        if (active) setError("통화 정보를 불러오지 못했어요. 다시 확인해 주세요.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadCallEvent();
    return () => { active = false; };
  }, [action.providerCallId, data.shop.id]);

  async function save() {
    if (!callEvent || !guardianId || !petId || !serviceId || !appointmentDate || !appointmentTime) return;
    setSaving(true);
    setError(null);
    try {
      await fetchApiJsonWithAuth(`/api/owner/call-events/${callEvent.id}/reservation`, {
        method: "POST",
        body: JSON.stringify({
          shopId: data.shop.id,
          petId,
          serviceId,
          staffId: null,
          appointmentDate,
          appointmentTime,
          memo: "",
        }),
      });
      setSaved(true);
      onSaved?.();
    } catch (saveError) {
      setError("예약을 등록하지 못했어요. 입력한 내용은 그대로 두고 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  }

  const customerName = callEvent?.matchedGuardian?.name ?? localGuardian?.name ?? "고객 확인 중";
  const canSave = Boolean(callEvent && guardianId && petId && serviceId && appointmentDate && appointmentTime);

  return (
    <section className="mx-auto w-full max-w-[560px] space-y-4" aria-label="전화 예약 등록">
      <div className="rounded-[14px] border border-[#e8edf3] bg-white p-4">
        <p className="text-[16px] font-medium leading-6 text-[#15213b]">{customerName}</p>
        <p className="mt-1 text-[14px] leading-5 text-[#64748b]">{formatPhone(action.callerNumber)}</p>
        {pets.length === 1 && selectedPet ? <p className="mt-3 text-[14px] leading-5 text-[#334155]">반려동물 · {selectedPet.name}</p> : null}
      </div>

      {saved ? (
        <div className="rounded-[14px] border border-[#cfe5dc] bg-white p-5" role="status">
          <p className="text-[18px] font-semibold leading-6 text-[#15213b]">예약을 등록했어요</p>
          <p className="mt-2 text-[14px] leading-5 text-[#64748b]">{customerName} · {selectedPet?.name} · {activeServices.find((service) => service.id === serviceId)?.name}</p>
          <button type="button" onClick={onClose} className="mt-4 min-h-11 w-full rounded-[10px] bg-[#111a30] px-4 text-[16px] font-medium text-white">닫기</button>
        </div>
      ) : (
        <div className="space-y-4 rounded-[14px] border border-[#e8edf3] bg-white p-4">
          {pets.length > 1 ? (
            <label className="grid gap-1.5">
              <span className="text-[14px] font-medium leading-5 text-[#334155]">반려동물</span>
              <select value={petId} onChange={(event) => setPetId(event.target.value)} className="min-h-12 rounded-[10px] border border-[#e8edf3] bg-white px-3 text-[16px] text-[#15213b]">
                <option value="">반려동물 선택</option>
                {pets.map((pet) => <option key={pet.id} value={pet.id}>{pet.name}</option>)}
              </select>
            </label>
          ) : null}

          <fieldset className="grid gap-2">
            <legend className="mb-1 text-[14px] font-medium leading-5 text-[#334155]">서비스</legend>
            <div className="grid grid-cols-2 gap-2">
              {activeServices.map((service) => (
                <button key={service.id} type="button" aria-pressed={serviceId === service.id} onClick={() => setServiceId(service.id)} className={`min-h-11 rounded-[10px] border px-3 text-left text-[14px] font-medium leading-5 ${serviceId === service.id ? "border-[#2563eb] bg-[#f3f7ff] text-[#1d4ed8]" : "border-[#e8edf3] bg-white text-[#334155]"}`}>
                  {service.name}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1.5">
              <span className="text-[14px] font-medium leading-5 text-[#334155]">날짜</span>
              <input type="date" value={appointmentDate} onChange={(event) => setAppointmentDate(event.target.value)} className="min-h-12 min-w-0 rounded-[10px] border border-[#e8edf3] bg-white px-2 text-[16px] text-[#15213b]" />
            </label>
            <label className="grid gap-1.5">
              <span className="text-[14px] font-medium leading-5 text-[#334155]">시간</span>
              <input type="time" value={appointmentTime} onChange={(event) => setAppointmentTime(event.target.value)} className="min-h-12 min-w-0 rounded-[10px] border border-[#e8edf3] bg-white px-2 text-[16px] text-[#15213b]" />
            </label>
          </div>

          {error ? <p role="alert" className="rounded-[10px] border border-[#efd6d0] bg-[#fff8f6] px-3 py-2.5 text-[14px] leading-5 text-[#9a5e4e]">{error}</p> : null}
          {loading ? <p role="status" className="text-[13px] leading-5 text-[#64748b]">전화 정보 확인 중이에요. 예약 항목은 먼저 선택할 수 있어요.</p> : null}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button type="button" onClick={onClose} className="min-h-12 rounded-[10px] border border-[#e8edf3] bg-white px-4 text-[16px] font-medium text-[#334155]">취소</button>
            <button type="button" onClick={() => void save()} disabled={!canSave || saving} className="min-h-12 rounded-[10px] bg-[#111a30] px-4 text-[16px] font-medium text-white disabled:opacity-50">{saving ? "저장 중…" : "예약 등록하기"}</button>
          </div>
        </div>
      )}
    </section>
  );
}
