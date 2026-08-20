import { notFound } from "next/navigation";

import {
  CustomerGroomingResultCard,
  type CustomerResultMediaAsset,
} from "@/components/customer/customer-grooming-result-card";
import type { Appointment, GroomingRecord } from "@/types/domain";

const appointment = {
  id: "care-report-preview-appointment",
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
    <main className="min-h-screen bg-[#fff6f4] px-4 py-10">
      <div className="mx-auto w-full max-w-[430px]">
        <div className="mb-4 px-1">
          <p className="text-[13px] font-semibold text-[#a96869]">고객이 링크에서 받는 화면</p>
          <h1 className="mt-1 text-[22px] font-semibold tracking-[-0.04em] text-[#453236]">펫매니저 AI 케어리포트</h1>
        </div>
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
        />
      </div>
    </main>
  );
}
