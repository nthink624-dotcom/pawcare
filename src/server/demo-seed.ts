import { randomUUID } from "node:crypto";

import { normalizeCustomerPageSettings } from "@/lib/customer-page-settings";
import { normalizeShopNotificationSettings } from "@/lib/notification-settings";
import { addDate, currentDateInTimeZone, nowIso } from "@/lib/utils";
import { getSupabaseAdmin } from "@/lib/supabase/server";

function at(date: string, time: string) {
  return `${date}T${time}:00.000Z`;
}

export async function seedDemoDataForShop(shopId: string, shopName: string, shopAddress: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  const today = currentDateInTimeZone();
  const yesterday = addDate(today, -1);
  const twoDaysAgo = addDate(today, -2);
  const fiveWeeksAgo = addDate(today, -35);
  const sevenWeeksAgo = addDate(today, -49);
  const tomorrow = addDate(today, 1);
  const dayAfterTomorrow = addDate(today, 2);
  const temporaryClosedDate = addDate(today, 9);
  const now = nowIso();

  const guardianIds = {
    g1: randomUUID(),
    g2: randomUUID(),
    g3: randomUUID(),
  };

  const petIds = {
    p1: randomUUID(),
    p2: randomUUID(),
    p3: randomUUID(),
    p4: randomUUID(),
  };

  const serviceIds = {
    full: randomUUID(),
    bath: randomUUID(),
    bathOnly: randomUUID(),
    care: randomUUID(),
  };

  const appointmentIds = {
    a1: randomUUID(),
    a2: randomUUID(),
    a3: randomUUID(),
    a4: randomUUID(),
    a5: randomUUID(),
    a6: randomUUID(),
    a7: randomUUID(),
    a8: randomUUID(),
    a9: randomUUID(),
    a10: randomUUID(),
    a11: randomUUID(),
    a12: randomUUID(),
    a13: randomUUID(),
    a14: randomUUID(),
  };

  await supabase.from("notifications").delete().eq("shop_id", shopId);
  await supabase.from("grooming_records").delete().eq("shop_id", shopId);
  await supabase.from("appointments").delete().eq("shop_id", shopId);
  await supabase.from("pets").delete().eq("shop_id", shopId);
  await supabase.from("guardians").delete().eq("shop_id", shopId);
  await supabase.from("services").delete().eq("shop_id", shopId);

  const fullShopUpdate = await supabase
    .from("shops")
    .update({
      name: shopName,
      address: shopAddress,
      description: "소형견 중심의 1인 미용샵 운영을 돕는 예약 관리 앱",
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
        shop_name: shopName,
        tagline: "차분하고 편안한 예약 경험을 준비했어요.",
        primary_color: "#1F6B5B",
        notices: [
          "첫 방문은 상담 포함으로 여유 있게 예약해 주세요.",
          "미용 시간은 아이 컨디션에 따라 조금 달라질 수 있어요.",
          "건물 뒤편 공용 주차장을 이용해 주세요.",
        ],
        operating_hours_note: "월-토 10:00 - 19:00, 일요일 휴무",
        holiday_notice: "매주 일요일 휴무, 임시 휴무는 달력에서 확인해 주세요.",
        parking_notice: "건물 뒤편 공용 주차장을 이용해 주세요.",
        booking_button_label: "예약하기",
        show_notices: true,
        show_parking_notice: true,
        show_services: true,
        show_kakao_inquiry: true,
      }),
      updated_at: now,
    })
    .eq("id", shopId);

  if (fullShopUpdate.error) {
    const fallbackUpdate = await supabase
      .from("shops")
      .update({
        name: shopName,
        address: shopAddress,
        description: "소형견 중심의 1인 미용샵 운영을 돕는 예약 관리 앱",
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
        approval_mode: "manual",
        updated_at: now,
      })
      .eq("id", shopId);

    if (fallbackUpdate.error) {
      throw new Error(fallbackUpdate.error.message);
    }
  }

  await supabase.from("services").insert([
    { id: serviceIds.full, shop_id: shopId, name: "전체 미용", price: 55000, duration_minutes: 120, is_active: true, created_at: now, updated_at: now },
    { id: serviceIds.bath, shop_id: shopId, name: "목욕 + 부분정리", price: 38000, duration_minutes: 80, is_active: true, created_at: now, updated_at: now },
    { id: serviceIds.bathOnly, shop_id: shopId, name: "목욕", price: 25000, duration_minutes: 45, is_active: true, created_at: now, updated_at: now },
    { id: serviceIds.care, shop_id: shopId, name: "위생 미용", price: 18000, duration_minutes: 30, is_active: true, created_at: now, updated_at: now },
  ]);

  await supabase.from("guardians").insert([
    { id: guardianIds.g1, shop_id: shopId, name: "김민지", phone: "010-1234-5678", memo: "문자 연락 선호", created_at: now, updated_at: now },
    { id: guardianIds.g2, shop_id: shopId, name: "박서준", phone: "010-9876-5432", memo: "오전 시간 선호", created_at: now, updated_at: now },
    { id: guardianIds.g3, shop_id: shopId, name: "이수현", phone: "010-5555-1234", memo: "예민한 편", created_at: now, updated_at: now },
  ]);

  await supabase.from("pets").insert([
    { id: petIds.p1, shop_id: shopId, guardian_id: guardianIds.g1, name: "몽이", breed: "말티즈", weight: 3.5, age: 3, notes: "귀 청소 민감", grooming_cycle_weeks: 4, avatar_seed: "M", created_at: now, updated_at: now },
    { id: petIds.p2, shop_id: shopId, guardian_id: guardianIds.g1, name: "차이", breed: "포메라니안", weight: 2.7, age: 2, notes: "첫미용 긴장 심함", grooming_cycle_weeks: 5, avatar_seed: "C", created_at: now, updated_at: now },
    { id: petIds.p3, shop_id: shopId, guardian_id: guardianIds.g2, name: "코코", breed: "푸들", weight: 5.1, age: 5, notes: "간식 주면 진정됨", grooming_cycle_weeks: 3, avatar_seed: "K", created_at: now, updated_at: now },
    { id: petIds.p4, shop_id: shopId, guardian_id: guardianIds.g3, name: "보리", breed: "시츄", weight: 4.2, age: 4, notes: "", grooming_cycle_weeks: 4, avatar_seed: "B", created_at: now, updated_at: now },
  ]);

  await supabase.from("appointments").insert([
    { id: appointmentIds.a1, shop_id: shopId, guardian_id: guardianIds.g1, pet_id: petIds.p1, service_id: serviceIds.full, appointment_date: yesterday, appointment_time: "09:00", status: "completed", memo: "스포팅 5mm", start_at: at(yesterday, "09:00"), end_at: at(yesterday, "11:00"), source: "owner", created_at: now, updated_at: now },
    { id: appointmentIds.a2, shop_id: shopId, guardian_id: guardianIds.g2, pet_id: petIds.p3, service_id: serviceIds.bath, appointment_date: today, appointment_time: "10:30", status: "almost_done", memo: "발바닥 정리 추가", start_at: at(today, "10:30"), end_at: at(today, "11:50"), source: "customer", created_at: now, updated_at: now },
    { id: appointmentIds.a3, shop_id: shopId, guardian_id: guardianIds.g3, pet_id: petIds.p4, service_id: serviceIds.bathOnly, appointment_date: today, appointment_time: "11:30", status: "cancelled", memo: "보호자 일정 변경", start_at: at(today, "11:30"), end_at: at(today, "12:15"), source: "customer", created_at: now, updated_at: now },
    { id: appointmentIds.a4, shop_id: shopId, guardian_id: guardianIds.g1, pet_id: petIds.p2, service_id: serviceIds.bathOnly, appointment_date: today, appointment_time: "13:00", status: "in_progress", memo: "얼굴 컷 정리", start_at: at(today, "13:00"), end_at: at(today, "13:45"), source: "customer", created_at: now, updated_at: now },
    { id: appointmentIds.a5, shop_id: shopId, guardian_id: guardianIds.g2, pet_id: petIds.p3, service_id: serviceIds.full, appointment_date: today, appointment_time: "15:00", status: "confirmed", memo: "다리 컷 유지", start_at: at(today, "15:00"), end_at: at(today, "17:00"), source: "customer", created_at: now, updated_at: now },
    { id: appointmentIds.a6, shop_id: shopId, guardian_id: guardianIds.g3, pet_id: petIds.p4, service_id: serviceIds.care, appointment_date: tomorrow, appointment_time: "17:00", status: "confirmed", memo: "", start_at: at(tomorrow, "17:00"), end_at: at(tomorrow, "17:30"), source: "owner", created_at: now, updated_at: now },
    { id: appointmentIds.a7, shop_id: shopId, guardian_id: guardianIds.g1, pet_id: petIds.p1, service_id: serviceIds.bath, appointment_date: dayAfterTomorrow, appointment_time: "11:00", status: "confirmed", memo: "짧게", start_at: at(dayAfterTomorrow, "11:00"), end_at: at(dayAfterTomorrow, "12:20"), source: "customer", created_at: now, updated_at: now },
    { id: appointmentIds.a8, shop_id: shopId, guardian_id: guardianIds.g1, pet_id: petIds.p2, service_id: serviceIds.bathOnly, appointment_date: today, appointment_time: "16:30", status: "pending", memo: "", start_at: at(today, "16:30"), end_at: at(today, "17:15"), source: "customer", created_at: now, updated_at: now },
    { id: appointmentIds.a9, shop_id: shopId, guardian_id: guardianIds.g2, pet_id: petIds.p3, service_id: serviceIds.bathOnly, appointment_date: twoDaysAgo, appointment_time: "09:30", status: "confirmed", memo: "", start_at: at(twoDaysAgo, "09:30"), end_at: at(twoDaysAgo, "10:15"), source: "customer", created_at: now, updated_at: now },
    { id: appointmentIds.a10, shop_id: shopId, guardian_id: guardianIds.g1, pet_id: petIds.p1, service_id: serviceIds.care, appointment_date: addDate(today, 3), appointment_time: "10:00", status: "confirmed", memo: "발톱 짧게", start_at: at(addDate(today, 3), "10:00"), end_at: at(addDate(today, 3), "10:30"), source: "customer", created_at: now, updated_at: now },
    { id: appointmentIds.a11, shop_id: shopId, guardian_id: guardianIds.g2, pet_id: petIds.p3, service_id: serviceIds.bath, appointment_date: addDate(today, 4), appointment_time: "14:00", status: "pending", memo: "미간 정리", start_at: at(addDate(today, 4), "14:00"), end_at: at(addDate(today, 4), "15:20"), source: "customer", created_at: now, updated_at: now },
    { id: appointmentIds.a12, shop_id: shopId, guardian_id: guardianIds.g3, pet_id: petIds.p4, service_id: serviceIds.full, appointment_date: addDate(today, 5), appointment_time: "12:30", status: "confirmed", memo: "짧은 스타일", start_at: at(addDate(today, 5), "12:30"), end_at: at(addDate(today, 5), "14:30"), source: "customer", created_at: now, updated_at: now },
    { id: appointmentIds.a13, shop_id: shopId, guardian_id: guardianIds.g1, pet_id: petIds.p2, service_id: serviceIds.bathOnly, appointment_date: addDate(today, 7), appointment_time: "15:30", status: "confirmed", memo: "", start_at: at(addDate(today, 7), "15:30"), end_at: at(addDate(today, 7), "16:15"), source: "owner", created_at: now, updated_at: now },
    { id: appointmentIds.a14, shop_id: shopId, guardian_id: guardianIds.g2, pet_id: petIds.p3, service_id: serviceIds.full, appointment_date: addDate(today, 12), appointment_time: "11:30", status: "confirmed", memo: "다리 볼륨 유지", start_at: at(addDate(today, 12), "11:30"), end_at: at(addDate(today, 12), "13:30"), source: "customer", created_at: now, updated_at: now },
  ]);

  await supabase.from("grooming_records").insert([
    { id: randomUUID(), shop_id: shopId, guardian_id: guardianIds.g1, pet_id: petIds.p1, service_id: serviceIds.full, appointment_id: appointmentIds.a1, style_notes: "스포팅 5mm", memo: "귀 주변은 부드럽게 정리", price_paid: 55000, groomed_at: at(yesterday, "11:00"), created_at: now, updated_at: now },
    { id: randomUUID(), shop_id: shopId, guardian_id: guardianIds.g2, pet_id: petIds.p3, service_id: serviceIds.full, appointment_id: null, style_notes: "테디베어 컷", memo: "발바닥 정리 필수", price_paid: 55000, groomed_at: at(fiveWeeksAgo, "14:00"), created_at: now, updated_at: now },
    { id: randomUUID(), shop_id: shopId, guardian_id: guardianIds.g3, pet_id: petIds.p4, service_id: serviceIds.full, appointment_id: null, style_notes: "짧은 얼굴 컷", memo: "눈 주위 정리", price_paid: 50000, groomed_at: at(sevenWeeksAgo, "12:00"), created_at: now, updated_at: now },
  ]);

  await supabase.from("notifications").insert([
    { id: randomUUID(), shop_id: shopId, appointment_id: appointmentIds.a5, pet_id: petIds.p3, guardian_id: guardianIds.g2, type: "booking_confirmed", channel: "mock", message: "코코 예약이 확정되었어요.", status: "mocked", sent_at: now, created_at: now },
    { id: randomUUID(), shop_id: shopId, appointment_id: null, pet_id: petIds.p1, guardian_id: guardianIds.g1, type: "revisit_notice", channel: "mock", message: "몽이 재방문 시기가 다가오고 있어요.", status: "mocked", sent_at: now, created_at: now },
  ]);
}
