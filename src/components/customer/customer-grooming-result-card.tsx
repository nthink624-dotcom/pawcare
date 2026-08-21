"use client";

import {
  ArrowRight,
  CalendarDays,
  Camera,
  Download,
  MessageCircle,
  RefreshCcw,
  Sparkles,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import {
  CustomerWeightTrendCard,
} from "@/components/customer/customer-weight-trend-card";
import { fetchApiJson } from "@/lib/api";
import type { CustomerWeightMeasurement } from "@/lib/customer-weight-history";
import type { Appointment, GroomingRecord } from "@/types/domain";

export type CustomerResultMediaAsset = {
  id: string;
  appointmentId: string;
  groomingRecordId: string | null;
  mediaKind: "grooming_before" | "grooming_after";
};

type SignedUrlsResponse = {
  items: Array<{ mediaAssetId: string; signedUrl: string }>;
};

function formatResultDate(value: string | null | undefined) {
  if (!value) return "오너와 상의해 주세요";
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(parsed);
}

function formatActualDuration(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return "기록 없음";

  const totalMinutes = Math.round(value);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (!hours) return `${minutes}분`;
  if (!minutes) return `${hours}시간`;
  return `${hours}시간 ${minutes}분`;
}

function getCareSummary(record: GroomingRecord, petName: string) {
  const firstSpecialNote = record.memo
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  if (firstSpecialNote) return firstSpecialNote;

  const firstTreatmentNote = record.style_notes
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  if (firstTreatmentNote) return `${petName}에게 ${firstTreatmentNote} 케어를 진행했어요.`;

  return `${petName}의 오늘 미용을 마쳤어요.`;
}

function getRebookingServiceOptionId(appointment: Appointment) {
  const serviceOptionId = appointment.discount_snapshot?.customerServiceOptionId;
  return typeof serviceOptionId === "string" ? serviceOptionId : "";
}

function CarePhotoCarousel({
  slides,
  activeIndex,
  onChange,
}: {
  slides: Array<{ label: string; url: string | null }>;
  activeIndex: number;
  onChange: (index: number) => void;
}) {
  const activeSlide = slides[activeIndex] ?? slides[0];

  return (
    <div>
      <figure className="relative overflow-hidden rounded-[22px] bg-[#f4eeee]">
        <div className="relative aspect-[4/3] w-full">
        {activeSlide?.url ? (
          <Image
            src={activeSlide.url}
            alt={`${activeSlide.label} 사진`}
            fill
            priority
            sizes="(max-width: 430px) 100vw, 430px"
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-[#b99b97]">
            <Camera className="h-5 w-5" aria-hidden="true" />
            <span className="text-[14px]">등록된 사진이 없어요</span>
          </div>
        )}
        </div>
        <div className="absolute left-3 top-3 flex rounded-full bg-white/92 p-1 shadow-[0_4px_14px_rgba(70,48,52,0.14)]" aria-label="미용 전후 사진 선택">
          {slides.map((slide, index) => (
            <button
              key={slide.label}
              type="button"
              onClick={() => onChange(index)}
              aria-label={`${slide.label} 사진 보기`}
              aria-pressed={index === activeIndex}
              className={`h-8 rounded-full px-3 text-[14px] font-semibold tracking-[0.04em] transition-colors ${
                index === activeIndex ? "bg-[#df7079] text-white" : "text-[#9a7d82]"
              }`}
            >
              {slide.label === "미용 전" ? "BEFORE" : "AFTER"}
            </button>
          ))}
        </div>
        <span className="absolute bottom-3 right-3 rounded-full bg-white/85 px-2.5 py-1 text-[14px] font-semibold text-[#7e8796]">
          {activeIndex + 1} / {slides.length}
        </span>
      </figure>
    </div>
  );
}

export function CustomerGroomingResultCard({
  shopId,
  accessToken,
  appointment,
  record,
  petName,
  serviceName,
  staffName,
  shopPhone,
  mediaAssets,
  previewPhotoUrls,
  weightHistory = [],
}: {
  shopId: string;
  accessToken: string;
  appointment: Appointment;
  record: GroomingRecord;
  petName: string;
  serviceName: string;
  staffName?: string;
  shopPhone?: string;
  mediaAssets: CustomerResultMediaAsset[];
  previewPhotoUrls?: Record<string, string>;
  weightHistory?: CustomerWeightMeasurement[];
}) {
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>(previewPhotoUrls ?? {});
  const [photoError, setPhotoError] = useState("");
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [preparingRebooking, setPreparingRebooking] = useState(false);
  const [rebookingError, setRebookingError] = useState("");
  const confirmedCareReport = record.care_report_owner_confirmed_at ? record.care_report_data : null;
  const canLoadPhotos = Boolean(confirmedCareReport && record.care_report_photo_consent !== false);
  const mediaAssetIds = useMemo(
    () => (canLoadPhotos ? [...new Set(mediaAssets.map((item) => item.id))] : []),
    [canLoadPhotos, mediaAssets],
  );

  useEffect(() => {
    if (previewPhotoUrls || !mediaAssetIds.length) return;
    let active = true;
    void fetchApiJson<SignedUrlsResponse>("/api/media/public-signed-urls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shopId,
        token: accessToken,
        mediaAssetIds,
        variant: "preview",
      }),
    })
      .then((result) => {
        if (!active) return;
        setSignedUrls(Object.fromEntries(result.items.map((item) => [item.mediaAssetId, item.signedUrl])));
        setPhotoError("");
      })
      .catch(() => {
        if (active) setPhotoError("사진을 불러오지 못했어요. 잠시 후 다시 열어 주세요.");
      });
    return () => {
      active = false;
    };
  }, [accessToken, mediaAssetIds, previewPhotoUrls, shopId]);

  const latestByKind = useMemo(() => {
    const result: Partial<Record<CustomerResultMediaAsset["mediaKind"], CustomerResultMediaAsset>> = {};
    for (const asset of mediaAssets) result[asset.mediaKind] = asset;
    return result;
  }, [mediaAssets]);
  const beforeId = record.before_media_asset_id ?? latestByKind.grooming_before?.id ?? null;
  const afterId = record.after_media_asset_id ?? latestByKind.grooming_after?.id ?? null;
  const beforeUrl = beforeId ? signedUrls[beforeId] ?? null : null;
  const afterUrl = afterId ? signedUrls[afterId] ?? null : null;
  const photoSlides = [
    { label: "미용 전", url: beforeUrl },
    { label: "미용 후", url: afterUrl },
  ];
  const careSummary = confirmedCareReport?.oneLineSummary ?? getCareSummary(record, petName);
  const treatmentSummary = confirmedCareReport?.treatmentSummary ?? record.style_notes;
  const treatmentDetail = treatmentSummary.trim() || `${serviceName}을 완료했습니다.`;
  const showCareReportPhotos = record.care_report_photo_consent !== false;

  async function startRebooking() {
    if (preparingRebooking) return;
    setPreparingRebooking(true);
    setRebookingError("");
    try {
      const result = await fetchApiJson<{ href: string }>("/api/customer-rebooking-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopId,
          accessToken,
          serviceId: record.service_id,
          serviceOptionId: getRebookingServiceOptionId(appointment),
        }),
      });
      window.location.href = result.href;
    } catch (error) {
      setRebookingError(error instanceof Error ? error.message : "재예약 화면을 열지 못했습니다.");
      setPreparingRebooking(false);
    }
  }

  if (!confirmedCareReport) {
    return (
      <section
        className="mt-3 overflow-hidden rounded-[26px] bg-white shadow-[0_18px_46px_rgba(171,91,101,0.1)]"
        aria-labelledby={`grooming-result-${record.id}`}
      >
        <div className="bg-[#fde9e7] px-5 py-7 text-center">
          <p className="text-[14px] font-medium tracking-[0.04em] text-[#db6872]">펫매니저 케어리포트</p>
          <h4 id={`grooming-result-${record.id}`} className="mt-2 text-[24px] font-semibold tracking-[-0.05em] text-[#302629]">
            {petName}의 미용이 완료되었어요
          </h4>
        </div>

        <div className="px-5 py-8 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white text-[#df6e78] shadow-sm">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="mt-3 text-[18px] font-medium tracking-[-0.03em] text-[#47383c]">케어리포트 작성 중</p>
          <p className="mt-2 text-[14px] leading-6 text-[#887477]">
            오너가 오늘의 기록을 정리하고 있어요.<br />완성되면 이 링크에서 바로 확인할 수 있습니다.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#ead6d8] bg-white px-5 text-[16px] font-medium text-[#7b6266] transition hover:bg-[#fff3f2]"
          >
            <RefreshCcw className="h-4 w-4" aria-hidden="true" /> 다시 확인하기
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      className="mt-3 overflow-hidden rounded-[28px] bg-white shadow-[0_22px_54px_rgba(171,91,101,0.1)]"
      aria-labelledby={`grooming-result-${record.id}`}
    >
      <header className="bg-[#fde9e7] px-5 py-7 text-center">
        <p className="text-[14px] font-medium tracking-[0.04em] text-[#d95f6a]">펫매니저 케어리포트</p>
        <h4 id={`grooming-result-${record.id}`} className="mt-2 text-[24px] font-semibold leading-[1.3] tracking-[-0.05em] text-[#302629]">
          {petName}, 오늘 더 예뻐지고 왔어요 🎀
        </h4>
      </header>

      <div className="space-y-7 px-5 py-6">
        <section>
          <p className="text-[18px] font-medium tracking-[-0.02em] text-[#795f64]">디자이너의 한마디</p>
          <div className="mt-2.5 rounded-[20px] bg-[#fde9e5] px-4 py-[18px]">
            <p className="whitespace-pre-wrap text-[16px] font-normal leading-[1.75] tracking-[-0.02em] text-[#433438]">{careSummary}</p>
          </div>
        </section>

        {showCareReportPhotos ? (
          <section>
            <div className="flex items-center justify-between">
              <p className="text-[18px] font-medium tracking-[-0.02em] text-[#795f64]">오늘의 변화</p>
              {afterUrl ? (
                <a
                  href={afterUrl}
                  download={`${petName}-미용후.jpg`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-3 text-[14px] font-medium text-[#866d71] shadow-sm"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" /> 사진 저장
                </a>
              ) : null}
            </div>
            <div className="mt-2.5">
              <CarePhotoCarousel slides={photoSlides} activeIndex={activePhotoIndex} onChange={setActivePhotoIndex} />
            </div>
            {photoError ? <p className="mt-2 text-[14px] text-[#a04455]">{photoError}</p> : null}
          </section>
        ) : null}

        <CustomerWeightTrendCard history={weightHistory} />

        <section aria-labelledby={`grooming-record-title-${record.id}`}>
          <p
            id={`grooming-record-title-${record.id}`}
            className="text-[18px] font-medium tracking-[-0.02em] text-[#795f64]"
          >
            오늘의 미용 기록
          </p>
          <dl className="mt-2.5 overflow-hidden rounded-[14px] border border-[#d9e0e7] bg-white">
            {staffName ? (
              <div className="grid grid-cols-[132px_minmax(0,1fr)] border-b border-[#dfe5eb]">
                <dt className="whitespace-nowrap border-r border-[#dfe5eb] bg-[#f4f7f9] px-4 py-3 text-[16px] font-normal leading-6 tracking-[-0.01em] text-[#657281]">
                  담당 디자이너
                </dt>
                <dd className="px-4 py-3 text-[16px] font-normal leading-6 tracking-[-0.01em] text-[#384553]">
                  {staffName}
                </dd>
              </div>
            ) : null}
            <div className="grid grid-cols-[132px_minmax(0,1fr)] border-b border-[#dfe5eb]">
              <dt className="whitespace-nowrap border-r border-[#dfe5eb] bg-[#f4f7f9] px-4 py-3 text-[16px] font-normal leading-6 tracking-[-0.01em] text-[#657281]">
                총 작업 시간
              </dt>
              <dd className="px-4 py-3 text-[16px] font-normal leading-6 tracking-[-0.01em] text-[#384553]">
                {formatActualDuration(record.actual_duration_minutes)}
              </dd>
            </div>
            <div className="grid grid-cols-[132px_minmax(0,1fr)] border-b border-[#dfe5eb]">
              <dt className="border-r border-[#dfe5eb] bg-[#f4f7f9] px-4 py-3 text-[16px] font-normal leading-6 tracking-[-0.01em] text-[#657281]">
                예약 서비스
              </dt>
              <dd className="px-4 py-3 text-[16px] font-normal leading-6 tracking-[-0.01em] text-[#384553]">
                {serviceName}
              </dd>
            </div>
            <div className="grid grid-cols-[132px_minmax(0,1fr)]">
              <dt className="border-r border-[#dfe5eb] bg-[#f4f7f9] px-4 py-3 text-[16px] font-normal leading-6 tracking-[-0.01em] text-[#657281]">
                진행 내용
              </dt>
              <dd className="whitespace-pre-wrap break-words px-4 py-3 text-[16px] font-normal leading-6 tracking-[-0.01em] text-[#384553]">
                {treatmentDetail}
              </dd>
            </div>
          </dl>
        </section>

        <section className="overflow-hidden rounded-[20px] bg-white shadow-[0_5px_18px_rgba(120,74,82,0.05)]">
          <div className="flex items-center justify-between gap-4 px-4 py-4">
            <div>
              <p className="inline-flex items-center gap-1.5 text-[18px] font-medium text-[#8b7377]">
                <CalendarDays className="h-4 w-4" aria-hidden="true" /> 다음 케어 권장 시점
              </p>
              <p className="mt-1.5 text-[22px] font-semibold tracking-[-0.035em] text-[#433438]">{formatResultDate(record.next_recommended_visit_date)}</p>
            </div>
            <span className="shrink-0 rounded-full bg-[#fde9e7] px-3 py-1.5 text-[14px] font-medium text-[#d96570]">잊기 전에 예약</span>
          </div>
          <p className="border-t border-[#f1e5e6] px-4 py-3 text-[16px] leading-6 text-[#806b70]">{confirmedCareReport.nextVisitGuide}</p>
          <div className="px-3 pb-3">
            <button
              type="button"
              onClick={() => void startRebooking()}
              disabled={preparingRebooking}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[15px] bg-[#e56f78] px-4 text-[16px] font-semibold text-white shadow-[0_9px_20px_rgba(199,85,99,0.18)] transition hover:bg-[#d4626d] disabled:opacity-60"
            >
              {preparingRebooking ? "저장된 정보를 불러오는 중" : "같은 조건으로 다시 예약"}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            {rebookingError ? <p className="mt-2 text-center text-[14px] text-[#a04455]">{rebookingError}</p> : null}
          </div>
        </section>

        {shopPhone ? (
          <a
            href={`tel:${shopPhone}`}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[14px] text-[16px] font-medium text-[#816a6e]"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" /> 매장에 문의하기
          </a>
        ) : null}
      </div>
    </section>
  );
}
