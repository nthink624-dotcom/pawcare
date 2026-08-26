/* Seeds only the isolated public demonstration shop. Run manually with the production env file. */
const { createClient } = require("@supabase/supabase-js");

const shopId = "petmanager-demo-salon";
const now = new Date().toISOString();
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
const dateAt = (offset) => {
  const date = new Date(`${today}T00:00:00+09:00`);
  date.setDate(date.getDate() + offset);
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
};
const at = (date, time) => `${date}T${time}:00+09:00`;
const fail = (result, name) => { if (result.error) throw new Error(`${name}: ${result.error.message}`); };
const env = process.env;
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Production Supabase environment is required.");

const staff = [
  ["petmanager-demo-staff-doyoon", "도윤", "디자이너", 0],
  ["petmanager-demo-staff-seoyeon", "서연", "디자이너", 1],
  ["petmanager-demo-staff-jihoon", "지훈", "대표 디자이너", 2],
  ["petmanager-demo-staff-harin", "하린", "디자이너", 3],
];
const services = [
  ["petmanager-demo-service-full", "전체 미용", 80000, 120],
  ["petmanager-demo-service-bath-care", "목욕 + 부분정리", 55000, 90],
  ["petmanager-demo-service-bath", "목욕", 35000, 60],
  ["petmanager-demo-service-hygiene", "위생 미용", 25000, 45],
  ["petmanager-demo-service-partial", "부분 미용", 30000, 45],
];
const customers = [["김다은", "두부", "말티즈", 3.8], ["박서준", "콩이", "푸들", 4.6], ["이하린", "보리", "비숑", 5.2], ["최유진", "몽두", "포메라니안", 3.1], ["정우진", "루루", "시츄", 5.7], ["김서연", "몽이", "토이푸들", 3.4], ["신예린", "코코", "스피츠", 6.1], ["윤도현", "마루", "비글", 8.5]];

(async () => {
  fail(await supabase.from("shops").upsert({ id: shopId, name: "펫매니저 데모 살롱", phone: "010-0000-0000", address: "서울시 강남구 데모로 1", description: "펫매니저 기능을 직접 체험할 수 있는 전용 데모 매장입니다.", business_hours: Object.fromEntries(Array.from({ length: 7 }, (_, day) => [day, { open: "09:00", close: "19:00", enabled: true }])), regular_closed_days: [], temporary_closed_dates: [], concurrent_capacity: 1, approval_mode: "auto", booking_slot_interval_minutes: 15, booking_slot_offset_minutes: 0, booking_available_start_time: "09:00", booking_available_end_time: "18:00", notification_settings: { enabled: false }, updated_at: now }), "데모 매장 저장");
  for (const table of ["grooming_records", "appointments", "staff_schedule_overrides", "services", "pets", "guardians", "staff_members"]) fail(await supabase.from(table).delete().eq("shop_id", shopId), `기존 ${table} 정리`);
  fail(await supabase.from("staff_members").insert(staff.map(([id, name, role, color], index) => ({ id, shop_id: shopId, name, display_name: name, phone: "010-0000-0000", role, position: role, default_days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"], start_time: "09:00", end_time: "19:00", regular_off: "없음", annual_remain: 15, is_active: true, sort_order: index + 1, chip_color_index: color, created_at: now, updated_at: now }))), "데모 직원 저장");
  fail(await supabase.from("services").insert(services.map(([id, name, price, duration], index) => ({ id, shop_id: shopId, name, price, duration_minutes: duration, is_active: true, price_type: "starting", category: "미용", description: "", sort_order: index + 1, capacity_label: "동일 시간 1건", staff_selection_mode: "all", price_guide: {}, created_at: now, updated_at: now }))), "데모 서비스 저장");
  const guardianRows = customers.map(([name], index) => ({ id: `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, shop_id: shopId, name, phone: "010-0000-0000", memo: index % 2 ? "정기 방문 고객" : "", notification_settings: { enabled: false }, created_at: now, updated_at: now }));
  const petRows = customers.map(([, name, breed, weight], index) => ({ id: `30000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, shop_id: shopId, guardian_id: guardianRows[index].id, name, breed, weight, age: 2 + (index % 5), pricing_group: "베이직", notes: "", grooming_cycle_weeks: 4, avatar_seed: name.slice(0, 1), created_at: now, updated_at: now }));
  fail(await supabase.from("guardians").insert(guardianRows), "데모 고객 저장"); fail(await supabase.from("pets").insert(petRows), "데모 반려동물 저장");
  const appointmentRows = Array.from({ length: 10 }, (_, day) => staff.flatMap(([staffId], staffIndex) => [0, 1, 2].map((slot) => { const customerIndex = (day * 3 + staffIndex * 2 + slot) % customers.length; const service = services[(staffIndex + slot) % services.length]; const startHour = 10 + slot * 3; const date = dateAt(day - 2); return { shop_id: shopId, guardian_id: guardianRows[customerIndex].id, pet_id: petRows[customerIndex].id, service_id: service[0], staff_id: staffId, appointment_date: date, appointment_time: `${String(startHour).padStart(2, "0")}:00`, status: day < 2 ? "completed" : "confirmed", memo: slot === 0 ? "피부 상태를 천천히 확인해 주세요." : "", start_at: at(date, `${String(startHour).padStart(2, "0")}:00`), end_at: at(date, `${String(startHour + 1).padStart(2, "0")}:30`), source: "customer", customer_visit_type: customerIndex % 2 ? "revisit" : "first_visit", original_service_price: service[2], discount_amount: 0, final_service_price: service[2], created_at: now, updated_at: now }; }))).flat();
  const appointmentResult = await supabase.from("appointments").insert(appointmentRows).select("id,guardian_id,pet_id,service_id,staff_id,end_at,final_service_price");
  fail(appointmentResult, "데모 예약 저장");
  const completedAppointments = (appointmentResult.data ?? []).slice(0, 24);
  fail(await supabase.from("grooming_records").insert(completedAppointments.map((appointment, index) => ({
    shop_id: shopId,
    guardian_id: appointment.guardian_id,
    pet_id: appointment.pet_id,
    service_id: appointment.service_id,
    appointment_id: appointment.id,
    staff_id: appointment.staff_id,
    style_notes: "전체미용 · 몸 6mm · 얼굴 둥글게 · 눈가 세정 · 저자극 샴푸",
    memo: "눈가와 발바닥을 자극 없이 정리했고, 다음 방문 때 귀 뒤쪽 엉킴 상태를 확인해 주세요.",
    price_paid: appointment.final_service_price,
    groomed_at: appointment.end_at,
    actual_duration_minutes: 90,
    next_recommended_visit_date: dateAt(35 + index),
    care_report_photo_consent: true,
    care_report_owner_confirmed_at: now,
    care_report_data: {
      oneLineSummary: "오늘 미용은 아이가 편안하게 받을 수 있도록 천천히 진행했고, 눈가와 발 주변도 꼼꼼히 정리했어요.",
      treatmentSummary: "전체미용 · 몸 6mm · 얼굴 둥글게 · 눈가 세정 · 저자극 샴푸",
      conditionSummary: "눈가가 젖었을 때 부드러운 거즈로 톡톡 닦아 주세요.",
      groomingResponse: "발 주변은 예민한 반응이 있어 천천히 나누어 진행했어요.",
      homeCareTips: ["눈가가 젖었을 때 부드러운 거즈로 톡톡 닦아 주세요.", "귀 뒤쪽은 주 2~3회 빗질해 주세요."],
      nextVisitGuide: "지금의 길이와 얼굴 라인을 편하게 유지하려면 약 5주 뒤 관리를 권장드려요.",
    },
    created_at: now,
    updated_at: now,
  }))), "데모 케어리포트 저장");
  console.log(JSON.stringify({ shopId, staff: staff.length, customers: customers.length, appointments: appointmentRows.length, careReports: completedAppointments.length }));
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
