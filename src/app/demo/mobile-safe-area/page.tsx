"use client";

import { BatteryFull, ChevronLeft, Signal, Wifi } from "lucide-react";
import { useMemo, useState } from "react";

import CustomerFirstVisitFlow from "@/components/customer/customer-first-visit-claude-flow";
import type { CustomerServiceSourceOption } from "@/lib/customer-service-options";
import type { BootstrapStaffMember, Service, Shop } from "@/types/domain";

type FirstVisitStep = 1 | 2 | 3 | 4;

const previewShop = {
  id: "preview-shop",
  name: "로즈코랄 펫살롱",
  phone: "010-0000-0000",
  address: "서울시 강남구",
  description: "따뜻한 로즈코랄 예약 페이지",
  business_hours: {},
  regular_closed_days: [],
  temporary_closed_dates: [],
  concurrent_capacity: 2,
  booking_slot_interval_minutes: 15,
  booking_slot_offset_minutes: 0,
  booking_available_start_time: "10:00",
  booking_available_end_time: "18:00",
  approval_mode: "manual",
  notification_settings: {
    enabled: true,
    revisit_enabled: true,
    booking_confirmed_enabled: true,
    booking_rejected_enabled: true,
    booking_cancelled_enabled: true,
    booking_rescheduled_enabled: true,
    appointment_reminder_10m_enabled: true,
    appointment_reminder_10m_mode: "manual",
    visit_reminder_offset_minutes: 10,
    grooming_started_enabled: true,
    grooming_almost_done_enabled: true,
    pickup_ready_eta_minutes: 5,
    grooming_completed_enabled: true,
    grooming_start_without_photo_enabled: false,
    grooming_complete_without_photo_enabled: false,
  },
  customer_page_settings: {
    hero_image_url: "",
    hero_image_urls: [],
    customer_service_overrides: {},
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
} as unknown as Shop;

const previewServices = [
  {
    id: "service-bath",
    shop_id: previewShop.id,
    name: "목욕 + 부분정리",
    price: 38000,
    price_type: "starting",
    duration_minutes: 80,
    is_active: true,
    created_at: previewShop.created_at,
    updated_at: previewShop.updated_at,
  },
  {
    id: "service-full",
    shop_id: previewShop.id,
    name: "전체 미용",
    price: 65000,
    price_type: "starting",
    duration_minutes: 120,
    is_active: true,
    created_at: previewShop.created_at,
    updated_at: previewShop.updated_at,
  },
] as Service[];

const previewServiceOptions = [
  {
    id: "option-bath",
    serviceId: "service-bath",
    name: "목욕 + 부분정리",
    sourceName: "목욕 + 부분정리",
    category: "grooming",
    description: "목욕, 발바닥, 위생 정리",
    durationMinutes: 80,
    price: 38000,
    priceType: "starting",
    order: 1,
  },
  {
    id: "option-full",
    serviceId: "service-full",
    name: "전체 미용",
    sourceName: "전체 미용",
    category: "grooming",
    description: "전체 클리핑 또는 스타일 미용",
    durationMinutes: 120,
    price: 65000,
    priceType: "starting",
    order: 2,
  },
] as CustomerServiceSourceOption[];

const previewStaffMembers = [
  {
    id: "staff-1",
    name: "정우진",
    displayName: "정우진",
    phone: "",
    role: "디자이너",
    defaultDays: ["mon", "tue", "wed", "thu", "fri"],
    startTime: "10:00",
    endTime: "18:00",
    regularOff: "일",
    annualRemain: 0,
    todayBookings: 0,
    weekBookings: 0,
  },
] as BootstrapStaffMember[];

const previewDateOptions = [
  { value: "2026-06-19", label: "오늘", weekday: "금" },
  { value: "2026-06-20", label: "내일", weekday: "토" },
  { value: "2026-06-21", label: "일", weekday: "일" },
  { value: "2026-06-22", label: "월", weekday: "월" },
  { value: "2026-06-23", label: "화", weekday: "화" },
  { value: "2026-06-24", label: "수", weekday: "수" },
  { value: "2026-06-25", label: "목", weekday: "목" },
];

function DeviceStatusBar() {
  return (
    <div className="flex h-11 items-center justify-between bg-[#fdf7f5] px-6 text-[#3a2e2a]">
      <span className="text-[15px] font-semibold leading-none">9:41</span>
      <div className="flex items-center gap-1.5">
        <Signal className="h-4 w-4" strokeWidth={2.2} />
        <Wifi className="h-4 w-4" strokeWidth={2.2} />
        <BatteryFull className="h-[18px] w-[18px]" strokeWidth={2.2} />
      </div>
    </div>
  );
}

function DeviceNavigationBar() {
  return (
    <div className="grid h-[54px] grid-cols-3 items-center border-t border-[#efe2dc] bg-[#fdf7f5] px-4 text-[11px] font-medium text-[#8a7a72]">
      <div className="flex flex-col items-center gap-1">
        <ChevronLeft className="h-5 w-5" strokeWidth={2.2} />
        <span>이전</span>
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="h-5 w-5 rounded-full border-2 border-[#8a7a72]" />
        <span>홈</span>
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="h-5 w-5 rounded-[5px] border-2 border-[#8a7a72]" />
        <span>최근</span>
      </div>
    </div>
  );
}

export default function MobileSafeAreaPreviewPage() {
  const [step, setStep] = useState<FirstVisitStep>(1);
  const [firstVisit, setFirstVisit] = useState({
    ownerName: "정우진",
    phone: "010-8498-2077",
    petName: "우유",
    breed: "포메라니안",
    date: "2026-06-19",
    timeSlot: "14:00",
    staffId: "staff-1",
    serviceId: "service-bath",
    customerServiceOptionId: "option-bath",
    customServiceName: "",
    note: "",
  });

  const selectedService = useMemo(
    () => previewServices.find((service) => service.id === firstVisit.serviceId),
    [firstVisit.serviceId],
  );
  const selectedServiceOption = useMemo(
    () => previewServiceOptions.find((option) => option.id === firstVisit.customerServiceOptionId),
    [firstVisit.customerServiceOptionId],
  );

  return (
    <main className="min-h-screen bg-[#eee7e2] px-4 py-6">
      <div className="mx-auto w-full max-w-[430px]">
        <div className="overflow-hidden rounded-[34px] border border-[#ead8d2] bg-[#fdf7f5] shadow-[0_22px_70px_rgba(58,46,42,0.16)]">
          <DeviceStatusBar />
          <div className="pm-customer-safe-area-preview">
            <CustomerFirstVisitFlow
              shop={previewShop}
              customerServiceOptions={previewServiceOptions}
              dateOptions={previewDateOptions}
              staffMembers={previewStaffMembers}
              firstVisit={firstVisit}
              savedPets={[]}
              step={step}
              selectedService={selectedService}
              selectedServiceOption={selectedServiceOption}
              availableSlots={["10:00", "10:15", "11:30", "14:00", "14:15", "15:00"]}
              recommendedSlots={["14:00", "14:15"]}
              loadingSlots={false}
              submitting={false}
              completedBooking={null}
              onBackToEntry={() => setStep(1)}
              onStepBack={() => setStep((current) => Math.max(1, current - 1) as FirstVisitStep)}
              onNext={() => setStep((current) => Math.min(4, current + 1) as FirstVisitStep)}
              onSubmit={async () => setStep(4)}
              onOpenShopInfo={() => undefined}
              onServiceSelect={(serviceOptionId) => {
                const option = previewServiceOptions.find((item) => item.id === serviceOptionId);
                setFirstVisit((current) => ({
                  ...current,
                  serviceId: option?.serviceId ?? "",
                  customerServiceOptionId: option?.id ?? "",
                  timeSlot: "",
                }));
              }}
              onStaffSelect={(staffId) => setFirstVisit((current) => ({ ...current, staffId }))}
              onDateSelect={(date) => setFirstVisit((current) => ({ ...current, date, timeSlot: "" }))}
              onTimeSelect={(timeSlot) => setFirstVisit((current) => ({ ...current, timeSlot }))}
              onOwnerNameChange={(ownerName) => setFirstVisit((current) => ({ ...current, ownerName }))}
              onPhoneChange={(phone) => setFirstVisit((current) => ({ ...current, phone }))}
              onPetNameChange={(petName) => setFirstVisit((current) => ({ ...current, petName }))}
              onBreedChange={(breed) => setFirstVisit((current) => ({ ...current, breed }))}
              onNoteChange={(note) => setFirstVisit((current) => ({ ...current, note }))}
              onGoManage={() => setStep(1)}
            />
          </div>
          <DeviceNavigationBar />
        </div>

        <div className="mt-4 rounded-[16px] border border-[#ead8d2] bg-white px-4 py-3 text-[13px] leading-5 text-[#7d6e66]">
          <p className="font-semibold text-[#3a2e2a]">로즈코랄 고객 예약페이지 안전영역 미리보기</p>
          <p className="mt-1">위아래 시스템 영역은 OS가 표시하고, 예약 화면은 그 안쪽에 배치됩니다.</p>
        </div>
      </div>
    </main>
  );
}
