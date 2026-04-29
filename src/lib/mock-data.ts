import { normalizeCustomerPageSettings } from "@/lib/customer-page-settings";
import { normalizeBootstrapNotifications, normalizeGuardianNotificationSettings, normalizeShopNotificationSettings } from "@/lib/notification-settings";
import { addDate, currentDateInTimeZone } from "@/lib/utils";

import type {
  Appointment,
  BootstrapPayload,
  GroomingRecord,
  Guardian,
  LandingFeedback,
  LandingInterest,
  Notification,
  Pet,
  Service,
  Shop,
} from "@/types/domain";

const today = currentDateInTimeZone();
const yesterday = addDate(today, -1);
const twoDaysAgo = addDate(today, -2);
const fiveWeeksAgo = addDate(today, -35);
const sevenWeeksAgo = addDate(today, -49);
const tomorrow = addDate(today, 1);
const dayAfterTomorrow = addDate(today, 2);
const temporaryClosedDate = addDate(today, 9);

function at(date: string, time: string) {
  return `${date}T${time}:00.000Z`;
}

const now = at(today, "09:00");

export const demoShop: Shop = {
  id: "demo-shop",
  name: "포근한 발바닥 미용실",
  phone: "02-1234-5678",
  address: "서울 강남구 테헤란로 123",
  description: "소형견 중심의 예약제 그루밍 살롱입니다.",
  business_hours: {
    1: { open: "10:00", close: "19:00", enabled: true },
    2: { open: "10:00", close: "19:00", enabled: true },
    3: { open: "10:00", close: "19:00", enabled: true },
    4: { open: "10:00", close: "19:00", enabled: true },
    5: { open: "10:00", close: "19:00", enabled: true },
    6: { open: "10:00", close: "18:00", enabled: true },
    0: { open: "10:00", close: "16:00", enabled: false },
  },
  regular_closed_days: [0],
  temporary_closed_dates: [temporaryClosedDate],
  concurrent_capacity: 2,
  booking_slot_interval_minutes: 30,
  booking_slot_offset_minutes: 0,
  approval_mode: "manual",
  notification_settings: normalizeShopNotificationSettings({
    enabled: true,
    revisit_enabled: true,
    booking_confirmed_enabled: true,
    booking_rejected_enabled: true,
    booking_cancelled_enabled: true,
    booking_rescheduled_enabled: true,
    grooming_almost_done_enabled: true,
    grooming_completed_enabled: true,
  }),
  customer_page_settings: normalizeCustomerPageSettings({
    shop_name: "포근한 발바닥 미용실",
    tagline: "아이 성향에 맞춘 차분한 그루밍 예약을 도와드려요.",
    hero_image_url: "https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?auto=format&fit=crop&w=1200&q=80",
    primary_color: "#1F6B5B",
    notices: [
      "첫 방문은 상담 포함으로 여유 있게 예약해 주세요.",
      "미용 시간은 아이 컨디션에 따라 조금 달라질 수 있어요.",
      "주차는 건물 뒤편 공용 주차장을 이용해 주세요.",
    ],
    show_services: true,
    booking_button_label: "예약하기",
    show_kakao_inquiry: true,
  }),
  created_at: now,
  updated_at: now,
};

export const demoServices: Service[] = [
  { id: "svc-full", shop_id: "demo-shop", name: "전체 미용", price: 55000, duration_minutes: 120, is_active: true, created_at: now, updated_at: now },
  { id: "svc-bath", shop_id: "demo-shop", name: "목욕 + 부분미용", price: 38000, duration_minutes: 80, is_active: true, created_at: now, updated_at: now },
  { id: "svc-bath-only", shop_id: "demo-shop", name: "목욕", price: 25000, duration_minutes: 45, is_active: true, created_at: now, updated_at: now },
  { id: "svc-care", shop_id: "demo-shop", name: "저자극 케어", price: 18000, duration_minutes: 30, is_active: true, created_at: now, updated_at: now },
];

export const demoGuardians: Guardian[] = [
  { id: "g-1", shop_id: "demo-shop", name: "김민지", phone: "010-1234-5678", memo: "문 앞 픽업 선호", notification_settings: normalizeGuardianNotificationSettings({ enabled: true, revisit_enabled: true }), created_at: now, updated_at: now },
  { id: "g-2", shop_id: "demo-shop", name: "박서준", phone: "010-9876-5432", memo: "오전 시간 선호", notification_settings: normalizeGuardianNotificationSettings({ enabled: true, revisit_enabled: false }), created_at: now, updated_at: now },
  { id: "g-3", shop_id: "demo-shop", name: "이수연", phone: "010-5555-1234", memo: "피부 예민", notification_settings: normalizeGuardianNotificationSettings({ enabled: false, revisit_enabled: false }), created_at: now, updated_at: now },
];

export const demoPets: Pet[] = [
  { id: "p-1", shop_id: "demo-shop", guardian_id: "g-1", name: "몽이", breed: "말티즈", weight: 3.5, age: 3, notes: "귀 청소 민감", birthday: "2022-05-14", grooming_cycle_weeks: 4, avatar_seed: "M", created_at: now, updated_at: now },
  { id: "p-2", shop_id: "demo-shop", guardian_id: "g-1", name: "차이", breed: "포메라니안", weight: 2.7, age: 2, notes: "첫 미용 때 긴장 심함", birthday: "2023-03-17", grooming_cycle_weeks: 5, avatar_seed: "C", created_at: now, updated_at: now },
  { id: "p-3", shop_id: "demo-shop", guardian_id: "g-2", name: "코코", breed: "푸들", weight: 5.1, age: 5, notes: "간식 후 진정 도움", birthday: "2020-11-08", grooming_cycle_weeks: 3, avatar_seed: "K", created_at: now, updated_at: now },
  { id: "p-4", shop_id: "demo-shop", guardian_id: "g-3", name: "보리", breed: "시츄", weight: 4.2, age: 4, notes: "", birthday: null, grooming_cycle_weeks: 4, avatar_seed: "B", created_at: now, updated_at: now },
];

export const demoAppointments: Appointment[] = [
  { id: "a-1", shop_id: "demo-shop", guardian_id: "g-1", pet_id: "p-1", service_id: "svc-full", appointment_date: yesterday, appointment_time: "09:00", status: "completed", memo: "스포팅 5mm", rejection_reason: null, start_at: at(yesterday, "09:00"), end_at: at(yesterday, "11:00"), source: "owner", created_at: now, updated_at: now },
  { id: "a-2", shop_id: "demo-shop", guardian_id: "g-2", pet_id: "p-3", service_id: "svc-bath", appointment_date: today, appointment_time: "10:30", status: "almost_done", memo: "발바닥 정리 추가", rejection_reason: null, start_at: at(today, "10:30"), end_at: at(today, "11:50"), source: "customer", created_at: now, updated_at: now },
  { id: "a-3", shop_id: "demo-shop", guardian_id: "g-3", pet_id: "p-4", service_id: "svc-bath-only", appointment_date: today, appointment_time: "11:30", status: "cancelled", memo: "보호자 일정 변경", rejection_reason: null, start_at: at(today, "11:30"), end_at: at(today, "12:15"), source: "customer", created_at: now, updated_at: now },
  { id: "a-4", shop_id: "demo-shop", guardian_id: "g-1", pet_id: "p-2", service_id: "svc-bath-only", appointment_date: today, appointment_time: "13:00", status: "in_progress", memo: "얼굴 컷 정리", rejection_reason: null, start_at: at(today, "13:00"), end_at: at(today, "13:45"), source: "customer", created_at: now, updated_at: now },
  { id: "a-5", shop_id: "demo-shop", guardian_id: "g-2", pet_id: "p-3", service_id: "svc-full", appointment_date: today, appointment_time: "15:00", status: "confirmed", memo: "다리 컷 유지", rejection_reason: null, start_at: at(today, "15:00"), end_at: at(today, "17:00"), source: "customer", created_at: now, updated_at: now },
  { id: "a-6", shop_id: "demo-shop", guardian_id: "g-3", pet_id: "p-4", service_id: "svc-care", appointment_date: tomorrow, appointment_time: "17:00", status: "confirmed", memo: "", rejection_reason: null, start_at: at(tomorrow, "17:00"), end_at: at(tomorrow, "17:30"), source: "owner", created_at: now, updated_at: now },
  { id: "a-7", shop_id: "demo-shop", guardian_id: "g-1", pet_id: "p-1", service_id: "svc-bath", appointment_date: dayAfterTomorrow, appointment_time: "11:00", status: "confirmed", memo: "짧게", rejection_reason: null, start_at: at(dayAfterTomorrow, "11:00"), end_at: at(dayAfterTomorrow, "12:20"), source: "customer", created_at: now, updated_at: now },
  { id: "a-8", shop_id: "demo-shop", guardian_id: "g-1", pet_id: "p-2", service_id: "svc-bath-only", appointment_date: today, appointment_time: "16:30", status: "pending", memo: "", rejection_reason: null, start_at: at(today, "16:30"), end_at: at(today, "17:15"), source: "customer", created_at: now, updated_at: now },
  { id: "a-9", shop_id: "demo-shop", guardian_id: "g-2", pet_id: "p-3", service_id: "svc-bath-only", appointment_date: twoDaysAgo, appointment_time: "09:30", status: "confirmed", memo: "", rejection_reason: null, start_at: at(twoDaysAgo, "09:30"), end_at: at(twoDaysAgo, "10:15"), source: "customer", created_at: now, updated_at: now },
];

export const demoRecords: GroomingRecord[] = [
  { id: "r-1", shop_id: "demo-shop", guardian_id: "g-1", pet_id: "p-1", service_id: "svc-full", appointment_id: "a-1", style_notes: "스포팅 5mm", memo: "귀 주변은 부드럽게 정리", price_paid: 55000, groomed_at: at(yesterday, "11:00"), created_at: now, updated_at: now },
  { id: "r-2", shop_id: "demo-shop", guardian_id: "g-2", pet_id: "p-3", service_id: "svc-full", appointment_id: null, style_notes: "테디베어 컷", memo: "발바닥 정리 필수", price_paid: 55000, groomed_at: at(fiveWeeksAgo, "14:00"), created_at: now, updated_at: now },
  { id: "r-3", shop_id: "demo-shop", guardian_id: "g-3", pet_id: "p-4", service_id: "svc-full", appointment_id: null, style_notes: "짧은 얼굴 컷", memo: "눈 주변 정리", price_paid: 50000, groomed_at: at(sevenWeeksAgo, "12:00"), created_at: now, updated_at: now },
];

export const demoNotifications: Notification[] = [
  { id: "n-1", shop_id: "demo-shop", appointment_id: "a-5", pet_id: "p-3", guardian_id: "g-2", type: "booking_confirmed", channel: "mock", message: "코코 예약이 확정되었어요.", status: "mocked", template_key: "booking_confirmed", provider: "mock-dispatcher", sent_at: now, created_at: now },
  { id: "n-2", shop_id: "demo-shop", appointment_id: null, pet_id: "p-1", guardian_id: "g-1", type: "revisit_notice", channel: "mock", message: "몽이 재방문 시기가 다가오고 있어요.", status: "mocked", template_key: "revisit_notice", provider: "mock-dispatcher", metadata: { source: "auto" }, sent_at: now, created_at: now },
];

export const demoLandingInterests: LandingInterest[] = [
  { id: "li-1", shop_name: "몽실몽실", owner_name: "홍길동", phone: "010-0000-0000", needs: ["예약 통합", "재방문 알림"], created_at: now },
];

export const demoLandingFeedback: LandingFeedback[] = [
  { id: "lf-1", type: "feature", text: "재방문 예약 진입을 더 빠르게 만들면 좋겠어요.", created_at: now },
];

export function buildDemoBootstrap(): BootstrapPayload {
  return normalizeBootstrapNotifications({
    mode: "mock",
    shop: demoShop,
    guardians: demoGuardians,
    deletedGuardians: [],
    pets: demoPets,
    services: demoServices,
    appointments: demoAppointments,
    groomingRecords: demoRecords,
    notifications: demoNotifications,
    landingInterests: demoLandingInterests,
    landingFeedback: demoLandingFeedback,
  });
}
