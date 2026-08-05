"use client";

import { CalendarDays, Clock3, Scissors } from "lucide-react";
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
  if (!value) return "기록 없음";
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(parsed);
}

function getActualDurationMinutes(appointment: Appointment, record: GroomingRecord) {
  if (typeof record.actual_duration_minutes === "number") return record.actual_duration_minutes;
  if (!appointment.actual_started_at || !appointment.actual_completed_at) return null;
  const started = new Date(appointment.actual_started_at).getTime();
  const completed = new Date(appointment.actual_completed_at).getTime();
  if (!Number.isFinite(started) || !Number.isFinite(completed) || completed < started) return null;
  return Math.round((completed - started) / 60_000);
}

function formatDuration(minutes: number | null) {
  if (minutes === null) return "기록 없음";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${remainder}분`;
  return remainder ? `${hours}시간 ${remainder}분` : `${hours}시간`;
}

function ResultTextBlock({ title, value, empty }: { title: string; value: string; empty: string }) {
  return (
    <div className="rounded-[14px] border border-[#eee6e1] bg-white px-4 py-3">
      <p className="text-[13px] font-semibold text-[#8b7767]">{title}</p>
      <p className="mt-1.5 whitespace-pre-wrap text-[15px] leading-6 text-[#332a25]">
        {value.trim() || empty}
      </p>
    </div>
  );
}

function ResultPhoto({ label, url }: { label: string; url: string | null }) {
  return (
    <figure className="overflow-hidden rounded-[16px] border border-[#eee6e1] bg-[#faf8f6]">
      <div className="relative aspect-[4/3] w-full">
        {url ? (
          <Image src={url} alt={`${label} 사진`} fill sizes="(max-width: 430px) 50vw, 220px" className="object-cover" unoptimized />
        ) : (
          <div className="flex h-full items-center justify-center text-[13px] text-[#a89a91]">등록된 사진이 없어요</div>
        )}
      </div>
      <figcaption className="border-t border-[#eee6e1] bg-white px-3 py-2 text-center text-[13px] font-semibold text-[#6f5f55]">
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
  mediaAssets,
}: {
  shopId: string;
  accessToken: string;
  appointment: Appointment;
  record: GroomingRecord;
  petName: string;
  serviceName: string;
  mediaAssets: CustomerResultMediaAsset[];
}) {
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [photoError, setPhotoError] = useState("");
  const mediaAssetIds = useMemo(() => [...new Set(mediaAssets.map((item) => item.id))], [mediaAssets]);

  useEffect(() => {
    if (!mediaAssetIds.length) return;
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
  }, [accessToken, mediaAssetIds, shopId]);

  const latestByKind = useMemo(() => {
    const result: Partial<Record<CustomerResultMediaAsset["mediaKind"], CustomerResultMediaAsset>> = {};
    for (const asset of mediaAssets) result[asset.mediaKind] = asset;
    return result;
  }, [mediaAssets]);
  const beforeId = record.before_media_asset_id ?? latestByKind.grooming_before?.id ?? null;
  const afterId = record.after_media_asset_id ?? latestByKind.grooming_after?.id ?? null;
  const actualDuration = getActualDurationMinutes(appointment, record);

  return (
    <section className="mt-3 rounded-[20px] border border-[#eadfd8] bg-[#fcfaf8] p-3.5" aria-labelledby={`grooming-result-${record.id}`}>
      <div className="flex items-start justify-between gap-3 px-1 py-1">
        <div>
          <p className="text-[12px] font-semibold text-[#a08e82]">미용 결과</p>
          <h4 id={`grooming-result-${record.id}`} className="mt-1 text-[19px] font-semibold tracking-[-0.03em] text-[#332a25]">
            {petName}의 미용 기록
          </h4>
        </div>
        <Scissors className="mt-1 h-5 w-5 text-[#8b5e3c]" aria-hidden="true" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <ResultPhoto label="미용 시작" url={beforeId ? signedUrls[beforeId] ?? null : null} />
        <ResultPhoto label="미용 완료" url={afterId ? signedUrls[afterId] ?? null : null} />
      </div>
      {photoError ? <p className="mt-2 text-[12px] text-[#a04455]">{photoError}</p> : null}

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <div className="rounded-[14px] border border-[#eee6e1] bg-white px-3.5 py-3">
          <p className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#8b7767]"><Clock3 className="h-3.5 w-3.5" /> 실제 소요시간</p>
          <p className="mt-1.5 text-[16px] font-semibold text-[#332a25]">{formatDuration(actualDuration)}</p>
        </div>
        <div className="rounded-[14px] border border-[#eee6e1] bg-white px-3.5 py-3">
          <p className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#8b7767]"><CalendarDays className="h-3.5 w-3.5" /> 다음 권장 방문일</p>
          <p className="mt-1.5 text-[14px] font-semibold leading-5 text-[#332a25]">{formatResultDate(record.next_recommended_visit_date)}</p>
        </div>
      </div>

      <div className="mt-2.5 space-y-2.5">
        <ResultTextBlock title="시술 내용" value={record.style_notes} empty={`${serviceName} 시술을 완료했어요.`} />
        <ResultTextBlock title="특이사항" value={record.memo} empty="기록된 특이사항이 없어요." />
      </div>
      <p className="mt-3 px-1 text-[12px] leading-5 text-[#9b8b81]">앱 설치나 회원가입 없이 이 링크에서 결과를 확인할 수 있어요.</p>
    </section>
  );
}
