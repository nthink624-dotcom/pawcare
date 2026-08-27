import { LANDING_DEMO_SHOP_ID, LANDING_DEMO_SHOP_NAME } from "@/lib/development-demo";
import { buildDemoBootstrap } from "@/lib/mock-data";

import type { BootstrapPayload } from "@/types/domain";

const LANDING_DEMO_SERVICE_IDS = {
  "svc-full": "petmanager-demo-service-full",
  "svc-bath": "petmanager-demo-service-bath",
  "svc-bath-only": "petmanager-demo-service-bath-only",
  "svc-care": "petmanager-demo-service-care",
  "svc-partial": "petmanager-demo-service-partial",
  "svc-spa": "petmanager-demo-service-spa",
  "svc-nail": "petmanager-demo-service-nail",
} as const;

/**
 * The landing booking preview must be independent from hosted shop rows.
 * Keep this projection synthetic and free of customer, pet, booking, or owner data.
 */
export function buildLandingDemoBootstrap(): BootstrapPayload {
  const template = buildDemoBootstrap();
  const templateGuardian = template.guardians[0];
  const templatePet = template.pets[0];
  const templateAppointment = template.appointments[0];
  const templateRecord = template.groomingRecords[0];
  const templateStaff = template.staffMembers[0];

  if (!templateGuardian || !templatePet || !templateAppointment || !templateRecord || !templateStaff) {
    throw new Error("랜딩 데모 fixture 구성이 올바르지 않습니다.");
  }

  const guardianId = "petmanager-demo-guardian";
  const petId = "petmanager-demo-pet";
  const appointmentId = "petmanager-demo-care-appointment";
  const recordId = "petmanager-demo-care-record";
  const staffId = "petmanager-demo-staff-1";
  const serviceId = LANDING_DEMO_SERVICE_IDS["svc-full"];

  return {
    ...template,
    mode: "mock",
    shop: {
      ...template.shop,
      id: LANDING_DEMO_SHOP_ID,
      name: LANDING_DEMO_SHOP_NAME,
      phone: "",
      address: "",
      description: "예약 화면 검수용 비식별 데모 매장입니다.",
      customer_page_settings: template.shop.customer_page_settings
        ? {
            ...template.shop.customer_page_settings,
            shop_name: LANDING_DEMO_SHOP_NAME,
          }
        : template.shop.customer_page_settings,
    },
    ownerProfile: null,
    guardians: [{
      ...templateGuardian,
      id: guardianId,
      shop_id: LANDING_DEMO_SHOP_ID,
      name: "예약 예시 고객",
      phone: "000-0000-0000",
      memo: "",
    }],
    deletedGuardians: [],
    pets: [{
      ...templatePet,
      id: petId,
      shop_id: LANDING_DEMO_SHOP_ID,
      guardian_id: guardianId,
      name: "예약 예시 A",
      notes: "",
      birthday: null,
      avatar_seed: "A",
    }],
    services: template.services.map((service) => ({
      ...service,
      id: LANDING_DEMO_SERVICE_IDS[service.id as keyof typeof LANDING_DEMO_SERVICE_IDS] ??
        `petmanager-demo-service-${service.id}`,
      shop_id: LANDING_DEMO_SHOP_ID,
    })),
    staffMembers: template.staffMembers.map((staffMember, index) => ({
      ...staffMember,
      id: `petmanager-demo-staff-${index + 1}`,
      name: "예약 담당",
      displayName: "예약 담당",
      phone: "",
      profileImageUrl: "",
      profileImageUrls: [],
      profileImageAssetIds: [],
    })),
    staffScheduleOverrides: [],
    appointments: [{
      ...templateAppointment,
      id: appointmentId,
      shop_id: LANDING_DEMO_SHOP_ID,
      guardian_id: guardianId,
      pet_id: petId,
      service_id: serviceId,
      staff_id: staffId,
      status: "completed",
      memo: "",
    }],
    appointmentChangeEvents: [],
    groomingRecords: [{
      ...templateRecord,
      id: recordId,
      shop_id: LANDING_DEMO_SHOP_ID,
      guardian_id: guardianId,
      pet_id: petId,
      service_id: serviceId,
      appointment_id: appointmentId,
      staff_id: staffId,
      style_notes: "전체 미용 · 얼굴 정리 · 저자극 샴푸",
      memo: "피부 부담을 줄여 차분하게 마무리했습니다.",
      care_report_owner_confirmed_at: templateRecord.updated_at,
      care_report_photo_consent: true,
      care_report_data: {
        oneLineSummary: "피부 부담을 줄여 차분하게 미용을 마무리했습니다.",
        treatmentSummary: "전체 미용 · 얼굴 정리 · 저자극 샴푸",
        conditionSummary: "눈가와 귀 주변을 부드럽게 관리해 주세요.",
        groomingResponse: "편안하게 적응할 수 있도록 천천히 진행했습니다.",
        homeCareTips: ["엉킴이 생기기 쉬운 부위를 주 2~3회 빗질해 주세요."],
        nextVisitGuide: "현재 길이를 유지하려면 약 5주 뒤 관리를 권장합니다.",
      },
    }],
    petStaffNotes: [],
    notifications: [],
    alimtalkCreditSummary: null,
    landingInterests: [],
    landingFeedback: [],
  };
}
