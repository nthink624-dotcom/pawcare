import { CustomerGroomingResultCard, type CustomerResultMediaAsset } from "@/components/customer/customer-grooming-result-card";
import { LANDING_DEMO_SHOP_ID } from "@/lib/development-demo";
import { getBootstrap } from "@/server/bootstrap";

export const dynamic = "force-dynamic";

export default async function CustomerCareReportPreviewPage() {
  const data = await getBootstrap(LANDING_DEMO_SHOP_ID, { includeLanding: false, includeNotifications: false });
  const record = data.groomingRecords.find((item) => item.care_report_data && item.appointment_id);
  const appointment = record ? data.appointments.find((item) => item.id === record.appointment_id) : undefined;
  const pet = record ? data.pets.find((item) => item.id === record.pet_id) : undefined;
  const service = record ? data.services.find((item) => item.id === record.service_id) : undefined;
  const staff = record ? data.staffMembers.find((item) => item.id === record.staff_id) : undefined;

  if (!record || !appointment || !pet || !service || !staff) throw new Error("데모 케어리포트 데이터를 불러오지 못했습니다.");

  const mediaAssets: CustomerResultMediaAsset[] = [
    { id: "demo-care-before", appointmentId: appointment.id, groomingRecordId: record.id, mediaKind: "grooming_before" },
    { id: "demo-care-after", appointmentId: appointment.id, groomingRecordId: record.id, mediaKind: "grooming_after" },
  ];

  return <main className="min-h-screen bg-white"><div className="mx-auto w-full max-w-[430px]"><CustomerGroomingResultCard shopId={data.shop.id} accessToken="preview-only" appointment={appointment} record={record} petName={pet.name} serviceName={service.name} staffName={`${staff.displayName || staff.name} 디자이너`} shopPhone={data.shop.phone} mediaAssets={mediaAssets} embedded previewPhotoUrls={{ "demo-care-before": "/images/customer-booking-hero-original.jpg", "demo-care-after": "/images/customer-booking-hero-retriever-bath.jpg" }} weightHistory={[]} /></div></main>;
}
