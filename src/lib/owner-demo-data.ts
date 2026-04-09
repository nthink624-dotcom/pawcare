import { currentDateInTimeZone, addDate } from "@/lib/utils";
import { buildDemoBootstrap } from "@/lib/mock-data";
import { normalizeCustomerPageSettings } from "@/lib/customer-page-settings";
import { normalizeBootstrapNotifications } from "@/lib/notification-settings";
import type { Appointment, BootstrapPayload, GroomingRecord } from "@/types/domain";

function at(date: string, time: string) {
  return `${date}T${time}:00.000Z`;
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
): Appointment {
  const durationByService: Record<string, number> = {
    "svc-full": 120,
    "svc-bath": 80,
    "svc-bath-only": 45,
    "svc-care": 30,
  };
  const durationMinutes = durationByService[serviceId] ?? 60;
  const [hour, minute] = time.split(":").map(Number);
  const endDate = new Date(`${date}T${time}:00`);
  endDate.setMinutes(endDate.getMinutes() + durationMinutes);
  const endDatePart = endDate.toISOString().slice(0, 10);
  const endTimePart = endDate.toTimeString().slice(0, 8);

  return {
    id,
    shop_id: "owner-demo",
    guardian_id: guardianId,
    pet_id: petId,
    service_id: serviceId,
    appointment_date: date,
    appointment_time: time,
    status,
    memo,
    rejection_reason: null,
    start_at: at(date, `${time}:00`.slice(0, 5)),
    end_at: `${endDatePart}T${endTimePart}.000Z`,
    source: "customer",
    created_at: at(date, "08:00"),
    updated_at: at(date, "08:00"),
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
    shop_id: "owner-demo",
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

export function buildOwnerDemoBootstrap(): BootstrapPayload {
  const base = normalizeBootstrapNotifications(buildDemoBootstrap());
  const today = currentDateInTimeZone();
  const dates = Array.from({ length: 8 }, (_, index) => addDate(today, index));

  const [g1, g2, g3] = base.guardians;
  const [p1, p2, p3, p4] = base.pets;

  const appointments: Appointment[] = [
    makeAppointment("demo-a-1", dates[0], "09:00", "pending", g1.id, p1.id, "svc-full", "첫 방문 상담 포함"),
    makeAppointment("demo-a-2", dates[0], "10:00", "pending", g2.id, p3.id, "svc-bath", "피부가 예민해요"),
    makeAppointment("demo-a-3", dates[0], "11:00", "confirmed", g1.id, p2.id, "svc-bath-only", "짧게 정리"),
    makeAppointment("demo-a-4", dates[0], "13:00", "in_progress", g3.id, p4.id, "svc-full", "얼굴 라인 정리"),
    makeAppointment("demo-a-5", dates[0], "15:00", "almost_done", g2.id, p3.id, "svc-care", "발 관리 추가"),
    makeAppointment("demo-a-6", dates[0], "16:30", "completed", g1.id, p1.id, "svc-bath", "기본 목욕 완료"),
    makeAppointment("demo-a-7", dates[0], "17:30", "cancelled", g3.id, p4.id, "svc-bath-only", "보호자 일정 변경"),

    makeAppointment("demo-a-8", dates[1], "09:30", "confirmed", g1.id, p2.id, "svc-full", "스포팅 5mm"),
    makeAppointment("demo-a-9", dates[1], "11:00", "pending", g2.id, p3.id, "svc-bath", "강아지 긴장 많음"),
    makeAppointment("demo-a-10", dates[1], "13:00", "confirmed", g3.id, p4.id, "svc-bath-only"),
    makeAppointment("demo-a-11", dates[1], "15:00", "confirmed", g1.id, p1.id, "svc-care"),
    makeAppointment("demo-a-12", dates[1], "17:00", "cancelled", g2.id, p3.id, "svc-full", "시간 변경 요청"),

    makeAppointment("demo-a-13", dates[2], "09:00", "confirmed", g1.id, p1.id, "svc-bath"),
    makeAppointment("demo-a-14", dates[2], "10:30", "confirmed", g2.id, p3.id, "svc-full"),
    makeAppointment("demo-a-15", dates[2], "12:00", "pending", g3.id, p4.id, "svc-bath-only"),
    makeAppointment("demo-a-16", dates[2], "14:00", "confirmed", g1.id, p2.id, "svc-care"),
    makeAppointment("demo-a-17", dates[2], "16:00", "confirmed", g2.id, p3.id, "svc-bath"),

    makeAppointment("demo-a-18", dates[3], "09:00", "confirmed", g1.id, p1.id, "svc-full"),
    makeAppointment("demo-a-19", dates[3], "10:30", "pending", g2.id, p3.id, "svc-bath"),
    makeAppointment("demo-a-20", dates[3], "12:00", "confirmed", g3.id, p4.id, "svc-bath-only"),
    makeAppointment("demo-a-21", dates[3], "14:00", "confirmed", g1.id, p2.id, "svc-care"),
    makeAppointment("demo-a-22", dates[3], "16:00", "confirmed", g2.id, p3.id, "svc-full"),

    makeAppointment("demo-a-23", dates[4], "09:00", "confirmed", g1.id, p1.id, "svc-full"),
    makeAppointment("demo-a-24", dates[4], "10:30", "confirmed", g2.id, p3.id, "svc-bath"),
    makeAppointment("demo-a-25", dates[4], "12:00", "pending", g3.id, p4.id, "svc-bath-only"),
    makeAppointment("demo-a-26", dates[4], "14:00", "confirmed", g1.id, p2.id, "svc-care"),
    makeAppointment("demo-a-27", dates[4], "16:00", "cancelled", g2.id, p3.id, "svc-full"),

    makeAppointment("demo-a-28", dates[5], "09:00", "confirmed", g1.id, p1.id, "svc-bath"),
    makeAppointment("demo-a-29", dates[5], "10:30", "confirmed", g2.id, p3.id, "svc-full"),
    makeAppointment("demo-a-30", dates[5], "12:00", "pending", g3.id, p4.id, "svc-bath-only"),
    makeAppointment("demo-a-31", dates[5], "14:00", "confirmed", g1.id, p2.id, "svc-care"),
    makeAppointment("demo-a-32", dates[5], "16:00", "confirmed", g2.id, p3.id, "svc-bath"),

    makeAppointment("demo-a-33", dates[6], "09:00", "confirmed", g1.id, p1.id, "svc-full"),
    makeAppointment("demo-a-34", dates[6], "10:30", "pending", g2.id, p3.id, "svc-bath"),
    makeAppointment("demo-a-35", dates[6], "12:00", "confirmed", g3.id, p4.id, "svc-bath-only"),
    makeAppointment("demo-a-36", dates[6], "14:00", "confirmed", g1.id, p2.id, "svc-care"),
    makeAppointment("demo-a-37", dates[6], "16:00", "confirmed", g2.id, p3.id, "svc-full"),

    makeAppointment("demo-a-38", addDate(today, -1), "09:00", "completed", g1.id, p1.id, "svc-full", "스포팅 5mm"),
    makeAppointment("demo-a-39", addDate(today, -1), "11:00", "completed", g2.id, p3.id, "svc-bath", "약욕 포함"),
    makeAppointment("demo-a-40", addDate(today, -1), "14:00", "completed", g1.id, p2.id, "svc-bath-only"),
    makeAppointment("demo-a-41", addDate(today, -2), "10:00", "completed", g3.id, p4.id, "svc-full"),
    makeAppointment("demo-a-42", addDate(today, -2), "15:00", "completed", g1.id, p1.id, "svc-care"),
  ];

  const records: GroomingRecord[] = [
    makeRecord("demo-r-1", "demo-a-6", dates[0], "17:20", g1.id, p1.id, "svc-bath", "발끝 라운드 정리", "다음엔 귀 길이 유지", 38000),
    makeRecord("demo-r-2", "demo-a-38", addDate(today, -1), "11:10", g1.id, p1.id, "svc-full", "몸통 5mm", "보호자 만족도 높음", 55000),
    makeRecord("demo-r-3", "demo-a-39", addDate(today, -1), "12:20", g2.id, p3.id, "svc-bath", "약욕 포함", "피부 붉음 체크", 38000),
    makeRecord("demo-r-4", "demo-a-40", addDate(today, -1), "14:50", g1.id, p2.id, "svc-bath-only", "짧은 얼굴 라인", "다음 방문 4주 권장", 25000),
    makeRecord("demo-r-5", "demo-a-41", addDate(today, -2), "12:10", g3.id, p4.id, "svc-full", "전체 미용", "낯가림 있어 천천히 진행", 55000),
    makeRecord("demo-r-6", "demo-a-42", addDate(today, -2), "15:40", g1.id, p1.id, "svc-care", "발 관리", "재방문 알림 필요", 18000),
  ];

  return normalizeBootstrapNotifications({
    ...base,
    shop: {
      ...base.shop,
      id: "owner-demo",
      name: "멍매니저 데모 매장",
      description: "오너 설득 페이지에서 보여주는 체험용 데모 매장입니다.",
      customer_page_settings: normalizeCustomerPageSettings(
        {
          ...base.shop.customer_page_settings,
          shop_name: "포근한 발바닥 미용실",
          tagline: "첫 방문부터 재방문까지 한 번에 이어지는 모바일 예약",
          notices: [
            "첫 방문은 상담 포함으로 여유 있게 예약해 주세요.",
            "미용 시간은 아이 컨디션에 따라 조금 달라질 수 있어요.",
            "주차는 건물 뒤편 공용 주차장을 이용해 주세요.",
          ],
        },
        "포근한 발바닥 미용실",
        "첫 방문부터 재방문까지 한 번에 이어지는 모바일 예약",
      ),
    },
    guardians: base.guardians.map((guardian) => ({ ...guardian, shop_id: "owner-demo" })),
    pets: base.pets.map((pet) => ({ ...pet, shop_id: "owner-demo" })),
    services: base.services.map((service) => ({ ...service, shop_id: "owner-demo" })),
    appointments,
    groomingRecords: records,
  });
}
