import { notFound } from "next/navigation";

import {
  CustomerGroomingResultCard,
  type CustomerResultMediaAsset,
} from "@/components/customer/customer-grooming-result-card";
import type { Appointment, GroomingRecord } from "@/types/domain";

const appointment = {
  id: "care-report-preview-appointment",
  appointment_date: "2026-08-18",
  actual_started_at: "2026-08-18T09:00:00+09:00",
  actual_completed_at: "2026-08-18T11:05:00+09:00",
} as Appointment;

const record = {
  id: "care-report-preview-record",
  service_id: "care-report-preview-service",
  before_media_asset_id: "care-report-before",
  after_media_asset_id: "care-report-after",
  next_recommended_visit_date: "2026-09-22",
  style_notes: "전체미용 · 몸 6mm · 얼굴 둥글게 · 눈가 세정 · 저자극 샴푸",
  memo: "오늘 두부는 눈물이 평소보다 많아 눈가 주변을 자극 없이 꼼꼼하게 세정했습니다.",
  actual_duration_minutes: 125,
  care_report_owner_confirmed_at: "2026-08-18T11:10:00+09:00",
  care_report_photo_consent: true,
  care_report_data: {
    oneLineSummary:
      "오늘 두부는 눈물이 평소보다 많아 눈가 주변을 자극 없이 꼼꼼하게 세정했습니다. 피부 부담을 줄이기 위해 기존 샴푸 대신 저자극 샴푸를 사용했어요.",
    treatmentSummary: "전체미용 · 몸 6mm · 얼굴 둥글게 · 눈가 세정 · 저자극 샴푸",
    conditionSummary: "눈가가 오래 젖어 있지 않도록 집에서도 부드럽게 닦아 주세요.",
    groomingResponse: "발 주변은 예민한 반응이 있어 천천히 나누어 진행했어요.",
    homeCareTips: [
      "눈가가 젖었을 때 부드러운 거즈로 톡톡 닦아 주세요.",
      "귀 뒤쪽은 엉킴이 생기기 쉬워 주 2~3회 빗질해 주세요.",
    ],
    nextVisitGuide: "지금의 길이와 얼굴 라인을 편하게 유지하려면 약 5주 뒤 관리를 권장드려요.",
  },
} as GroomingRecord;

const mediaAssets: CustomerResultMediaAsset[] = [
  {
    id: "care-report-before",
    appointmentId: appointment.id,
    groomingRecordId: record.id,
    mediaKind: "grooming_before",
  },
  {
    id: "care-report-after",
    appointmentId: appointment.id,
    groomingRecordId: record.id,
    mediaKind: "grooming_after",
  },
];

export default function CareReportPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main className="min-h-screen bg-white px-0 py-0 sm:px-4 sm:py-8">
      <div className="mx-auto w-full max-w-[430px]">
        <CustomerGroomingResultCard
          shopId="care-report-preview-shop"
          accessToken="preview-only"
          appointment={appointment}
          record={record}
          petName="두부"
          serviceName="전체미용"
          staffName="김서연 디자이너"
          shopPhone="02-1234-5678"
          mediaAssets={mediaAssets}
          previewPhotoUrls={{
            "care-report-before": "/images/customer-booking-hero-original.jpg",
            "care-report-after": "/images/customer-booking-hero-retriever-bath.jpg",
          }}
          weightHistory={[
            { measuredAt: "2025-09-20T11:00:00+09:00", weightKg: 4.1 },
            { measuredAt: "2025-10-25T11:00:00+09:00", weightKg: 4.2 },
            { measuredAt: "2025-12-02T11:00:00+09:00", weightKg: 4.25 },
            { measuredAt: "2026-01-10T11:00:00+09:00", weightKg: 4.3 },
            { measuredAt: "2026-02-21T11:00:00+09:00", weightKg: 4.35 },
            { measuredAt: "2026-03-28T11:00:00+09:00", weightKg: 4.4 },
            { measuredAt: "2026-05-09T11:00:00+09:00", weightKg: 4.45 },
            { measuredAt: "2026-06-13T11:00:00+09:00", weightKg: 4.5 },
            { measuredAt: "2026-07-11T11:00:00+09:00", weightKg: 4.55 },
            { measuredAt: "2026-08-18T11:00:00+09:00", weightKg: 4.6 },
          ]}
        />
      </div>
    </main>
  );
}
