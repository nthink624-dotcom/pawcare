"use client";

import { Check, ChevronLeft, UserRound } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { CustomerServiceSourceOption } from "@/lib/customer-service-options";
import { getStaffCustomerName, getStaffCustomerTitle } from "@/lib/staff-display";
import { formatServicePrice, phoneNormalize } from "@/lib/utils";
import type { Appointment, BootstrapStaffMember, Service, Shop } from "@/types/domain";

type FirstVisitStep = 1 | 2 | 3 | 4 | 5;

type DateOption = {
  value: string;
  label: string;
  weekday: string;
};

type FirstVisitForm = {
  ownerName: string;
  phone: string;
  petName: string;
  breed: string;
  date: string;
  timeSlot: string;
  staffId: string;
  serviceId: string;
  customerServiceOptionId: string;
  customServiceName: string;
  note: string;
};

type BookingCompletion = {
  appointment: Appointment;
  bookingManageUrl: string;
};

function isValidBookingPhoneNumber(value: string) {
  const digits = phoneNormalize(value);
  if (digits.startsWith("02")) return digits.length === 9 || digits.length === 10;
  return digits.length === 10 || digits.length === 11;
}

type SavedBookingPet = {
  id: string;
  name: string;
  breed: string;
};

const CUSTOM_SERVICE_ID = "__custom__";
const popularBreedChips = ["말티즈", "푸들", "포메라니안", "비숑", "시츄", "믹스", "치와와", "말티푸", "요크셔테리어", "스피츠", "슈나우저", "코카스파니엘", "닥스훈트", "웰시코기", "직접 입력"];

function formatDurationRange(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) return "상담 후 안내";
  if (minutes <= 30) return "30분~60분";
  if (minutes <= 60) return "60분~90분";
  if (minutes <= 90) return "90분~120분";
  return `${minutes}분~${minutes + 30}분`;
}

function formatDateChipTitle(date: DateOption, previousDate?: DateOption) {
  if (date.label === "오늘") return "오늘";
  if (previousDate?.label === "오늘") return "내일";
  return date.weekday;
}

function formatDateChipSubtitle(date: DateOption) {
  const parsed = new Date(`${date.value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date.label.includes("/") ? date.label.replace("/", ".") : date.label;
  return `${parsed.getMonth() + 1}.${String(parsed.getDate()).padStart(2, "0")}`;
}

function formatDateForSummary(value: string) {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${weekdays[date.getDay()]})`;
}

function formatTimeForSummary(value: string) {
  if (!value) return "-";
  const [hour, minute] = value.split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value;
  return `${hour < 12 ? "오전" : "오후"} ${String(hour % 12 || 12).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function buildReservationNumber(appointment?: Appointment | null) {
  if (!appointment) return "접수 후 발급";
  const datePart = appointment.appointment_date.replace(/-/g, "").slice(2);
  const rawSuffix = appointment.id.replace(/\D/g, "").slice(-3) || appointment.id.replace(/-/g, "").slice(-3).toUpperCase();
  return `PM${datePart}-${rawSuffix.padStart(3, "0")}`;
}

function timeSlotMinutes(slot: string) {
  const [hour, minute] = slot.split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return Number.POSITIVE_INFINITY;
  return hour * 60 + minute;
}

function buildFallbackRecommendedSlots(availableSlots: string[]) {
  const firstSlot = availableSlots[0] ?? "";
  const afterLunchSlot = availableSlots.find((slot) => timeSlotMinutes(slot) >= 14 * 60) ?? "";
  return Array.from(new Set([firstSlot, afterLunchSlot, ...availableSlots].filter(Boolean))).slice(0, 2);
}

function ClaudeStyles() {
  return (
    <style>{`
      .pm-proto{--text:#3a2e2a;--textMid:#8a7a72;--textMuted:#b6a89f;--primary:#ec7f72;--primaryDk:#d35f50;--primarySoft:#fce9e4;--surface:#fdf7f5;--track:#f6e2db;--border:#efe2dc;--borderSoft:#f5ebe6;--card:#fff;--r:14px;--rbtn:12px;position:relative;min-height:100dvh;background:var(--surface);color:var(--text);font-family:inherit;overflow:hidden}
      .pm-proto *{box-sizing:border-box}
      .pm-proto .nav{position:sticky;top:0;z-index:8;display:flex;align-items:center;padding:10px 16px;background:var(--surface);border-bottom:1px solid var(--borderSoft)}
      .pm-proto .nav .back{width:30px;height:30px;border:none;background:none;display:flex;align-items:center;justify-content:center;cursor:pointer;border-radius:10px;color:var(--text);margin-right:6px}
      .pm-proto .nav .ttl{font-size:17px;font-weight:700;letter-spacing:-.02em}
      .pm-proto .pgscroll{height:calc(100dvh - 51px);overflow:auto;scrollbar-width:none;padding:12px 16px 118px;display:flex;flex-direction:column;gap:18px}
      .pm-proto .pgscroll::-webkit-scrollbar{display:none}
      .pm-proto .sec h3{font-size:15px;font-weight:700;color:var(--text);letter-spacing:-.02em;margin-bottom:10px;display:flex;align-items:center;gap:7px}
      .pm-proto .svc{display:flex;align-items:center;gap:12px;background:var(--card);border:1.5px solid var(--border);border-radius:var(--r);padding:14px 15px;cursor:pointer;transition:border-color .15s,background .15s;width:100%;text-align:left}
      .pm-proto .svc + .svc{margin-top:9px}
      .pm-proto .svc.sel{border-color:var(--primary);background:#fffaf8}
      .pm-proto .svc .radio{width:21px;height:21px;border-radius:50%;border:2px solid var(--track);flex-shrink:0;position:relative;transition:border-color .15s}
      .pm-proto .svc.sel .radio{border-color:var(--primary)}
      .pm-proto .svc.sel .radio::after{content:"";position:absolute;inset:3.5px;border-radius:50%;background:var(--primary)}
      .pm-proto .svc .info{min-width:0;flex:1;display:flex;align-items:baseline;gap:12px}
      .pm-proto .svc .info .n{font-size:15px;font-weight:700;letter-spacing:-.02em;color:var(--text);flex-shrink:0}
      .pm-proto .svc .info .d{font-size:15px;color:var(--textMuted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .pm-proto .service-page .svc .info .d{font-size:14px}
      .pm-proto .svc .price{margin-left:auto;font-size:15px;font-weight:700;color:var(--primaryDk);font-variant-numeric:tabular-nums;white-space:nowrap}
      .pm-proto .dstrip{display:flex;gap:9px;overflow-x:auto;scrollbar-width:none;padding-bottom:2px}
      .pm-proto .dstrip::-webkit-scrollbar{display:none}
      .pm-proto .dcell{flex:0 0 58px;height:78px;border-radius:12px;border:1.5px solid var(--border);background:var(--card);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;cursor:pointer}
      .pm-proto .dcell .dw{font-size:15px;color:var(--textMid)}
      .pm-proto .dcell .dn{font-size:18px;font-weight:700;letter-spacing:-.02em}
      .pm-proto .dcell.sel{border-color:var(--primary);background:var(--primary)}
      .pm-proto .dcell.sel .dw,.pm-proto .dcell.sel .dn{color:#fff}
      .pm-proto .tgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}
      .pm-proto .tcell{height:44px;text-align:center;font-size:15px;font-weight:600;border-radius:10px;border:1.5px solid var(--border);background:var(--card);font-variant-numeric:tabular-nums;cursor:pointer}
      .pm-proto .tcell.sel{border-color:var(--primary);background:var(--primary);color:#fff}
      .pm-proto .tcell .rec{margin-left:4px;color:var(--primaryDk);font-size:15px;font-weight:700}
      .pm-proto .tcell.sel .rec{color:#fff}
      .pm-proto .hint{font-size:15px;color:var(--textMuted);text-align:center;line-height:1.45}
      .pm-proto .field{display:flex;flex-direction:column;gap:8px}
      .pm-proto .field label{font-size:15px;font-weight:600;letter-spacing:-.02em}
      .pm-proto .field input,.pm-proto .field textarea{font-family:inherit;font-size:15px;color:var(--text);background:var(--card);border:1.5px solid var(--border);border-radius:11px;padding:13px 14px;width:100%;outline:none}
      .pm-proto .field textarea{resize:none;height:88px;line-height:1.5}
      .pm-proto .frow{display:flex;gap:10px;align-items:flex-start}
      .pm-proto .frow .field{flex:1;min-width:0}
      .pm-proto .info-page{gap:12px;padding-top:14px}
      .pm-proto .info-page .sec h3{display:none}
      .pm-proto .info-page .sec{display:flex;flex-direction:column;gap:11px}
      .pm-proto .info-page .field label .optional{margin-left:4px;color:var(--textMuted);font-weight:600}
      .pm-proto .info-page .field{gap:5px;padding:0;border:0;background:transparent}
      .pm-proto .info-page .field label{font-size:17px;font-weight:700;line-height:1.2;color:var(--text);padding-left:2px}
      .pm-proto .info-page .field input{height:46px;padding:10px 13px;border-radius:10px;background:#fff;box-shadow:none;font-size:17px}
      .pm-proto .info-page .field textarea{height:90px;padding:12px 13px;border-radius:10px;background:#fff;box-shadow:none;font-size:17px}
      .pm-proto .start-note{border:1px solid #f4cfc8;border-radius:14px;background:#fff2ef;padding:12px 13px;line-height:1.45}
      .pm-proto .start-note .badge{display:inline-flex;align-items:center;height:23px;border-radius:999px;background:var(--primary);padding:0 9px;font-size:13px;font-weight:800;color:#fff;letter-spacing:-.02em}
      .pm-proto .start-note .title{display:block;margin-top:8px;font-size:15px;font-weight:800;color:var(--text);letter-spacing:-.02em}
      .pm-proto .start-note .desc{display:block;margin-top:3px;font-size:14px;color:var(--textMid)}
      .pm-proto .pet-picker-title{font-size:20px;font-weight:800;letter-spacing:-.03em;color:var(--text)}
      .pm-proto .pet-list{display:flex;flex-direction:column;gap:9px}
      .pm-proto .pet-card{width:100%;display:flex;align-items:center;gap:12px;border:1.5px solid var(--border);border-radius:14px;background:#fff;padding:13px 14px;text-align:left;color:var(--text)}
      .pm-proto .pet-card.sel{border-color:var(--primary);background:#fffaf8}
      .pm-proto .pet-card .avatar{width:38px;height:38px;flex-shrink:0;border-radius:50%;background:var(--primarySoft);display:flex;align-items:center;justify-content:center;color:var(--primaryDk);font-size:15px;font-weight:800}
      .pm-proto .pet-card .meta{min-width:0;flex:1}
      .pm-proto .pet-card .name{display:block;font-size:16px;font-weight:800;letter-spacing:-.02em}
      .pm-proto .pet-card .breed{display:block;margin-top:3px;font-size:14px;color:var(--textMid);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .pm-proto .pet-add{width:100%;height:48px;border:1.5px dashed #edc9c1;border-radius:14px;background:#fffaf8;color:var(--primaryDk);font-size:15px;font-weight:800}
      .pm-proto .chips{display:flex;flex-wrap:wrap;gap:7px}
      .pm-proto .breedchip{border:1px solid var(--border);background:var(--card);border-radius:999px;color:var(--textMid);font-size:15px;font-weight:500;padding:7px 10px}
      .pm-proto .breedchip.sel{border-color:var(--primary);background:#fffaf8;color:var(--primaryDk)}
      .pm-proto .staffstrip{display:flex;gap:10px;overflow-x:auto;scrollbar-width:none}
      .pm-proto .staffstrip::-webkit-scrollbar{display:none}
      .pm-proto .staff{flex:0 0 112px;min-height:138px;border:1.5px solid var(--border);border-radius:var(--r);background:var(--card);padding:18px 10px 14px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:flex-start}
      .pm-proto .staff.sel{border-color:var(--primary);background:#fffaf8}
      .pm-proto .staff .avatar{width:50px;height:50px;margin:0 auto 14px;border-radius:50%;background:var(--primarySoft);display:flex;align-items:center;justify-content:center;color:var(--primaryDk);overflow:hidden}
      .pm-proto .staff .avatar img{width:100%;height:100%;object-fit:cover}
      .pm-proto .staff .name{display:block;width:100%;font-size:15px;font-weight:700;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .pm-proto .staff .role{display:block;width:100%;font-size:13px;color:var(--textMuted);margin-top:5px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .pm-proto .consent-note{margin-top:2px;border:1px solid #f4d9d2;border-radius:12px;background:#fff8f6;padding:10px 12px;font-size:14px;line-height:1.48;color:#9a7168}
      .pm-proto .consent-note .label{display:block;margin-bottom:3px;font-size:13px;font-weight:700;color:var(--primaryDk)}
      .pm-proto .consent-note .agree{color:#8a665d}
      .pm-proto .contact-flat{display:flex;flex-direction:column;gap:13px}
      .pm-proto .contact-item{display:flex;flex-direction:column;gap:6px;background:transparent;border:0;padding:0}
      .pm-proto .contact-label{font-size:15px;font-weight:700;letter-spacing:-.02em;color:var(--text);padding-left:1px}
      .pm-proto .contact-input{height:50px;width:100%;border:1.5px solid var(--border);border-radius:10px;background:#fff;padding:11px 13px;font-family:inherit;font-size:15px;color:var(--text);outline:none}
      .pm-proto .confirm-card{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:4px 15px}
      .pm-proto .confirm-row{display:flex;align-items:flex-start;gap:14px;padding:12px 0;font-size:15px;line-height:1.45}
      .pm-proto .confirm-row + .confirm-row{border-top:1px solid var(--borderSoft)}
      .pm-proto .confirm-row .k{width:70px;flex-shrink:0;color:var(--textMuted)}
      .pm-proto .confirm-row .v{min-width:0;flex:1;font-weight:650;color:var(--text);letter-spacing:-.02em}
      .pm-proto .dock{position:fixed;bottom:0;left:50%;right:auto;transform:translateX(-50%);z-index:30;width:100%;max-width:430px;padding:8px 16px 14px;background:rgba(253,247,245,.95);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-top:1px solid var(--border)}
      .pm-proto .cta{width:100%;padding:15px 0;border:none;border-radius:var(--rbtn);background:var(--primary);color:#fff;font-family:inherit;font-size:15px;font-weight:800;letter-spacing:-.02em;cursor:pointer;box-shadow:0 6px 16px rgba(236,127,114,.38)}
      .pm-proto .cta:disabled{background:#e8d9d2;color:#b9a89f;box-shadow:none;cursor:not-allowed}
      .pm-proto .dock .sumline{display:flex;align-items:center;gap:8px;padding:4px 4px 11px;font-size:15px}
      .pm-proto .dock .sumline .k{color:var(--textMuted);white-space:nowrap}
      .pm-proto .dock .sumline .v{font-weight:600;letter-spacing:-.02em;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .pm-proto .dock .sumline .amt{margin-left:auto;font-size:15px;font-weight:700;color:var(--primaryDk);white-space:nowrap}
      .pm-proto .btnrow{display:flex;gap:10px;width:100%}
      .pm-proto .btn{flex:1;padding:16px 0;border-radius:var(--rbtn);font-family:inherit;font-size:15px;font-weight:700;letter-spacing:-.02em;cursor:pointer;border:none}
      .pm-proto .btn.ghost{background:var(--card);border:1px solid var(--border);color:var(--text)}
      .pm-proto .btn.primary{background:var(--primary);color:#fff;box-shadow:0 6px 16px rgba(236,127,114,.38)}
      .pm-proto .done{min-height:100dvh;display:flex;flex-direction:column;align-items:center;padding:42px 24px 24px;text-align:center}
      .pm-proto .done .ic{width:84px;height:84px;border-radius:50%;background:var(--primary);display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 12px 28px rgba(236,127,114,.4)}
      .pm-proto .done h2{font-size:22px;font-weight:800;letter-spacing:-.03em;margin-top:22px}
      .pm-proto .done .lead{font-size:15px;color:var(--textMid);margin-top:9px;line-height:1.6}
      .pm-proto .rcard{width:100%;background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:6px 18px;margin-top:28px;text-align:left}
      .pm-proto .rcard .ry{display:flex;align-items:center;font-size:15px;padding:13px 0}
      .pm-proto .rcard .ry + .ry{border-top:1px solid var(--borderSoft)}
      .pm-proto .rcard .ry .k{color:var(--textMuted);width:72px;flex-shrink:0}
      .pm-proto .rcard .ry .v{font-weight:600;letter-spacing:-.02em}
      .pm-proto .rcard .ry .v.amt{color:var(--primaryDk)}
    `}</style>
  );
}

function Nav({ title, onBack, showBack = true }: { title: string; step?: string; onBack: () => void; showBack?: boolean }) {
  return (
    <div className="nav">
      {showBack ? (
        <button className="back" onClick={onBack} type="button" aria-label="이전">
          <ChevronLeft size={22} strokeWidth={2} />
        </button>
      ) : (
        <span className="back" aria-hidden="true" />
      )}
      <div className="ttl">{title}</div>
    </div>
  );
}

export default function CustomerFirstVisitClaudeFlow({
  customerServiceOptions,
  dateOptions,
  staffMembers,
  firstVisit,
  savedPets,
  step,
  selectedService,
  selectedServiceOption,
  availableSlots,
  recommendedSlots: recommendedSlotCandidates = [],
  loadingSlots,
  submitting,
  completedBooking,
  onBackToEntry,
  onStepBack,
  onNext,
  onSubmit,
  onServiceSelect,
  onStaffSelect,
  onDateSelect,
  onTimeSelect,
  onOwnerNameChange,
  onPhoneChange,
  onPetNameChange,
  onBreedChange,
  onNoteChange,
  onGoManage,
}: {
  shop: Shop;
  customerServiceOptions: CustomerServiceSourceOption[];
  dateOptions: DateOption[];
  staffMembers: BootstrapStaffMember[];
  firstVisit: FirstVisitForm;
  savedPets: SavedBookingPet[];
  step: FirstVisitStep;
  selectedService?: Service;
  selectedServiceOption?: CustomerServiceSourceOption;
  availableSlots: string[];
  recommendedSlots?: string[];
  loadingSlots: boolean;
  submitting: boolean;
  completedBooking: BookingCompletion | null;
  onBackToEntry: () => void;
  onStepBack: () => void;
  onNext: () => void;
  onSubmit: () => Promise<void>;
  onOpenShopInfo: () => void;
  onServiceSelect: (serviceOptionId: string) => void;
  onStaffSelect: (staffId: string) => void;
  onDateSelect: (date: string) => void;
  onTimeSelect: (time: string) => void;
  onOwnerNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onPetNameChange: (value: string) => void;
  onBreedChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onGoManage: () => void;
}) {
  const breedInputRef = useRef<HTMLInputElement | null>(null);
  const [isAddingNewPet, setIsAddingNewPet] = useState(false);
  const recommendedSlots = useMemo(() => {
    const availableSlotSet = new Set(availableSlots);
    const prioritySlots = recommendedSlotCandidates.filter((slot, index) => availableSlotSet.has(slot) && recommendedSlotCandidates.indexOf(slot) === index);
    return (prioritySlots.length > 0 ? prioritySlots : buildFallbackRecommendedSlots(availableSlots)).slice(0, 2);
  }, [availableSlots, recommendedSlotCandidates]);
  const regularSlots = useMemo(() => {
    const recommendedSlotSet = new Set(recommendedSlots);
    return availableSlots.filter((slot) => !recommendedSlotSet.has(slot)).slice(0, 6);
  }, [availableSlots, recommendedSlots]);
  const defaultDateValue = useMemo(() => dateOptions.find((date) => date.label === "오늘")?.value ?? dateOptions[0]?.value ?? "", [dateOptions]);
  const serviceSummaryName = firstVisit.serviceId === CUSTOM_SERVICE_ID ? "상담 후 결정" : selectedServiceOption?.name || selectedService?.name || "서비스 선택";
  const petNameForConsent = firstVisit.petName.trim() || "아기";
  const selectedSavedPet = savedPets.find((pet) => pet.name.trim() && pet.name.trim() === firstVisit.petName.trim()) ?? null;
  const showSavedPetPicker = savedPets.length > 0 && !isAddingNewPet;

  useEffect(() => {
    if (step !== 3 || firstVisit.date || !defaultDateValue) return;
    onDateSelect(defaultDateValue);
  }, [defaultDateValue, firstVisit.date, onDateSelect, step]);

  if (step === 5) {
    const appointment = completedBooking?.appointment;
    const summaryDate = appointment?.appointment_date || firstVisit.date;
    const summaryTime = appointment?.appointment_time?.slice(0, 5) || firstVisit.timeSlot;

    return (
      <div className="pm-proto">
        <ClaudeStyles />
        <div className="done">
          <div className="ic">
            <Check size={42} strokeWidth={2.2} />
          </div>
          <h2>예약 요청이 접수되었습니다!</h2>
          <div className="lead">매장에서 확인 후 문자 또는 전화로 안내드릴게요.</div>
          <div className="rcard">
            <div className="ry"><span className="k">예약 번호</span><span className="v">{buildReservationNumber(appointment)}</span></div>
            <div className="ry"><span className="k">예약 날짜</span><span className="v">{formatDateForSummary(summaryDate)}</span></div>
            <div className="ry"><span className="k">예약 시간</span><span className="v">{formatTimeForSummary(summaryTime)}</span></div>
            <div className="ry"><span className="k">서비스</span><span className="v">{serviceSummaryName}</span></div>
          </div>
          <div style={{ flex: 1 }} />
          <div className="btnrow">
            <button className="btn primary" type="button" onClick={onGoManage}>예약 내역 보기</button>
            <button className="btn ghost" type="button" onClick={onBackToEntry}>추가 예약하기</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pm-proto">
      <ClaudeStyles />

      {step === 1 ? (
        <>
          <Nav title="예약자 정보" step="1 / 4" onBack={onBackToEntry} />
          <div className="pgscroll info-page">
            {showSavedPetPicker ? (
              <div className="sec">
                <div>
                  <div className="pet-picker-title">누구 예약할까요?</div>
                </div>
                <div className="pet-list">
                  {savedPets.map((pet) => {
                    const active = selectedSavedPet?.id === pet.id;
                    return (
                      <button
                        key={pet.id}
                        type="button"
                        className={`pet-card${active ? " sel" : ""}`}
                        onClick={() => {
                          onPetNameChange(pet.name);
                          onBreedChange(pet.breed);
                          onNoteChange("");
                        }}
                      >
                        <span className="avatar">{pet.name.trim().slice(0, 1) || "아"}</span>
                        <span className="meta">
                          <span className="name">{pet.name}</span>
                          <span className="breed">{pet.breed || "품종 미입력"}</span>
                        </span>
                      </button>
                    );
                  })}
                  <button
                    className="pet-add"
                    type="button"
                    onClick={() => {
                      setIsAddingNewPet(true);
                      onPetNameChange("");
                      onBreedChange("");
                      onNoteChange("");
                      window.setTimeout(() => breedInputRef.current?.focus(), 0);
                    }}
                  >
                    + 새 아기 등록
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="start-note">
                  <span className="badge">TIP</span>
                  <span className="title">다음 예약부터 아기 선택만 하면 돼요</span>
                  <span className="desc">이번 한 번만 등록하면 보호자 정보와 아기 정보를 저장해두고, 다음 예약부터 목록에서 바로 선택할 수 있어요.</span>
                </div>
                {savedPets.length > 0 ? (
                  <button
                    className="pet-add"
                    type="button"
                    onClick={() => setIsAddingNewPet(false)}
                  >
                    저장된 아기 목록 보기
                  </button>
                ) : null}
                <div className="sec">
                  <h3>반려동물 정보</h3>
                  <div className="field">
                    <label>아기 이름</label>
                    <input value={firstVisit.petName} onChange={(event) => onPetNameChange(event.target.value)} placeholder="아기 이름" />
                  </div>
                  <div className="field">
                    <label>품종</label>
                    <input ref={breedInputRef} value={firstVisit.breed} onChange={(event) => onBreedChange(event.target.value)} placeholder="직접 입력" />
                  </div>
                  <div style={{ marginTop: 13 }}>
                    <div className="chips">
                      {popularBreedChips.map((breed) => {
                        const active = firstVisit.breed.trim() === breed;
                        return (
                          <button
                            key={breed}
                            className={`breedchip${active ? " sel" : ""}`}
                            type="button"
                            onClick={() => {
                              if (breed === "직접 입력") breedInputRef.current?.focus();
                              else onBreedChange(breed);
                            }}
                          >
                            {breed}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="sec">
                  <h3>요청사항</h3>
                  <div className="field">
                    <label>요청사항 <span className="optional">(선택)</span></label>
                    <textarea value={firstVisit.note} onChange={(event) => onNoteChange(event.target.value.slice(0, 200))} placeholder="미용 스타일, 예민한 부위, 건강 특이사항 등을 알려주세요." />
                  </div>
                  <div className="hint" style={{ marginTop: 8, textAlign: "right" }}>{firstVisit.note.length}/200</div>
                </div>
              </>
            )}
          </div>
          <div className="dock">
            <button className="cta" type="button" disabled={!firstVisit.petName.trim() || !firstVisit.breed.trim()} onClick={onNext}>다음</button>
          </div>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <Nav title="서비스 선택" step="2 / 4" onBack={onStepBack} />
          <div className="pgscroll service-page">
            <div className="sec">
              {customerServiceOptions.map((service) => (
                <button
                  key={service.id}
                  type="button"
                  className={`svc${firstVisit.customerServiceOptionId === service.id ? " sel" : ""}`}
                  onClick={() => onServiceSelect(service.id)}
                >
                  <span className="radio" />
                  <span className="info">
                    <span className="n">{service.name}</span>
                    <span className="d">{formatDurationRange(service.durationMinutes)}</span>
                  </span>
                  <span className="price">{formatServicePrice(service.price, service.priceType)}</span>
                </button>
              ))}
              {customerServiceOptions.length === 0 ? <div className="hint">노출 중인 서비스가 없습니다.</div> : null}
            </div>
          </div>
          <div className="dock">
            <div className="sumline">
              <span className="k">선택</span>
              <span className="v">{firstVisit.customerServiceOptionId ? serviceSummaryName : "서비스를 골라주세요"}</span>
            </div>
            <button className="cta" type="button" disabled={!firstVisit.serviceId} onClick={onNext}>다음</button>
          </div>
        </>
      ) : null}

      {step === 3 ? (
        <>
          <Nav title="디자이너 · 날짜 선택" step="3 / 4" onBack={onStepBack} />
          <div className="pgscroll">
            <div className="sec">
              <h3>디자이너</h3>
              <div className="staffstrip">
                {staffMembers.length > 1 ? (
                  <button type="button" className={`staff${!firstVisit.staffId ? " sel" : ""}`} onClick={() => onStaffSelect("")}>
                    <span className="avatar"><UserRound size={22} /></span>
                    <span className="name">빠른 선택</span>
                    <span className="role">가능한 직원</span>
                  </button>
                ) : null}
                {staffMembers.map((staff) => {
                  const active = firstVisit.staffId === staff.id;
                  return (
                    <button key={staff.id} type="button" className={`staff${active ? " sel" : ""}`} onClick={() => onStaffSelect(staff.id)}>
                      <span className="avatar">
                        {staff.profileImageUrl ? <img src={staff.profileImageUrl} alt="" /> : <UserRound size={22} />}
                      </span>
                      <span className="name">{getStaffCustomerName(staff)}</span>
                      <span className="role">{getStaffCustomerTitle(staff)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="sec">
              <h3>날짜 선택</h3>
              <div className="dstrip">
                {dateOptions.map((date, index) => {
                  const active = firstVisit.date === date.value;
                  return (
                    <button key={date.value} type="button" className={`dcell${active ? " sel" : ""}`} onClick={() => onDateSelect(date.value)}>
                      <span className="dw">{formatDateChipTitle(date, dateOptions[index - 1])}</span>
                      <span className="dn">{formatDateChipSubtitle(date)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="sec">
              <h3>추천 시간</h3>
              {loadingSlots ? (
                <div className="hint">가능한 시간을 확인하고 있어요.</div>
              ) : availableSlots.length === 0 ? (
                <div className="hint">선택한 날짜에 가능한 시간이 없어요.</div>
              ) : (
                <div className="tgrid">
                  {recommendedSlots.map((slot) => (
                    <button key={`recommended-${slot}`} type="button" className={`tcell${firstVisit.timeSlot === slot ? " sel" : ""}`} onClick={() => onTimeSelect(slot)}>
                      {slot}<span className="rec">추천</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {regularSlots.length > 0 ? (
              <div className="sec">
                <h3>전체 시간</h3>
                <div className="tgrid">
                  {regularSlots.map((slot) => (
                    <button key={`all-${slot}`} type="button" className={`tcell${firstVisit.timeSlot === slot ? " sel" : ""}`} onClick={() => onTimeSelect(slot)}>
                      {slot}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <div className="dock">
            <div className="sumline">
              <span className="k">선택</span>
              <span className="v">{firstVisit.date && firstVisit.timeSlot ? `${formatDateForSummary(firstVisit.date)} · ${firstVisit.timeSlot}` : "날짜와 시간을 골라주세요"}</span>
              <span className="amt">{selectedServiceOption ? formatServicePrice(selectedServiceOption.price, selectedServiceOption.priceType) : ""}</span>
            </div>
            <button className="cta" type="button" disabled={!firstVisit.date || !firstVisit.timeSlot} onClick={onNext}>다음</button>
          </div>
        </>
      ) : null}

      {step === 4 ? (
        <>
          <Nav title="최종 확인" step="4 / 4" onBack={onStepBack} />
          <div className="pgscroll">
            <div className="contact-flat">
              <div className="contact-item">
                <label className="contact-label">보호자 이름</label>
                <input className="contact-input" value={firstVisit.ownerName} onChange={(event) => onOwnerNameChange(event.target.value)} placeholder="이름" />
              </div>
              <div className="contact-item">
                <label className="contact-label">연락처</label>
                <input className="contact-input" value={firstVisit.phone} inputMode="tel" onChange={(event) => onPhoneChange(event.target.value)} placeholder="010-1234-5678" />
              </div>
              <p className="consent-note">
                <span className="label">안내</span>
                우리 소중한 {petNameForConsent}의 예약 확인과 미용 안내를 위해 보호자님의 성함과 연락처가 필요해요. 입력하신 정보는 예약 진행 및 안내 목적으로만 사용됩니다. <span className="agree">개인정보 수집·이용에 동의하시면 예약 요청을 눌러주세요.</span>
              </p>
            </div>

            <div className="sec">
              <h3>예약 내용</h3>
              <div className="confirm-card">
                <div className="confirm-row"><span className="k">아기</span><span className="v">{firstVisit.petName || "-"} · {firstVisit.breed || "-"}</span></div>
                <div className="confirm-row"><span className="k">서비스</span><span className="v">{serviceSummaryName}</span></div>
                <div className="confirm-row"><span className="k">일시</span><span className="v">{firstVisit.date && firstVisit.timeSlot ? `${formatDateForSummary(firstVisit.date)} · ${formatTimeForSummary(firstVisit.timeSlot)}` : "-"}</span></div>
                <div className="confirm-row"><span className="k">담당</span><span className="v">{staffMembers.find((staff) => staff.id === firstVisit.staffId) ? getStaffCustomerName(staffMembers.find((staff) => staff.id === firstVisit.staffId)!) : staffMembers.length === 1 ? getStaffCustomerName(staffMembers[0]) : "빠른 선택"}</span></div>
              </div>
            </div>
          </div>
          <div className="dock">
            <button className="cta" type="button" disabled={!firstVisit.ownerName.trim() || !isValidBookingPhoneNumber(firstVisit.phone) || submitting} onClick={() => void onSubmit()}>
              {submitting ? "예약 요청 중..." : "예약 요청하기"}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
