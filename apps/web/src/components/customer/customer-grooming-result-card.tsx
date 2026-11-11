"use client";

import {
  ArrowRight,
  CalendarDays,
  Camera,
  ClipboardList,
  MessageCircle,
  Download,
  RefreshCcw,
  Sparkles,
  UserRound,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { CustomerReportSectionTitle } from "@/components/customer/customer-report-section-title";

import styles from "./customer-care-report.module.css";

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
}: {
  slides: Array<{ label: string; url: string | null }>;
  activeIndex: number;
}) {
  const activeSlide = slides[activeIndex] ?? slides[0];

  return (
    <div>
      <figure className="relative overflow-hidden rounded-[18px] bg-[#f4eeee]">
        <div className="relative aspect-[16/10] w-full">
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
        <span className="absolute bottom-3 right-3 rounded-full bg-white/90 px-2.5 py-1 text-[13px] font-medium text-[#7e8796]">
          {activeIndex + 1} / {slides.length}
        </span>
      </figure>
    </div>
  );
}

function formatCareReportDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(date);
}

export function CustomerGroomingResultCard({
  shopId,
  accessToken,
  appointment,
  record,
  petName,
  serviceName,
  staffName,
  staffProfileImageUrl,
  mediaAssets,
  previewPhotoUrls,
  weightHistory = [],
  embedded = false,
  headerContent,
  summaryContent,
}: {
  shopId: string;
  accessToken: string;
  appointment: Appointment;
  record: GroomingRecord;
  petName: string;
  serviceName: string;
  staffName?: string;
  staffProfileImageUrl?: string;
  mediaAssets: CustomerResultMediaAsset[];
  previewPhotoUrls?: Record<string, string>;
  weightHistory?: CustomerWeightMeasurement[];
  embedded?: boolean;
  headerContent?: ReactNode;
  summaryContent?: ReactNode;
}) {
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>(previewPhotoUrls ?? {});
  const [photoError, setPhotoError] = useState("");
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [failedStaffImageUrl, setFailedStaffImageUrl] = useState<string | null>(null);
  const staffImageUrl = staffProfileImageUrl?.trim();
  const reportDate = formatCareReportDate(appointment.appointment_date);
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
  const careSummary = confirmedCareReport?.reportText ?? getCareSummary(record, petName);
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
        className={embedded ? "overflow-hidden bg-white" : "mt-3 overflow-hidden rounded-[26px] bg-white shadow-[0_18px_46px_rgba(171,91,101,0.1)]"}
        aria-labelledby={`grooming-result-${record.id}`}
      >
        <div className="bg-[#fde9e7] px-5 py-7 text-center">
          <p className="text-[14px] font-medium tracking-[0.04em] text-[#db6872]">펫매니저 케어리포트</p>
          <h4 id={`grooming-result-${record.id}`} className="mt-2 text-[24px] font-normal tracking-[-0.05em] text-[#302629]">
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
      className={embedded ? "overflow-hidden bg-white" : "mt-3 overflow-hidden rounded-[28px] bg-white shadow-[0_22px_54px_rgba(171,91,101,0.1)]"}
      aria-labelledby={`grooming-result-${record.id}`}
    >
      {headerContent ?? (
        <header className={styles.header}>
          <p className={styles.eyebrow}>케어리포트</p>
          <h4 id={`grooming-result-${record.id}`} className={styles.title}>
            {petName}의 케어리포트
          </h4>
          <div className={styles.dateLine}>
            {reportDate ? (
              <>
                <time dateTime={appointment.appointment_date}>{reportDate}</time>
                <span className={styles.dot} aria-hidden="true">·</span>
              </>
            ) : null}
            <span>{serviceName}</span>
          </div>
        </header>
      )}

      <div className="flex flex-col gap-6 px-5 pb-6 pt-5">
        {showCareReportPhotos ? (
          <section aria-label="미용 전후 사진">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="relative flex h-11 shrink-0 items-center px-0.5" aria-label="미용 전후 사진 선택">
                <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 h-8 -translate-y-1/2 rounded-full border border-[#f0e6e8] bg-white" />
                {photoSlides.map((slide, index) => (
                  <button
                    key={slide.label}
                    type="button"
                    onClick={() => setActivePhotoIndex(index)}
                    aria-label={`${slide.label} 사진 보기`}
                    aria-pressed={index === activePhotoIndex}
                    className="relative z-10 flex h-11 items-center rounded-full text-[13px] font-normal tracking-normal"
                  >
                    <span className={`inline-flex h-7 items-center rounded-full px-2.5 transition-colors ${index === activePhotoIndex ? "bg-[#fde9e7] font-medium text-[#a44f5b]" : "text-[#9a7d82]"}`}>
                      {slide.label === "미용 전" ? "BEFORE" : "AFTER"}
                    </span>
                  </button>
                ))}
              </div>
              {afterUrl ? (
                <a
                  href={afterUrl}
                  download={`${petName}-미용후.jpg`}
                  className="inline-flex h-11 items-center rounded-full text-[13px] font-normal text-[#866d71]"
                >
                  <span className="inline-flex h-8 items-center gap-1 rounded-full border border-[#f0e6e8] bg-white px-2.5"><Download className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" /> 사진 저장</span>
                </a>
              ) : null}
            </div>
            <CarePhotoCarousel slides={photoSlides} activeIndex={activePhotoIndex} />
            {photoError ? <p className="mt-2 text-[14px] text-[#a04455]">{photoError}</p> : null}
          </section>
        ) : null}

        <section aria-label="케어리포트 본문">
          {summaryContent ?? (
            <>
              <CustomerReportSectionTitle icon={<MessageCircle />}>오늘의 리포트</CustomerReportSectionTitle>
              <div className={styles.speechBubble}><p>{careSummary}</p></div>
            </>
          )}
        </section>

        <section aria-labelledby={`grooming-record-title-${record.id}`}>
          <CustomerReportSectionTitle
            id={`grooming-record-title-${record.id}`}
            icon={<ClipboardList />}
          >
            미용 정보
          </CustomerReportSectionTitle>
          <div className="mt-2.5 overflow-hidden rounded-[18px] border border-[#f4e4e9] bg-white">
            <div className="bg-[#fff3f5] p-4">
              {staffName ? (
                <div className="flex items-center gap-3">
                  <span className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-white text-[#bc7580]">
                    {staffImageUrl && failedStaffImageUrl !== staffImageUrl ? (
                      <Image src={staffImageUrl} alt={`${staffName} 프로필`} fill sizes="48px" className="object-cover" unoptimized onError={() => setFailedStaffImageUrl(staffImageUrl)} />
                    ) : <UserRound className="h-6 w-6" strokeWidth={1.6} aria-hidden="true" />}
                  </span>
                  <dl className="min-w-0">
                    <dt className="whitespace-nowrap text-[13px] font-semibold leading-5 text-[#8e5f69]">디자이너</dt>
                    <dd className="break-keep text-[18px] font-bold leading-[26px] tracking-[-0.02em] text-[#433438] [overflow-wrap:anywhere]">{staffName}</dd>
                  </dl>
                </div>
              ) : null}
              <dl className={`${staffName ? "mt-2.5 " : ""}grid grid-cols-2 rounded-[10px] bg-white px-3 py-1.5`}>
                <div className="min-w-0 pr-3">
                  <dt className="whitespace-nowrap text-[13px] font-semibold leading-5 text-[#8e5f69]">예약 서비스</dt>
                  <dd className="break-keep text-[16px] font-bold leading-6 text-[#433438] [overflow-wrap:anywhere]">{serviceName}</dd>
                </div>
                <div className="min-w-0 border-l border-[#f3e8ec] pl-3">
                  <dt className="whitespace-nowrap text-[13px] font-semibold leading-5 text-[#8e5f69]">미용 시간</dt>
                  <dd className="whitespace-nowrap text-[16px] font-bold leading-6 text-[#433438]">{formatActualDuration(record.actual_duration_minutes)}</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        <CustomerWeightTrendCard history={weightHistory} />

        <section aria-labelledby={`rebooking-title-${record.id}`}>
          <CustomerReportSectionTitle id={`rebooking-title-${record.id}`} icon={<CalendarDays />}>다음 미용 예약</CustomerReportSectionTitle>
          <p className="mt-2.5 text-[14px] leading-[22px] text-[#8b7377]">
            이번 미용이 마음에 드셨다면,<br />
            다음 방문 날짜와 시간을 확인해보세요.
          </p>
          <button
            type="button"
            onClick={() => void startRebooking()}
            disabled={preparingRebooking}
            className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-[#e56f78] px-4 text-[16px] font-semibold text-white transition hover:bg-[#d4626d] disabled:opacity-60"
          >
            {preparingRebooking ? "예약 정보를 불러오는 중" : "예약 가능한 시간 보기"}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
          {rebookingError ? <p className="mt-2 text-center text-[14px] text-[#a04455]">{rebookingError}</p> : null}
        </section>
        <footer className="pt-1 text-center text-[12px] font-normal leading-[18px] text-[#a18b92]">넘친Day 펫매니저</footer>
      </div>
    </section>
  );
}
