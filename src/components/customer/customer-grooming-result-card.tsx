"use client";

import {
  ArrowRight,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  Download,
  Heart,
  Home,
  MessageCircle,
  RefreshCcw,
  Sparkles,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import { fetchApiJson } from "@/lib/api";
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

function getHomeCareDetails(record: GroomingRecord, summary: string) {
  const lines = record.memo
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines[0] === summary) lines.shift();
  return lines;
}

function isGuardianAttentionNote(value: string) {
  if (!value.trim()) return false;
  return /(주의|확인|예민|건조|엉킴|눈물|붉|자극|관리|닦|관찰|민감|불편|싫어|천천히)/.test(value);
}

function ResultPhoto({ label, url, priority = false }: { label: string; url: string | null; priority?: boolean }) {
  return (
    <figure className="overflow-hidden rounded-[20px] border border-[#f0d9d5] bg-[#fff8f6]">
      <div className="relative aspect-[4/3] w-full">
        {url ? (
          <Image
            src={url}
            alt={`${label} 사진`}
            fill
            priority={priority}
            sizes="(max-width: 430px) 50vw, 220px"
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-[#b99b97]">
            <Camera className="h-5 w-5" aria-hidden="true" />
            <span className="text-[12px]">등록된 사진이 없어요</span>
          </div>
        )}
      </div>
      <figcaption className="border-t border-[#f0d9d5] bg-white px-3 py-2.5 text-center text-[13px] font-semibold text-[#79575a]">
        {label}
      </figcaption>
    </figure>
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
}) {
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>(previewPhotoUrls ?? {});
  const [photoError, setPhotoError] = useState("");
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
  const careSummary = confirmedCareReport?.oneLineSummary ?? getCareSummary(record, petName);
  const treatmentSummary = confirmedCareReport?.treatmentSummary ?? record.style_notes;
  const homeCareTips = confirmedCareReport?.homeCareTips ?? getHomeCareDetails(record, careSummary);
  const guardianAttention = confirmedCareReport
    ? [confirmedCareReport.conditionSummary, confirmedCareReport.groomingResponse]
        .filter(isGuardianAttentionNote)
        .filter((value, index, values) => values.indexOf(value) === index)
        .join("\n")
    : "";
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
        className="mt-3 overflow-hidden rounded-[26px] border border-[#f2d2cf] bg-[#fff9f7] shadow-[0_18px_46px_rgba(180,92,98,0.14)]"
        aria-labelledby={`grooming-result-${record.id}`}
      >
        <div className="relative overflow-hidden bg-[linear-gradient(135deg,#f4897f_0%,#e96f7c_100%)] px-5 pb-5 pt-5 text-white">
          <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-white/10" />
          <p className="relative inline-flex items-center gap-1.5 text-[12px] font-semibold tracking-[0.08em] text-white/85">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> AI 케어리포트
          </p>
          <h4 id={`grooming-result-${record.id}`} className="relative mt-2 text-[25px] font-semibold tracking-[-0.05em] text-white">
            {petName}의 미용이 완료되었어요
          </h4>
        </div>

        <div className="px-5 py-6 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#fff0ed] text-[#e87378]">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="mt-3 text-[18px] font-semibold tracking-[-0.03em] text-[#453236]">케어리포트 작성 중</p>
          <p className="mt-2 text-[14px] leading-6 text-[#806d69]">
            오너가 오늘의 기록을 정리하고 있어요.<br />완성되면 이 링크에서 바로 확인할 수 있습니다.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-[14px] border border-[#f0c8c5] bg-white px-5 text-[14px] font-semibold text-[#a9555d] transition hover:bg-[#fff3f0]"
          >
            <RefreshCcw className="h-4 w-4" aria-hidden="true" /> 다시 확인하기
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      className="mt-3 overflow-hidden rounded-[28px] border border-[#f0d5d1] bg-[#fffaf8] shadow-[0_22px_54px_rgba(174,83,91,0.14)]"
      aria-labelledby={`grooming-result-${record.id}`}
    >
      <header className="relative overflow-hidden bg-[linear-gradient(145deg,#f58b80_0%,#e96f7d_100%)] px-5 pb-6 pt-5 text-white">
        <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-20 -left-12 h-40 w-40 rounded-full bg-[#cf5c6e]/20" />
        <div className="relative flex items-center justify-between gap-3">
          <p className="inline-flex items-center gap-1.5 text-[12px] font-bold tracking-[0.1em] text-white/85">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> PETMANAGER AI CARE
          </p>
          <span className="max-w-[132px] rounded-full border border-white/25 bg-white/15 px-3 py-1.5 text-right text-[10px] font-semibold leading-4">앱 설치나 회원가입 없이 확인</span>
        </div>
        <h4 id={`grooming-result-${record.id}`} className="relative mt-4 text-[29px] font-bold leading-[1.18] tracking-[-0.055em]">
          {petName}의 오늘 케어가<br />도착했어요
        </h4>
        <p className="relative mt-2 text-[13px] text-white/80">미용이 끝난 오늘, 꼭 필요한 내용만 담았어요.</p>
      </header>

      <div className="space-y-4 p-4">
        <section className="rounded-[22px] border border-[#f1d7d3] bg-white px-4 py-4 shadow-[0_8px_24px_rgba(122,73,71,0.06)]">
          <p className="inline-flex items-center gap-1.5 text-[12px] font-bold tracking-[0.04em] text-[#d76570]">
            <Heart className="h-4 w-4 fill-[#ffe0dc]" aria-hidden="true" /> 오늘의 특별 케어
          </p>
          <p className="mt-2.5 whitespace-pre-wrap text-[17px] font-semibold leading-[1.65] tracking-[-0.025em] text-[#3e3033]">{careSummary}</p>
          <div className="mt-3 flex items-center gap-2 border-t border-[#f5e5e1] pt-3 text-[12px] text-[#8b7472]">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#eaf8f1] text-[#21835c]">
              <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
            </span>
            <span><strong className="font-semibold text-[#5c4548]">{staffName || "담당 디자이너"}</strong>가 확인하고, AI가 읽기 쉽게 정리했어요.</span>
          </div>
        </section>

        {showCareReportPhotos ? (
          <section>
            <div className="flex items-center justify-between px-1">
              <div>
                <p className="text-[16px] font-bold tracking-[-0.025em] text-[#48383b]">오늘의 변화</p>
                <p className="mt-0.5 text-[12px] text-[#9a8580]">사진을 좌우로 비교해 보세요.</p>
              </div>
              {afterUrl ? (
                <a
                  href={afterUrl}
                  download={`${petName}-미용후.jpg`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[#efd6d2] bg-white px-3 text-[12px] font-semibold text-[#a85d63]"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" /> 사진 저장
                </a>
              ) : null}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <ResultPhoto label="미용 전" url={beforeUrl} priority />
              <ResultPhoto label="미용 후" url={afterUrl} priority />
            </div>
            {photoError ? <p className="mt-2 text-[12px] text-[#a04455]">{photoError}</p> : null}
          </section>
        ) : null}

        <section className="rounded-[22px] border border-[#f1d7d3] bg-white p-4">
          <p className="text-[12px] font-bold tracking-[0.04em] text-[#a96869]">오늘 진행한 미용</p>
          <p className="mt-2 whitespace-pre-wrap text-[15px] font-semibold leading-6 text-[#453639]">
            {treatmentSummary.trim() || `${serviceName} 케어를 완료했어요.`}
          </p>
        </section>

        {guardianAttention ? (
          <section className="rounded-[22px] border border-[#f2c9bc] bg-[#fff4ee] p-4">
            <p className="text-[14px] font-bold tracking-[-0.02em] text-[#a64f45]">보호자님, 이것만 확인해 주세요</p>
            <p className="mt-2 whitespace-pre-wrap text-[14px] leading-6 text-[#684843]">{guardianAttention}</p>
          </section>
        ) : null}

        <section className="rounded-[22px] border border-[#dcebe3] bg-[#f3faf6] p-4">
          <p className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[#287157]">
            <Home className="h-4 w-4" aria-hidden="true" /> 집에서 이어서 관리해 주세요
          </p>
          {homeCareTips.length ? (
            <ul className="mt-3 space-y-2">
              {homeCareTips.map((tip) => (
                <li key={tip} className="flex gap-2 text-[14px] leading-6 text-[#435c52]">
                  <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[#55a681]" aria-hidden="true" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[14px] leading-6 text-[#60756c]">오늘 별도로 안내드릴 홈케어는 없어요.</p>
          )}
        </section>

        <section className="overflow-hidden rounded-[22px] border border-[#efcfcb] bg-white">
          <div className="flex items-center justify-between gap-4 px-4 py-4">
            <div>
              <p className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[#a96869]">
                <CalendarDays className="h-4 w-4" aria-hidden="true" /> 다음 케어 권장 시점
              </p>
              <p className="mt-1.5 text-[19px] font-bold tracking-[-0.035em] text-[#493639]">{formatResultDate(record.next_recommended_visit_date)}</p>
            </div>
            <span className="shrink-0 rounded-full bg-[#fff0ed] px-3 py-1.5 text-[12px] font-bold text-[#d3656d]">잊기 전에 예약</span>
          </div>
          <p className="border-t border-[#f5e5e1] px-4 py-3 text-[13px] leading-5 text-[#7c6665]">{confirmedCareReport.nextVisitGuide}</p>
          <div className="px-3 pb-3">
            <button
              type="button"
              onClick={() => void startRebooking()}
              disabled={preparingRebooking}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[15px] bg-[#ed786f] px-4 text-[15px] font-bold text-white shadow-[0_9px_20px_rgba(210,96,100,0.22)] transition hover:bg-[#dc6965] disabled:opacity-60"
            >
              {preparingRebooking ? "저장된 정보를 불러오는 중" : "같은 조건으로 다시 예약"}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            {rebookingError ? <p className="mt-2 text-center text-[12px] text-[#a04455]">{rebookingError}</p> : null}
          </div>
        </section>

        {shopPhone ? (
          <a
            href={`tel:${shopPhone}`}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[14px] text-[13px] font-semibold text-[#806a69]"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" /> 매장에 문의하기
          </a>
        ) : null}
      </div>
    </section>
  );
}
