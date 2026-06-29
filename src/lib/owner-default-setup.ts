import type { BootstrapStaffMember, BusinessHours } from "@/types/domain";

export const defaultOwnerBusinessHours: BusinessHours = {
  1: { open: "10:00", close: "19:00", enabled: true },
  2: { open: "10:00", close: "19:00", enabled: true },
  3: { open: "10:00", close: "19:00", enabled: true },
  4: { open: "10:00", close: "19:00", enabled: true },
  5: { open: "10:00", close: "19:00", enabled: true },
  6: { open: "10:00", close: "19:00", enabled: true },
  0: { open: "10:00", close: "19:00", enabled: false },
};

export const defaultOwnerRegularClosedDays = [0];

export const defaultOwnerServiceTemplates = [
  { key: "full-grooming", name: "전체 미용", price: 80000, durationMinutes: 120 },
  { key: "bath-partial", name: "목욕 + 부분정리", price: 55000, durationMinutes: 90 },
  { key: "bath", name: "목욕", price: 35000, durationMinutes: 60 },
  { key: "hygiene", name: "위생 미용", price: 25000, durationMinutes: 45 },
  { key: "partial-grooming", name: "부분 미용", price: 30000, durationMinutes: 45 },
  { key: "spa-medicated", name: "스파/약욕 케어", price: 40000, durationMinutes: 60 },
  { key: "nail-trim", name: "발톱 정리", price: 10000, durationMinutes: 30 },
];

export const defaultOwnerStaffDays: BootstrapStaffMember["defaultDays"] = ["mon", "tue", "wed", "thu", "fri", "sat"];

export function buildDefaultOwnerServices(shopId: string, now: string) {
  return defaultOwnerServiceTemplates.map((service) => ({
    id: `${shopId}-svc-${service.key}`,
    shop_id: shopId,
    name: service.name,
    price: service.price,
    price_type: "starting" as const,
    duration_minutes: service.durationMinutes,
    is_active: true,
    created_at: now,
    updated_at: now,
  }));
}

export function buildDefaultOwnerStaffMembers(params: {
  shopId: string;
  ownerName: string;
  ownerPhone?: string | null;
  now: string;
}) {
  const { shopId, ownerPhone, now } = params;
  return [
    {
      id: `${shopId}-staff-owner`,
      shop_id: shopId,
      name: "원장",
      display_name: "원장",
      profile_message: "아이 성향에 맞춰 차분하게 미용해드려요.",
      title_prefix: "",
      chip_color_index: 0,
      phone: ownerPhone?.trim() || "",
      role: "원장 / 전체 미용",
      position: "원장",
      default_days: defaultOwnerStaffDays,
      start_time: "10:00",
      end_time: "19:00",
      regular_off: "일",
      annual_remain: 0,
      is_active: true,
      sort_order: 1,
      created_at: now,
      updated_at: now,
    },
  ];
}
