"use client";

import { PhoneCall, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { InfoTip } from "@/components/owner/owner-app-ui";
import { fetchApiJsonWithAuth } from "@/lib/api";
import {
  configureOwnerCallScreening,
  getOwnerCallScreeningStatus,
  isOwnerCallScreeningAvailable,
  requestOwnerCallLogAccess,
  setOwnerCallScreeningEnabled,
  requestOwnerCallScreeningRole,
  syncOwnerCallScreeningPhoneAllowlist,
  syncOwnerCallScreeningEvents,
  clearOwnerCallReservationAction,
  type OwnerCallReservationAction,
} from "@/lib/owner-call-screening";
import { currentDateInTimeZone } from "@/lib/utils";
import type { BootstrapPayload } from "@/types/domain";

type CatchCallEvent = {
  id: string;
  providerEventId: string;
  eventType: "incoming" | "missed" | "answered" | "ended";
  direction: "inbound" | "outbound";
  phoneTail: string;
  occurredAt: string;
  matchStatus: "matched" | "unmatched" | "ambiguous";
  appointmentId: string | null;
  reservationStatus: "not_started" | "in_progress" | "confirmed" | "failed" | null;
  notificationStatus: "not_requested" | "queued" | "sent" | "failed" | "skipped" | null;
  matchedGuardian: { id: string; name: string } | null;
};

type CatchCallResponse = { events: CatchCallEvent[] };

function getCatchCallErrorMessage(error: unknown, fallback: string) {
  const rawMessage = error instanceof Error ? error.message : "";
  const normalizedMessage = rawMessage.toLowerCase();
  if (
    error instanceof TypeError ||
    normalizedMessage.includes("failed to fetch") ||
    normalizedMessage.includes("load failed") ||
    normalizedMessage.includes("networkerror")
  ) {
    return "네트워크 연결을 확인한 뒤 다시 시도해 주세요.";
  }
  return rawMessage || fallback;
}

const eventLabels: Record<CatchCallEvent["eventType"], string> = {
  incoming: "수신",
  missed: "부재중",
  answered: "응답",
  ended: "통화 종료",
};

function formatOccurredAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "시간 확인 필요";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function eventStatusLabel(event: CatchCallEvent) {
  if (event.appointmentId) {
    if (event.notificationStatus === "sent") return "알림톡 발송됨";
    if (event.notificationStatus === "failed") return "알림톡 재시도 필요";
    if (event.eventType === "ended") return "예약 저장됨";
    return "통화 종료 후 발송";
  }
  if (event.matchStatus === "ambiguous") return "고객 확인 필요";
  if (event.matchStatus === "unmatched") return "새 고객 확인 필요";
  return "예약 없음";
}

export default function OwnerCatchCallPanel({
  data,
  pendingReservationAction = null,
}: {
  data: BootstrapPayload;
  pendingReservationAction?: OwnerCallReservationAction | null;
}) {
  const [events, setEvents] = useState<CatchCallEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [petId, setPetId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [appointmentDate, setAppointmentDate] = useState(currentDateInTimeZone());
  const [appointmentTime, setAppointmentTime] = useState("10:00");
  const [memo, setMemo] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [callScreeningStatus, setCallScreeningStatus] = useState<{
    available: boolean;
    enabled: boolean;
    active: boolean;
    phoneStateGranted: boolean;
    callLogGranted: boolean;
  } | null>(null);
  const [configuringCallScreening, setConfiguringCallScreening] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? null;
  const guardianId = selectedEvent?.matchedGuardian?.id ?? null;
  const guardianPets = useMemo(
    () => (guardianId ? data.pets.filter((pet) => pet.guardian_id === guardianId) : []),
    [data.pets, guardianId],
  );
  const services = useMemo(() => data.services.filter((service) => service.is_active), [data.services]);
  const phoneAllowlist = useMemo(
    () => data.guardians.filter((guardian) => !guardian.deleted_at && guardian.phone.trim()).map((guardian) => guardian.phone.trim()),
    [data.guardians],
  );
  const selectedPet = guardianPets.find((pet) => pet.id === petId) ?? null;
  const selectedService = services.find((service) => service.id === serviceId) ?? null;

  async function loadEvents(showSpinner = true) {
    if (showSpinner) setLoading(true);
    else setRefreshing(true);
    try {
      if (isOwnerCallScreeningAvailable()) await syncOwnerCallScreeningEvents(data.shop.id);
      const response = await fetchApiJsonWithAuth<CatchCallResponse>(
        `/api/owner/call-events?shopId=${encodeURIComponent(data.shop.id)}&limit=30`,
        { cache: "no-store" },
      );
      const nextEvents = response.events ?? [];
      setEvents(nextEvents);
      if (pendingReservationAction?.pending) {
        const target = nextEvents.find(
          (event) => event.providerEventId === `${pendingReservationAction.providerCallId}:incoming` && event.matchStatus === "matched" && !event.appointmentId,
        );
        if (target) {
          selectEvent(target);
          await clearOwnerCallReservationAction();
        }
      }
      setMessage(null);
    } catch (error) {
      setMessage({ type: "error", text: getCatchCallErrorMessage(error, "통화 기록을 불러오지 못했습니다.") });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadEvents();
    void syncOwnerCallScreeningPhoneAllowlist(phoneAllowlist).catch(() => undefined);
    void getOwnerCallScreeningStatus().then(async (status) => {
      setCallScreeningStatus(status);
      if (status.available && status.enabled && !status.callLogGranted) {
        try {
          await requestOwnerCallLogAccess();
          setCallScreeningStatus(await getOwnerCallScreeningStatus());
        } catch {
          // The panel renders a retry button when Android keeps the permission denied.
        }
      }
    });
    // The shop is the only external input for this panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.shop.id, pendingReservationAction?.providerCallId, phoneAllowlist]);

  async function retryCallLogPermission() {
    setMessage(null);
    try {
      const result = await requestOwnerCallLogAccess();
      const nextStatus = await getOwnerCallScreeningStatus();
      setCallScreeningStatus(nextStatus);
      setMessage({
        type: result.granted ? "success" : "error",
        text: result.granted
          ? "통화 기록 권한이 허용됐습니다. 이제 등록 고객의 수신 전화를 감지할 수 있습니다."
          : "통화 기록 권한이 필요합니다. Android 설정에서 권한을 허용해 주세요.",
      });
    } catch (error) {
      setMessage({ type: "error", text: getCatchCallErrorMessage(error, "통화 기록 권한을 허용하지 못했습니다.") });
    }
  }

  async function enableAutomaticCallScreening() {
    setConfiguringCallScreening(true);
    setMessage(null);
    try {
      await configureOwnerCallScreening(data.shop.id, phoneAllowlist);
      const status = await getOwnerCallScreeningStatus();
      if (status.available && !status.enabled) await requestOwnerCallScreeningRole();
      const nextStatus = await getOwnerCallScreeningStatus();
      setCallScreeningStatus(nextStatus);
      setMessage({
        type: nextStatus.enabled ? "success" : "error",
        text: nextStatus.enabled
          ? "자동 통화 확인이 켜졌어요. 등록된 고객 전화만 자동으로 연결합니다."
          : "Android 설정에서 펫매니저를 통화 확인 앱으로 선택해 주세요.",
      });
    } catch (error) {
      setMessage({ type: "error", text: getCatchCallErrorMessage(error, "자동 통화 확인을 켜지 못했습니다.") });
    } finally {
      setConfiguringCallScreening(false);
    }
  }

  async function toggleAutomaticCallScreening() {
    if (!callScreeningStatus?.enabled) {
      await enableAutomaticCallScreening();
      return;
    }
    setConfiguringCallScreening(true);
    setMessage(null);
    try {
      const nextEnabled = !callScreeningStatus.active;
      if (nextEnabled) {
        await configureOwnerCallScreening(data.shop.id, phoneAllowlist);
      } else {
        await setOwnerCallScreeningEnabled(false);
      }
      const nextStatus = await getOwnerCallScreeningStatus();
      setCallScreeningStatus(nextStatus);
      setMessage({
        type: "success",
        text: nextStatus.active ? "캐치콜을 켰어요." : "캐치콜을 껐어요. 일반 전화만 받을 수 있습니다.",
      });
    } catch (error) {
      setMessage({ type: "error", text: getCatchCallErrorMessage(error, "캐치콜 상태를 변경하지 못했습니다.") });
    } finally {
      setConfiguringCallScreening(false);
    }
  }

  function selectEvent(event: CatchCallEvent) {
    if (!event.matchedGuardian || event.appointmentId) return;
    const firstPet = data.pets.find((pet) => pet.guardian_id === event.matchedGuardian?.id);
    setSelectedEventId(event.id);
    setPetId(firstPet?.id ?? "");
    setServiceId(services[0]?.id ?? "");
    setStaffId("");
    setAppointmentDate(currentDateInTimeZone());
    setAppointmentTime("10:00");
    setMemo("");
    setMessage(null);
  }

  async function saveReservation() {
    if (!selectedEvent || !guardianId || !petId || !serviceId || !appointmentDate || !appointmentTime) {
      setMessage({ type: "error", text: "반려동물, 서비스, 날짜와 시간을 확인해 주세요." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const result = await fetchApiJsonWithAuth<{
        notificationStatus: string;
      }>(`/api/owner/call-events/${selectedEvent.id}/reservation`, {
        method: "POST",
        body: JSON.stringify({
          shopId: data.shop.id,
          petId,
          serviceId,
          staffId: staffId || null,
          appointmentDate,
          appointmentTime,
          memo,
        }),
      });
      setMessage({
        type: "success",
        text:
          result.notificationStatus === "sent"
            ? "예약을 저장하고 보호자에게 알림톡을 보냈어요."
            : "예약을 저장했어요. 통화 종료 후 알림톡이 발송됩니다.",
      });
      setSelectedEventId(null);
      await loadEvents(false);
    } catch (error) {
      setMessage({ type: "error", text: getCatchCallErrorMessage(error, "통화 예약을 저장하지 못했습니다.") });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4" aria-label="캐치콜">
      {message ? (
        <p
          role={message.type === "error" ? "alert" : "status"}
          className={`rounded-[10px] border px-3.5 py-3 text-[13px] font-medium leading-5 ${
            message.type === "error" ? "border-[#efd6d0] bg-[#fff8f6] text-[#9a5e4e]" : "border-[#cfe5dc] bg-[#f5fbf8] text-[#1f6b5b]"
          }`}
        >
          {message.text}
        </p>
      ) : null}

      <div className="rounded-[14px] border border-[#dfe7f1] bg-white p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-[#eef4ff] text-[#2f6fd6]">
            <PhoneCall className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="text-[16px] font-semibold leading-6 text-[#15213b]">자동 통화 확인</h3>
              <InfoTip ariaLabel="자동 통화 확인 도움말" popoverClassName="!left-1/2 !right-auto !-translate-x-1/2 w-[240px]">
                펫매니저에 등록된 고객 전화만 자동으로 찾아 예약 화면에 연결합니다. 개인 전화는 기록하지 않습니다.
              </InfoTip>
            </div>
          </div>
        </div>
        {callScreeningStatus?.enabled ? (
          <div className="mt-3 rounded-[10px] bg-[#f5fbf8] px-3 py-2.5 text-[#1f6b5b]">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] font-medium leading-5">캐치콜 자동 감지</p>
              <button
                type="button"
                role="switch"
                aria-checked={callScreeningStatus.active}
                aria-label="캐치콜 자동 감지 켜기 또는 끄기"
                onClick={() => void toggleAutomaticCallScreening()}
                disabled={configuringCallScreening}
                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${callScreeningStatus.active ? "bg-[#2563eb]" : "bg-[#cbd5e1]"}`}
              >
                <span className={`absolute top-1 size-5 rounded-full bg-white shadow-sm transition-transform ${callScreeningStatus.active ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>
            <p className="mt-1 text-[12px] leading-5 text-[#457867]">{callScreeningStatus.active ? "등록 고객 전화가 캐치콜로 감지됩니다." : "꺼져 있어 일반 전화만 받을 수 있습니다."}</p>
          </div>
        ) : callScreeningStatus?.available ? (
          <button type="button" onClick={() => void enableAutomaticCallScreening()} disabled={configuringCallScreening} className="mt-3 min-h-12 w-full rounded-[10px] bg-[#111a30] px-4 text-[16px] font-medium text-white disabled:opacity-50">
            {configuringCallScreening ? "연결 준비 중..." : "자동 통화 확인 켜기"}
          </button>
        ) : (
          <p className="mt-3 rounded-[10px] bg-[#f8fafc] px-3 py-2.5 text-[13px] leading-5 text-[#64748b]">Android 앱에서만 자동 통화 확인을 사용할 수 있습니다.</p>
        )}
      </div>

      {selectedEvent ? (
        <div className="space-y-4 rounded-[14px] border border-[#dfe7f1] bg-white p-4">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-[#eef4ff] text-[#2f6fd6]">
              <PhoneCall className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-medium leading-6 text-[#15213b]">{selectedEvent.matchedGuardian?.name} 보호자</p>
              <p className="mt-0.5 text-[13px] leading-5 text-[#64748b]">010-****-{selectedEvent.phoneTail} · {formatOccurredAt(selectedEvent.occurredAt)}</p>
            </div>
          </div>
          <div className="grid gap-3">
            <label className="grid gap-1.5">
              <span className="text-[14px] font-medium leading-5 text-[#334155]">반려동물</span>
              <select value={petId} onChange={(event) => setPetId(event.target.value)} className="min-h-12 rounded-[10px] border border-[#e8edf3] bg-white px-3 text-[16px] text-[#15213b] outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]">
                <option value="">반려동물 선택</option>
                {guardianPets.map((pet) => <option key={pet.id} value={pet.id}>{pet.name}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="text-[14px] font-medium leading-5 text-[#334155]">서비스</span>
              <select value={serviceId} onChange={(event) => setServiceId(event.target.value)} className="min-h-12 rounded-[10px] border border-[#e8edf3] bg-white px-3 text-[16px] text-[#15213b] outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]">
                <option value="">서비스 선택</option>
                {services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1.5">
                <span className="text-[14px] font-medium leading-5 text-[#334155]">예약 날짜</span>
                <input type="date" value={appointmentDate} onChange={(event) => setAppointmentDate(event.target.value)} className="min-h-12 rounded-[10px] border border-[#e8edf3] bg-white px-3 text-[16px] text-[#15213b] outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]" />
              </label>
              <label className="grid gap-1.5">
                <span className="text-[14px] font-medium leading-5 text-[#334155]">예약 시간</span>
                <input type="time" value={appointmentTime} onChange={(event) => setAppointmentTime(event.target.value)} className="min-h-12 rounded-[10px] border border-[#e8edf3] bg-white px-3 text-[16px] text-[#15213b] outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]" />
              </label>
            </div>
            <label className="grid gap-1.5">
              <span className="text-[14px] font-medium leading-5 text-[#334155]">담당자 <span className="font-normal text-[#94a3b8]">선택</span></span>
              <select value={staffId} onChange={(event) => setStaffId(event.target.value)} className="min-h-12 rounded-[10px] border border-[#e8edf3] bg-white px-3 text-[16px] text-[#15213b] outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]">
                <option value="">자동 배정</option>
                {data.staffMembers.map((staff) => <option key={staff.id} value={staff.id}>{staff.name}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="text-[14px] font-medium leading-5 text-[#334155]">메모 <span className="font-normal text-[#94a3b8]">선택</span></span>
              <textarea value={memo} onChange={(event) => setMemo(event.target.value)} rows={3} placeholder="통화 중 확인한 요청사항" className="resize-none rounded-[10px] border border-[#e8edf3] bg-white px-3 py-2.5 text-[16px] leading-6 text-[#15213b] outline-none placeholder:text-[#94a3b8] focus-visible:ring-2 focus-visible:ring-[#2563eb]" />
            </label>
          </div>
          {selectedPet && selectedService ? <p className="text-[13px] leading-5 text-[#64748b]">{selectedPet.name} · {selectedService.name} · {selectedService.duration_minutes}분</p> : null}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setSelectedEventId(null)} className="min-h-12 rounded-[10px] border border-[#e8edf3] bg-white px-4 text-[16px] font-medium text-[#334155]">취소</button>
            <button type="button" onClick={() => void saveReservation()} disabled={saving || guardianPets.length === 0 || services.length === 0} className="min-h-12 rounded-[10px] bg-[#111a30] px-4 text-[16px] font-medium text-white disabled:opacity-50">{saving ? "저장 중..." : "예약 확정"}</button>
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-[16px] font-semibold leading-6 text-[#15213b]">최근 통화</h3>
          <button
            type="button"
            onClick={() => void loadEvents(false)}
            disabled={refreshing || loading}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[10px] border border-[#e8edf3] bg-white text-[#64748b] outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] disabled:opacity-50"
            aria-label="통화 기록 새로고침"
          >
            <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
          </button>
        </div>
        {loading ? <div className="rounded-[14px] border border-[#e8edf3] bg-white px-4 py-6 text-center text-[14px] text-[#64748b]">통화 기록을 불러오는 중입니다.</div> : null}
        {!loading && events.length === 0 && !message ? <div className="rounded-[14px] border border-[#e8edf3] bg-white px-4 py-6 text-center text-[14px] leading-5 text-[#64748b]">아직 들어온 통화가 없습니다.</div> : null}
        {!loading ? events.map((event) => {
          const canReserve = event.matchStatus === "matched" && Boolean(event.matchedGuardian) && !event.appointmentId;
          return (
            <button key={event.id} type="button" onClick={() => selectEvent(event)} disabled={!canReserve} className="flex min-h-[72px] w-full items-center gap-3 rounded-[14px] border border-[#e8edf3] bg-white px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] disabled:cursor-default disabled:opacity-75">
              <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[#f1f5f9] text-[#64748b]"><PhoneCall className="size-4" aria-hidden="true" /></span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2"><span className="truncate text-[16px] font-medium leading-6 text-[#15213b]">{event.matchedGuardian?.name ?? "확인되지 않은 통화"}</span><span className="shrink-0 text-[12px] font-medium leading-[18px] text-[#64748b]">{eventLabels[event.eventType]}</span></span>
                <span className="mt-0.5 block text-[13px] leading-5 text-[#64748b]">010-****-{event.phoneTail} · {formatOccurredAt(event.occurredAt)}</span>
              </span>
              <span className={`shrink-0 text-[12px] font-medium leading-[18px] ${event.notificationStatus === "failed" ? "text-[#9a5e4e]" : event.appointmentId ? "text-[#1f6b5b]" : "text-[#64748b]"}`}>{eventStatusLabel(event)}</span>
            </button>
          );
        }) : null}
      </div>
    </section>
  );
}
