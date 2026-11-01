"use client";

import { useEffect, useRef, useState } from "react";
import { buildCustomerDetailFromBootstrap, formatDate } from "@/components/owner-web/customer-detail-helpers";
import { GroomingRecordDetailPanel, PhotoLightbox, type GroomingPhotoPreview } from "@/components/owner-web/customer-detail-panel";
import { readGroomingHistory, readGroomingPhotos } from "@/lib/booking-grooming-history";
import type { BootstrapPayload, GroomingRecord } from "@/types/domain";

export function BookingGroomingHistory({ data, petId }: { data: BootstrapPayload; petId?: string | null }) {
  const [history, setHistory] = useState<{ records: GroomingRecord[]; total: number } | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    if (!petId) return;
    const controller = new AbortController();
    void readGroomingHistory(data.shop.id, petId, controller.signal).then(result => {
      if (!controller.signal.aborted) setHistory(result);
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [data.shop.id, petId, retry]);
  const selected = history?.records.find(record => record.id === selectedId && record.shop_id === data.shop.id && record.pet_id === petId);
  return <section className="pb-2 pt-4" data-booking-grooming-history>
    <div className="overflow-hidden rounded-[10px] border border-[#e5e8ec] bg-white">
      <div className="flex min-h-11 items-center justify-between gap-3 border-b border-[#f0f2f4] px-3.5 py-2.5"><h3 className="text-[16px] font-semibold leading-6 text-[#15213b]">최근 미용 기록</h3>{history && <span className="text-[14px] text-[#64748b]">총 {history.total}회</span>}</div>
      <div className="px-3.5 py-1 text-[14px] leading-5 text-[#64748b]">
        {!petId ? <p className="py-3">예약에 연결된 반려동물 정보가 없습니다.</p> : error ? <div role="alert" className="py-3"><p>미용 기록을 불러오지 못했습니다.</p><button type="button" onClick={() => { setHistory(null); setError(false); setSelectedId(null); setRetry(value => value + 1); }} className="min-h-11 underline">다시 불러오기</button></div> : !history ? <p role="status" className="py-3">미용 기록을 불러오는 중입니다.</p> : history.records.length ? history.records.slice(0, 2).map(record => <button type="button" key={record.id} onClick={() => setSelectedId(record.id)} className="block min-h-11 w-full border-b border-[#f0f2f4] py-3 text-left last:border-b-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500" data-visit-record={record.id}>
          <span className="flex flex-wrap gap-x-4 gap-y-1"><span className="tabular-nums">{formatDate(record.groomed_at)}</span><span className="min-w-0 break-words text-[#15213b]">{record.service_name_snapshot?.trim() || data.services.find(service => service.shop_id === data.shop.id && service.id === record.service_id)?.name || "서비스 정보 없음"}</span></span>
          <span className="mt-1 block line-clamp-2 break-words">{[record.style_notes, record.memo, record.internal_memo].map(value => value?.trim()).filter(Boolean).join(" · ") || "등록된 메모가 없습니다."}</span>
        </button>) : <p className="py-3">등록된 미용 기록이 없습니다.</p>}
      </div>
    </div>
    {selected && petId && <BookingGroomingRecordDetail key={`${data.shop.id}:${petId}:${selected.id}`} data={data} petId={petId} record={selected} onClose={() => setSelectedId(null)} />}
  </section>;
}

function BookingGroomingRecordDetail({ data, petId, record, onClose }: { data: BootstrapPayload; petId: string; record: GroomingRecord; onClose: () => void }) {
  const [photos, setPhotos] = useState<GroomingPhotoPreview[]>([]);
  const [photoState, setPhotoState] = useState<"loading" | "ready" | "error">("loading");
  const [retry, setRetry] = useState(0);
  const [expanded, setExpanded] = useState<{ preview: GroomingPhotoPreview; label: string } | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const pet = data.pets.find(item => item.shop_id === data.shop.id && item.id === petId);
  const detail = pet ? buildCustomerDetailFromBootstrap({ ...data,
    guardians: data.guardians.filter(item => item.shop_id === data.shop.id && item.id === pet.guardian_id),
    pets: [pet], groomingRecords: [record], notifications: [],
    services: data.services.filter(item => item.shop_id === data.shop.id),
    appointments: data.appointments.filter(item => item.shop_id === data.shop.id && item.pet_id === petId && item.id === record.appointment_id),
  }, pet.guardian_id, petId) : null;
  useEffect(() => {
    const controller = new AbortController();
    void readGroomingPhotos(data.shop.id, petId, record.id, controller.signal).then(result => {
      if (!controller.signal.aborted) { setPhotos(result); setPhotoState("ready"); }
    }).catch(() => { if (!controller.signal.aborted) setPhotoState("error"); });
    return () => controller.abort();
  }, [data.shop.id, petId, record.id, retry]);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    container.current?.focus();
    return () => previous?.focus();
  }, []);
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (expanded) { setExpanded(null); container.current?.focus(); } else onClose();
    };
    window.addEventListener("keydown", closeOnEscape, true);
    return () => window.removeEventListener("keydown", closeOnEscape, true);
  }, [expanded, onClose]);
  return <div ref={container} tabIndex={-1} role="dialog" aria-modal="true" aria-label="지난 미용 기록 상세" className="fixed inset-0 z-[65]" onKeyDown={event => {
    if (event.key === "Tab") {
      const controls = Array.from(container.current?.querySelectorAll<HTMLElement>('button:not([disabled]),[href],input,select,textarea,[tabindex="0"]') ?? []).filter(element => element.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === container.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === container.current)) { event.preventDefault(); first?.focus(); }
    }
  }}>
    {detail ? <GroomingRecordDetailPanel detail={detail} record={record} strictReadOnly photoSummary={{ before: null, after: null }} photos={photos} photoState={photoState} onRetryPhotos={() => { setPhotoState("loading"); setPhotos([]); setRetry(value => value + 1); }} onClose={onClose} onExpandPhoto={(preview, label) => setExpanded({ preview, label })} /> : <div role="alert" className="absolute inset-4 rounded-[10px] bg-white p-5"><p>기록에 연결된 반려동물 정보를 확인하지 못했습니다.</p><button type="button" className="min-h-11 px-3" onClick={onClose}>닫기</button></div>}
    {expanded && <PhotoLightbox photo={expanded} onClose={() => setExpanded(null)} />}
  </div>;
}
