import { normalizeCustomerPageSettings } from "@/lib/customer-page-settings";
import { normalizeGuardianNotificationSettings, normalizeShopNotificationSettings } from "@/lib/notification-settings";
import { DEVELOPMENT_DEMO_SHOP_ID, DEVELOPMENT_DEMO_SHOP_NAME } from "@/lib/development-demo";
import { addDate, currentDateInTimeZone, nowIso } from "@/lib/utils";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const customerFixtures = [
  ["10000000-0000-4000-8000-000000000001", "김다은", "두부", "말티즈", 3.8],
  ["10000000-0000-4000-8000-000000000002", "박서준", "콩이", "푸들", 4.6],
  ["10000000-0000-4000-8000-000000000003", "이하린", "보리", "비숑", 5.2],
  ["10000000-0000-4000-8000-000000000004", "최유진", "몽두", "포메라니안", 3.1],
  ["10000000-0000-4000-8000-000000000005", "정우진", "루루", "시츄", 5.7],
  ["10000000-0000-4000-8000-000000000006", "김서연", "몽이", "토이푸들", 3.4],
  ["10000000-0000-4000-8000-000000000007", "신예린", "코코", "스피츠", 6.1],
  ["10000000-0000-4000-8000-000000000008", "윤도현", "마루", "비글", 8.5],
  ["10000000-0000-4000-8000-000000000009", "서지은", "하루", "비숑", 4.9],
  ["10000000-0000-4000-8000-000000000010", "강민재", "별이", "말티푸", 4.2],
  ["10000000-0000-4000-8000-000000000011", "한수빈", "밤비", "푸들", 3.7],
  ["10000000-0000-4000-8000-000000000012", "배현우", "후추", "요크셔테리어", 2.9],
  ["10000000-0000-4000-8000-000000000013", "송지민", "모카", "닥스훈트", 6.8],
  ["10000000-0000-4000-8000-000000000014", "권하늘", "쿠키", "포메라니안", 3.5],
  ["10000000-0000-4000-8000-000000000015", "조예준", "라이", "푸들", 5.4],
  ["10000000-0000-4000-8000-000000000016", "문서연", "나비", "말티즈", 3.2],
  ["10000000-0000-4000-8000-000000000017", "장우석", "두리", "시바견", 8.2],
  ["10000000-0000-4000-8000-000000000018", "류채원", "바비", "비숑", 5.1],
  ["10000000-0000-4000-8000-000000000019", "고연우", "해피", "푸들", 4.4],
  ["10000000-0000-4000-8000-000000000020", "차은지", "쏘이", "말티즈", 3.6],
] as const;

const staffFixtures = [
  { id: "mongshop-staff-doyoon", name: "도윤", role: "디자이너", sortOrder: 1 },
  { id: "mongshop-staff-seoyeon", name: "서연", role: "디자이너", sortOrder: 2 },
  { id: "mongshop-staff-jihoon", name: "지훈", role: "대표 디자이너", sortOrder: 3 },
  { id: "mongshop-staff-harin", name: "하린", role: "디자이너", sortOrder: 4 },
] as const;

const serviceFixtures = [
  { id: "mongshop-service-full", name: "전체 미용", price: 80000, duration: 120, category: "미용" },
  { id: "mongshop-service-bath-care", name: "목욕 + 부분정리", price: 55000, duration: 90, category: "목욕" },
  { id: "mongshop-service-bath", name: "목욕", price: 35000, duration: 60, category: "목욕" },
  { id: "mongshop-service-hygiene", name: "위생 미용", price: 25000, duration: 45, category: "위생" },
  { id: "mongshop-service-partial", name: "부분 미용", price: 30000, duration: 45, category: "미용" },
  { id: "mongshop-service-spa", name: "스파/약욕 케어", price: 40000, duration: 60, category: "케어" },
] as const;

const dailyServiceSequence = [
  "mongshop-service-bath-care",
  "mongshop-service-hygiene",
  "mongshop-service-full",
  "mongshop-service-bath",
  "mongshop-service-full",
  "mongshop-service-partial",
] as const;

const serviceById = new Map(serviceFixtures.map((service) => [service.id, service]));

function at(date: string, totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${date}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00+09:00`;
}

function time(totalMinutes: number) {
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
}

function assertWrite(result: { error: { message: string } | null }, target: string) {
  if (result.error) throw new Error(`${target}: ${result.error.message}`);
}

export async function seedMongshopDevelopmentDemo() {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("개발 Supabase 관리자 연결을 찾을 수 없습니다.");

  const now = nowIso();
  const today = currentDateInTimeZone();
  const dates = Array.from({ length: 12 }, (_, index) => addDate(today, index - 2));
  const shopCheck = await supabase.from("shops").select("id").eq("id", DEVELOPMENT_DEMO_SHOP_ID).maybeSingle();
  assertWrite(shopCheck, "멍샵몽샵 조회");
  if (!shopCheck.data) throw new Error("개발 Supabase에 멍샵몽샵 매장이 없습니다.");

  assertWrite(await supabase.from("notifications").delete().eq("shop_id", DEVELOPMENT_DEMO_SHOP_ID), "기존 알림 정리");
  assertWrite(await supabase.from("grooming_records").delete().eq("shop_id", DEVELOPMENT_DEMO_SHOP_ID), "기존 미용 기록 정리");
  assertWrite(await supabase.from("appointments").delete().eq("shop_id", DEVELOPMENT_DEMO_SHOP_ID), "기존 예약 정리");
  assertWrite(await supabase.from("staff_schedule_overrides").delete().eq("shop_id", DEVELOPMENT_DEMO_SHOP_ID), "기존 근무 일정 정리");
  assertWrite(await supabase.from("staff_members").delete().eq("shop_id", DEVELOPMENT_DEMO_SHOP_ID), "기존 직원 정리");
  assertWrite(await supabase.from("services").delete().eq("shop_id", DEVELOPMENT_DEMO_SHOP_ID), "기존 서비스 정리");
  assertWrite(await supabase.from("pets").delete().eq("shop_id", DEVELOPMENT_DEMO_SHOP_ID), "기존 반려동물 정리");
  assertWrite(await supabase.from("guardians").delete().eq("shop_id", DEVELOPMENT_DEMO_SHOP_ID), "기존 고객 정리");

  assertWrite(
    await supabase
      .from("shops")
      .update({
        name: DEVELOPMENT_DEMO_SHOP_NAME,
        phone: "010-0000-0000",
        address: "서울시 강남구 멍샵로 1",
        description: "반려동물과 보호자의 시간을 함께 지키는 멍샵몽샵입니다.",
        business_hours: {
          0: { open: "09:00", close: "19:00", enabled: true },
          1: { open: "09:00", close: "19:00", enabled: true },
          2: { open: "09:00", close: "19:00", enabled: true },
          3: { open: "09:00", close: "19:00", enabled: true },
          4: { open: "09:00", close: "19:00", enabled: true },
          5: { open: "09:00", close: "19:00", enabled: true },
          6: { open: "09:00", close: "19:00", enabled: true },
        },
        regular_closed_days: [],
        temporary_closed_dates: [],
        concurrent_capacity: 1,
        booking_slot_interval_minutes: 15,
        booking_slot_offset_minutes: 0,
        approval_mode: "auto",
        notification_settings: normalizeShopNotificationSettings({ enabled: true, booking_confirmed_enabled: true }),
        customer_page_settings: normalizeCustomerPageSettings({
          shop_name: DEVELOPMENT_DEMO_SHOP_NAME,
          tagline: "아이에게 맞는 미용 시간을 편하게 예약하세요.",
          primary_color: "#ee7b70",
          booking_button_label: "간편예약 시작",
          show_notices: true,
          show_services: true,
        }),
        updated_at: now,
      })
      .eq("id", DEVELOPMENT_DEMO_SHOP_ID),
    "멍샵몽샵 정보 저장",
  );

  assertWrite(
    await supabase.from("guardians").insert(
      customerFixtures.map(([id, name], index) => ({
        id,
        shop_id: DEVELOPMENT_DEMO_SHOP_ID,
        name,
        phone: "010-0000-0000",
        memo: index % 3 === 0 ? "정기 방문 고객" : "",
        notification_settings: normalizeGuardianNotificationSettings({ enabled: true, revisit_enabled: true }),
        created_at: now,
        updated_at: now,
      })),
    ),
    "고객 20명 저장",
  );
  assertWrite(
    await supabase.from("pets").insert(
      customerFixtures.map(([guardianId, , name, breed, weight], index) => ({
        id: `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
        shop_id: DEVELOPMENT_DEMO_SHOP_ID,
        guardian_id: guardianId,
        name,
        breed,
        weight,
        age: 2 + (index % 7),
        pricing_group: index % 2 === 0 ? "베이직" : "플러스",
        notes: index % 4 === 0 ? "피부 상태를 천천히 확인해 주세요." : "",
        grooming_cycle_weeks: 4,
        avatar_seed: name.slice(0, 1),
        created_at: now,
        updated_at: now,
      })),
    ),
    "반려동물 20마리 저장",
  );
  assertWrite(
    await supabase.from("staff_members").insert(
      staffFixtures.map((staff) => ({
        id: staff.id,
        shop_id: DEVELOPMENT_DEMO_SHOP_ID,
        name: staff.name,
        display_name: staff.name,
        phone: "010-0000-0000",
        role: staff.role,
        position: staff.role,
        default_days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
        start_time: "09:00",
        end_time: "19:00",
        regular_off: "없음",
        annual_remain: 15,
        is_active: true,
        sort_order: staff.sortOrder,
        chip_color_index: staff.sortOrder - 1,
        created_at: now,
        updated_at: now,
      })),
    ),
    "직원 4명 저장",
  );
  assertWrite(
    await supabase.from("services").insert(
      serviceFixtures.map((service, index) => ({
        id: service.id,
        shop_id: DEVELOPMENT_DEMO_SHOP_ID,
        name: service.name,
        price: service.price,
        duration_minutes: service.duration,
        is_active: true,
        price_type: "starting",
        category: service.category,
        description: "",
        sort_order: index + 1,
        capacity_label: "동일 시간 1건",
        staff_selection_mode: "all",
        price_guide: {},
        created_at: now,
        updated_at: now,
      })),
    ),
    "서비스 저장",
  );

  const appointments = dates.flatMap((date, dateIndex) =>
    staffFixtures.flatMap((staff, staffIndex) => {
      let cursor = 9 * 60 + ((dateIndex * 7 + staffIndex * 3) % 3) * 15;
      return dailyServiceSequence.map((serviceId, slotIndex) => {
        const service = serviceById.get(serviceId);
        if (!service) throw new Error(`서비스를 찾을 수 없습니다: ${serviceId}`);
        const customerIndex = (dateIndex * 11 + staffIndex * 6 + slotIndex) % customerFixtures.length;
        const [guardianId] = customerFixtures[customerIndex];
        const petId = `20000000-0000-4000-8000-${String(customerIndex + 1).padStart(12, "0")}`;
        const start = cursor;
        cursor += service.duration + (slotIndex % 2 === 0 ? 15 : 0);
        return {
          shop_id: DEVELOPMENT_DEMO_SHOP_ID,
          guardian_id: guardianId,
          pet_id: petId,
          service_id: service.id,
          staff_id: staff.id,
          appointment_date: date,
          appointment_time: time(start),
          status: date < today ? "completed" : "confirmed",
          memo: ["얼굴 라인 정리", "피부 상태 확인", "발바닥 털 정리", "다음 방문 4주 권장"][slotIndex % 4],
          start_at: at(date, start),
          end_at: at(date, start + service.duration),
          source: "customer",
          customer_visit_type: customerIndex % 3 === 0 ? "first_visit" : "revisit",
          original_service_price: service.price,
          discount_amount: 0,
          final_service_price: service.price,
          created_at: now,
          updated_at: now,
        };
      });
    }),
  );
  assertWrite(await supabase.from("appointments").insert(appointments), "고밀도 예약 저장");

  const completedAppointments = appointments.filter((appointment) => appointment.status === "completed").slice(0, 20);
  assertWrite(
    await supabase.from("grooming_records").insert(
      completedAppointments.map((appointment) => ({
        shop_id: DEVELOPMENT_DEMO_SHOP_ID,
        guardian_id: appointment.guardian_id,
        pet_id: appointment.pet_id,
        service_id: appointment.service_id,
        appointment_id: null,
        staff_id: appointment.staff_id,
        style_notes: appointment.memo,
        memo: "다음 방문 시 참고",
        price_paid: appointment.final_service_price,
        groomed_at: appointment.end_at,
        created_at: now,
        updated_at: now,
      })),
    ),
    "미용 기록 저장",
  );

  return {
    shopId: DEVELOPMENT_DEMO_SHOP_ID,
    guardians: customerFixtures.length,
    staffMembers: staffFixtures.length,
    appointments: appointments.length,
    dates: dates.length,
  };
}
