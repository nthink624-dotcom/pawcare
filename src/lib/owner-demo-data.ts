import { normalizeCustomerPageSettings } from "@/lib/customer-page-settings";
import {
  normalizeBootstrapNotifications,
  normalizeGuardianNotificationSettings,
  normalizeShopNotificationSettings,
} from "@/lib/notification-settings";
import { addDate, currentDateInTimeZone } from "@/lib/utils";
import type {
  Appointment,
  BootstrapPayload,
  GroomingRecord,
  Guardian,
  Notification,
  Pet,
  Service,
  Shop,
  StaffMember,
} from "@/types/domain";

const shopId = "owner-demo";
const today = currentDateInTimeZone();
const now = at(today, "09:00");

function at(date: string, time: string) {
  return `${date}T${time}:00.000Z`;
}

function endAt(date: string, time: string, durationMinutes: number) {
  const [hour, minute] = time.split(":").map(Number);
  const totalMinutes = hour * 60 + minute + durationMinutes;
  const nextHour = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const nextMinute = String(totalMinutes % 60).padStart(2, "0");
  return at(date, `${nextHour}:${nextMinute}`);
}

function makeAppointment(
  id: string,
  date: string,
  time: string,
  status: Appointment["status"],
  guardianId: string,
  petId: string,
  serviceId: string,
  memo = "",
  staffId: string | null = "staff-woojin",
): Appointment {
  const service = demoServices.find((item) => item.id === serviceId);
  const durationMinutes = service?.duration_minutes ?? 60;

  return {
    id,
    shop_id: shopId,
    guardian_id: guardianId,
    pet_id: petId,
    service_id: serviceId,
    staff_id: staffId,
    appointment_date: date,
    appointment_time: time,
    status,
    memo,
    rejection_reason: null,
    start_at: at(date, time),
    end_at: endAt(date, time, durationMinutes),
    source: "customer",
    created_at: now,
    updated_at: now,
  };
}

function makeRecord(
  id: string,
  appointmentId: string,
  date: string,
  time: string,
  guardianId: string,
  petId: string,
  serviceId: string,
  styleNotes: string,
  memo: string,
  pricePaid: number,
): GroomingRecord {
  return {
    id,
    shop_id: shopId,
    guardian_id: guardianId,
    pet_id: petId,
    service_id: serviceId,
    appointment_id: appointmentId,
    style_notes: styleNotes,
    memo,
    price_paid: pricePaid,
    groomed_at: at(date, time),
    created_at: at(date, time),
    updated_at: at(date, time),
  };
}

const demoShop: Shop = {
  id: shopId,
  name: "우진만세",
  phone: "02-1234-5678",
  address: "서울 강남구 테헤란로 123, 2층",
  description: "예약 현황이 채워진 모바일 앱 데모 매장입니다.",
  business_hours: {
    1: { open: "09:00", close: "19:00", enabled: true },
    2: { open: "09:00", close: "19:00", enabled: true },
    3: { open: "09:00", close: "19:00", enabled: true },
    4: { open: "09:00", close: "19:00", enabled: true },
    5: { open: "09:00", close: "19:00", enabled: true },
    6: { open: "10:00", close: "18:00", enabled: true },
    0: { open: "10:00", close: "16:00", enabled: false },
  },
  regular_closed_days: [0],
  temporary_closed_dates: [addDate(today, 9)],
  concurrent_capacity: 2,
  booking_slot_interval_minutes: 30,
  booking_slot_offset_minutes: 0,
  booking_available_start_time: "09:00",
  booking_available_end_time: "19:00",
  approval_mode: "auto",
  notification_settings: normalizeShopNotificationSettings({
    enabled: true,
    revisit_enabled: true,
    booking_confirmed_enabled: true,
    booking_rejected_enabled: true,
    booking_cancelled_enabled: true,
    booking_rescheduled_enabled: true,
    grooming_started_enabled: true,
    grooming_almost_done_enabled: true,
    grooming_completed_enabled: true,
  }),
  customer_page_settings: normalizeCustomerPageSettings({
    shop_name: "우진만세",
    tagline: "모바일 앱 화면 확인용 데모 예약",
    hero_image_url: "",
    primary_color: "#2563eb",
    notices: [
      "첫 방문은 상담 포함으로 여유 있게 예약해 주세요.",
      "아이 컨디션에 따라 미용 시간이 달라질 수 있어요.",
      "주차는 건물 뒤편 공용 주차장을 이용해 주세요.",
    ],
    show_services: true,
    booking_button_label: "예약하기",
    show_kakao_inquiry: true,
  }),
  created_at: now,
  updated_at: now,
};

const demoServices: Service[] = [
  { id: "svc-bath", shop_id: shopId, name: "목욕", price: 25000, price_type: "fixed", duration_minutes: 45, is_active: true, created_at: now, updated_at: now },
  { id: "svc-bath-trim", shop_id: shopId, name: "목욕 + 부분정리", price: 38000, price_type: "fixed", duration_minutes: 80, is_active: true, created_at: now, updated_at: now },
  { id: "svc-full", shop_id: shopId, name: "전체 미용", price: 55000, price_type: "starting", duration_minutes: 120, is_active: true, created_at: now, updated_at: now },
  { id: "svc-sanitary", shop_id: shopId, name: "위생 미용", price: 18000, price_type: "fixed", duration_minutes: 30, is_active: true, created_at: now, updated_at: now },
];

const demoStaffMembers: StaffMember[] = [
  {
    id: "staff-woojin",
    shopId,
    name: "정우진",
    displayName: "정우진",
    profileImageUrl: null,
    titlePrefix: "원장",
    position: "대표 미용사",
    chipColorIndex: 0,
    profileMessage: "아이 성향에 맞춰 차분하게 미용해드려요.",
    created_at: now,
    updated_at: now,
  },
  {
    id: "staff-suhyun",
    shopId,
    name: "박수현",
    displayName: "박수현",
    profileImageUrl: null,
    titlePrefix: "실장",
    position: "미용사",
    chipColorIndex: 1,
    profileMessage: "소형견 목욕과 부분정리를 꼼꼼하게 진행해요.",
    created_at: now,
    updated_at: now,
  },
];

const demoGuardians: Guardian[] = [
  { id: "g-woojin", shop_id: shopId, name: "정우진", phone: "010-8498-2077", memo: "문자 연락 선호", notification_settings: normalizeGuardianNotificationSettings({ enabled: true, revisit_enabled: true }), created_at: now, updated_at: now },
  { id: "g-minji", shop_id: shopId, name: "김민지", phone: "010-1234-5678", memo: "오전 시간 선호", notification_settings: normalizeGuardianNotificationSettings({ enabled: true, revisit_enabled: true }), created_at: now, updated_at: now },
  { id: "g-seojun", shop_id: shopId, name: "박서준", phone: "010-9876-5432", memo: "방문 전 문자 요청", notification_settings: normalizeGuardianNotificationSettings({ enabled: true, revisit_enabled: false }), created_at: now, updated_at: now },
  { id: "g-suyeon", shop_id: shopId, name: "이수연", phone: "010-5555-1234", memo: "겁이 많은 편", notification_settings: normalizeGuardianNotificationSettings({ enabled: false, revisit_enabled: false }), created_at: now, updated_at: now },
];

const demoPets: Pet[] = [
  { id: "p-uyu", shop_id: shopId, guardian_id: "g-woojin", name: "우유", breed: "포메라니안", weight: 3.2, age: 4, notes: "엉킴 체크 필요", birthday: "2022-05-14", grooming_cycle_weeks: 4, avatar_seed: "우", created_at: now, updated_at: now },
  { id: "p-krong", shop_id: shopId, guardian_id: "g-woojin", name: "크롱이", breed: "말티즈", weight: 2.9, age: 3, notes: "첫미용 긴장 있음", birthday: "2023-03-17", grooming_cycle_weeks: 5, avatar_seed: "크", created_at: now, updated_at: now },
  { id: "p-coco", shop_id: shopId, guardian_id: "g-minji", name: "코코", breed: "푸들", weight: 5.1, age: 5, notes: "발바닥 민감", birthday: "2020-11-08", grooming_cycle_weeks: 3, avatar_seed: "코", created_at: now, updated_at: now },
  { id: "p-mong", shop_id: shopId, guardian_id: "g-seojun", name: "몽이", breed: "비숑", weight: 4.7, age: 2, notes: "간식 주면 안정됨", birthday: "2024-01-19", grooming_cycle_weeks: 4, avatar_seed: "몽", created_at: now, updated_at: now },
  { id: "p-bori", shop_id: shopId, guardian_id: "g-suyeon", name: "보리", breed: "시츄", weight: 4.2, age: 6, notes: "귀 청소 천천히", birthday: null, grooming_cycle_weeks: 4, avatar_seed: "보", created_at: now, updated_at: now },
];

const todayAppointments: Appointment[] = [
  makeAppointment("demo-a-1", today, "09:30", "confirmed", "g-woojin", "p-uyu", "svc-sanitary", "첫 방문 상담 포함", "staff-woojin"),
  makeAppointment("demo-a-2", today, "10:15", "confirmed", "g-minji", "p-coco", "svc-bath-trim", "발바닥 정리 추가", "staff-suhyun"),
  makeAppointment("demo-a-3", today, "11:00", "confirmed", "g-woojin", "p-krong", "svc-bath", "짧게 정리", "staff-woojin"),
  makeAppointment("demo-a-4", today, "13:00", "in_progress", "g-suyeon", "p-bori", "svc-full", "얼굴 라인 정리", "staff-woojin"),
  makeAppointment("demo-a-5", today, "15:00", "almost_done", "g-seojun", "p-mong", "svc-full", "다리 볼륨 유지", "staff-suhyun"),
  makeAppointment("demo-a-6", today, "16:30", "completed", "g-woojin", "p-uyu", "svc-bath-trim", "기본 목욕 완료", "staff-woojin"),
  makeAppointment("demo-a-7", today, "17:30", "cancelled", "g-minji", "p-coco", "svc-bath", "보호자 일정 변경", "staff-suhyun"),
];

const futureAppointments: Appointment[] = [
  makeAppointment("demo-a-8", addDate(today, 1), "09:30", "confirmed", "g-woojin", "p-krong", "svc-full", "스포팅 5mm", "staff-woojin"),
  makeAppointment("demo-a-9", addDate(today, 1), "11:00", "confirmed", "g-seojun", "p-mong", "svc-bath-trim", "긴장 많음", "staff-suhyun"),
  makeAppointment("demo-a-10", addDate(today, 1), "13:00", "confirmed", "g-suyeon", "p-bori", "svc-bath", "", "staff-woojin"),
  makeAppointment("demo-a-11", addDate(today, 1), "15:00", "confirmed", "g-woojin", "p-uyu", "svc-sanitary", "", "staff-suhyun"),
  makeAppointment("demo-a-12", addDate(today, 1), "17:00", "cancelled", "g-minji", "p-coco", "svc-full", "시간 변경 요청", "staff-woojin"),
  makeAppointment("demo-a-13", addDate(today, 2), "09:00", "confirmed", "g-woojin", "p-uyu", "svc-bath-trim", "", "staff-woojin"),
  makeAppointment("demo-a-14", addDate(today, 2), "10:30", "confirmed", "g-minji", "p-coco", "svc-full", "", "staff-suhyun"),
  makeAppointment("demo-a-15", addDate(today, 2), "12:00", "confirmed", "g-suyeon", "p-bori", "svc-bath", "", "staff-woojin"),
  makeAppointment("demo-a-16", addDate(today, 2), "14:00", "confirmed", "g-woojin", "p-krong", "svc-sanitary", "", "staff-suhyun"),
  makeAppointment("demo-a-17", addDate(today, 2), "16:00", "confirmed", "g-seojun", "p-mong", "svc-bath-trim", "", "staff-woojin"),
];

const pastAppointments: Appointment[] = [
  makeAppointment("demo-a-18", addDate(today, -1), "09:00", "completed", "g-woojin", "p-uyu", "svc-full", "스포팅 5mm", "staff-woojin"),
  makeAppointment("demo-a-19", addDate(today, -1), "11:00", "completed", "g-minji", "p-coco", "svc-bath-trim", "부분정리 포함", "staff-suhyun"),
  makeAppointment("demo-a-20", addDate(today, -1), "14:00", "completed", "g-woojin", "p-krong", "svc-bath", "", "staff-woojin"),
  makeAppointment("demo-a-21", addDate(today, -2), "10:00", "completed", "g-suyeon", "p-bori", "svc-full", "", "staff-suhyun"),
  makeAppointment("demo-a-22", addDate(today, -2), "15:00", "completed", "g-seojun", "p-mong", "svc-sanitary", "", "staff-woojin"),
];

const demoAppointments = [...todayAppointments, ...futureAppointments, ...pastAppointments];

const demoRecords: GroomingRecord[] = [
  makeRecord("demo-r-1", "demo-a-6", today, "17:20", "g-woojin", "p-uyu", "svc-bath-trim", "발끝 라운딩 정리", "다음 방문 때 털 길이 유지", 38000),
  makeRecord("demo-r-2", "demo-a-18", addDate(today, -1), "11:10", "g-woojin", "p-uyu", "svc-full", "몸통 5mm", "보호자 만족도 높음", 55000),
  makeRecord("demo-r-3", "demo-a-19", addDate(today, -1), "12:20", "g-minji", "p-coco", "svc-bath-trim", "목욕 + 부분정리", "발바닥 붉음 체크", 38000),
  makeRecord("demo-r-4", "demo-a-20", addDate(today, -1), "14:50", "g-woojin", "p-krong", "svc-bath", "기본 목욕", "다음 방문 4주 권장", 25000),
  makeRecord("demo-r-5", "demo-a-21", addDate(today, -2), "12:10", "g-suyeon", "p-bori", "svc-full", "전체 미용", "귀 주변 천천히 진행", 55000),
  makeRecord("demo-r-6", "demo-a-22", addDate(today, -2), "15:40", "g-seojun", "p-mong", "svc-sanitary", "위생 미용", "재방문 알림 필요", 18000),
];

const demoNotifications: Notification[] = [
  {
    id: "demo-n-1",
    shop_id: shopId,
    appointment_id: "demo-a-1",
    pet_id: "p-uyu",
    guardian_id: "g-woojin",
    type: "booking_confirmed",
    channel: "mock",
    message: "우유 예약이 확정되었습니다.",
    status: "mocked",
    template_key: "booking_confirmed",
    provider: "mock-dispatcher",
    sent_at: now,
    created_at: now,
  },
];

export function buildOwnerDemoBootstrap(): BootstrapPayload {
  return normalizeBootstrapNotifications({
    mode: "mock",
    shop: demoShop,
    ownerProfile: {
      user_id: "owner-demo-user",
      shop_id: shopId,
      login_id: "demo-owner",
      name: "정우진",
      birth_date: null,
      phone_number: "010-8498-2077",
      created_at: now,
      updated_at: now,
    },
    guardians: demoGuardians,
    deletedGuardians: [],
    pets: demoPets,
    services: demoServices,
    staffMembers: demoStaffMembers,
    appointments: demoAppointments,
    appointmentChangeEvents: [],
    groomingRecords: demoRecords,
    petStaffNotes: [],
    notifications: demoNotifications,
    landingInterests: [],
    landingFeedback: [],
  });
}
