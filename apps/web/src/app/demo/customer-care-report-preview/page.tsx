import { CustomerGroomingResultCard, type CustomerResultMediaAsset } from "@/components/customer/customer-grooming-result-card";
import type { Appointment, GroomingRecord } from "@/types/domain";

export const dynamic = "force-dynamic";

const appointment = {
  id: "landing-care-report-preview-appointment",
  appointment_date: "2026-08-18",
  actual_started_at: "2026-08-18T09:00:00+09:00",
  actual_completed_at: "2026-08-18T11:05:00+09:00",
} as Appointment;

const record = {
  id: "landing-care-report-preview-record",
  service_id: "landing-care-report-preview-service",
  before_media_asset_id: "landing-care-report-before",
  after_media_asset_id: "landing-care-report-after",
  next_recommended_visit_date: "2026-09-22",
  style_notes: "전체미용 · 몸 6mm · 얼굴 둥글게 · 눈가 세정 · 저자극 샴푸",
  memo: "오늘 두부는 눈물이 평소보다 많아 눈가 주변을 자극 없이 꼼꼼하게 세정했습니다.",
  actual_duration_minutes: 125,
  care_report_owner_confirmed_at: "2026-08-18T11:10:00+09:00",
  care_report_photo_consent: true,
  care_report_data: {
    reportText: "목욕은 잘 받아주었으며 얼굴은 동그랗게 정리했습니다. 앞발을 만질 때 예민해 중간중간 쉬어가며 진행했습니다.",
  },
} as GroomingRecord;

const mediaAssets: CustomerResultMediaAsset[] = [
  {
    id: "landing-care-report-before",
    appointmentId: appointment.id,
    groomingRecordId: record.id,
    mediaKind: "grooming_before",
  },
  {
    id: "landing-care-report-after",
    appointmentId: appointment.id,
    groomingRecordId: record.id,
    mediaKind: "grooming_after",
  },
];

export default function CustomerCareReportPreviewPage() {

  return <>
    <style>{`html { scrollbar-width: none; } html::-webkit-scrollbar { display: none; }`}</style>
    <main className="min-h-screen bg-white">
      <div className="mx-auto w-full max-w-[430px]">
        <CustomerGroomingResultCard
          shopId="demo-shop"
          accessToken="preview-only"
          appointment={appointment}
          record={record}
          petName="두부"
          serviceName="전체미용"
          staffName="김서연 디자이너"
          staffProfileImageUrl="/images/profiles/korean-groomer-profile-01.jpg"
          mediaAssets={mediaAssets}
          embedded
          previewPhotoUrls={{
            "landing-care-report-before": "/images/care-report-ai-before.png",
            "landing-care-report-after": "/images/care-report-ai-after.png",
          }}
          weightHistory={[
            { measuredAt: "2026-02-21T11:00:00+09:00", weightKg: 4.6 },
            { measuredAt: "2026-03-28T11:00:00+09:00", weightKg: 4.5 },
            { measuredAt: "2026-05-09T11:00:00+09:00", weightKg: 4.7 },
            { measuredAt: "2026-06-13T11:00:00+09:00", weightKg: 4.6 },
            { measuredAt: "2026-07-11T11:00:00+09:00", weightKg: 4.5 },
            { measuredAt: "2026-08-18T11:00:00+09:00", weightKg: 4.6 },
          ]}
        />
      </div>
    </main>
  </>;
}
