"use client";

import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";

import CustomerFirstVisitFlow from "@/components/customer/customer-first-visit-flow";
import CustomerShopFrontPanel from "@/components/customer/customer-shop-front-panel";
import { getDotIndicatorClass } from "@/components/owner-web/status-indicators";
import {
  applyCustomerServiceOverrides,
  buildCustomerServiceSourceOptions,
} from "@/lib/customer-service-options";
import type { BootstrapStaffMember, Service, Shop } from "@/types/domain";

type FirstVisitStep = 1 | 2 | 3 | 4;

const defaultHeroImages = ["/images/customer-booking-hero-original.jpg"];
const previewSlots = ["10:00", "10:15", "10:30", "11:00", "14:00", "14:15", "14:30", "15:00"];

function resolveHeroImages(primaryUrl: string, urls: string[]) {
  const images = [primaryUrl, ...urls].map((url) => url.trim()).filter(Boolean);
  return images.length > 0 ? images : defaultHeroImages;
}

function formatDateKey(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function buildPreviewDateOptions() {
  const todayKey = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const start = new Date(`${todayKey}T00:00:00`);
  const weekdayFormatter = new Intl.DateTimeFormat("ko-KR", { weekday: "short" });

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      value: formatDateKey(date),
      label: index === 0 ? "오늘" : index === 1 ? "내일" : weekdayFormatter.format(date),
      weekday: weekdayFormatter.format(date),
    };
  });
}

function createEmptyFirstVisit() {
  return {
    ownerName: "",
    phone: "",
    petName: "",
    breed: "",
    date: "",
    timeSlot: "",
    staffId: "",
    serviceId: "",
    customerServiceOptionId: "",
    customServiceName: "",
    note: "",
  };
}

export default function CustomerFirstVisitPreview({
  shop,
  services,
  staffMembers = [],
}: {
  shop: Shop;
  services: Service[];
  staffMembers?: BootstrapStaffMember[];
}) {
  const [mode, setMode] = useState<"front" | "booking">("front");
  const [step, setStep] = useState<FirstVisitStep>(1);
  const [firstVisit, setFirstVisit] = useState(createEmptyFirstVisit);

  const settings = shop.customer_page_settings;
  const heroImages = resolveHeroImages(settings.hero_image_url, settings.hero_image_urls ?? []);
  const heroImage = heroImages[0] ?? defaultHeroImages[0];
  const activeServices = useMemo(() => services.filter((service) => service.is_active), [services]);
  const customerServiceOptions = useMemo(
    () =>
      applyCustomerServiceOverrides(
        buildCustomerServiceSourceOptions(activeServices, { priceGuideOnly: true }),
        shop.customer_page_settings.customer_service_overrides,
      ),
    [activeServices, shop.customer_page_settings.customer_service_overrides],
  );
  const dateOptions = useMemo(() => buildPreviewDateOptions(), []);
  const selectedServiceOption =
    customerServiceOptions.find((option) => option.id === firstVisit.customerServiceOptionId) ??
    customerServiceOptions.find((option) => option.serviceId === firstVisit.serviceId);
  const selectedService = services.find((service) => service.id === firstVisit.serviceId);

  if (mode === "booking") {
    return (
      <CustomerFirstVisitFlow
        shop={shop}
        customerServiceOptions={customerServiceOptions}
        dateOptions={dateOptions}
        staffMembers={staffMembers}
        firstVisit={firstVisit}
        step={step}
        selectedService={selectedService}
        selectedServiceOption={selectedServiceOption}
        availableSlots={step === 3 ? previewSlots : []}
        recommendedSlots={["14:00", "14:15"]}
        loadingSlots={false}
        submitting={false}
        completedBooking={null}
        onBackToEntry={() => {
          setMode("front");
          setStep(1);
          setFirstVisit(createEmptyFirstVisit());
        }}
        onStepBack={() => {
          if (step <= 1) {
            setMode("front");
            return;
          }
          setStep((current) => Math.max(1, current - 1) as FirstVisitStep);
        }}
        onNext={() => setStep((current) => Math.min(4, current + 1) as FirstVisitStep)}
        onSubmit={async () => setStep(4)}
        onOpenShopInfo={() => undefined}
        onServiceSelect={(serviceOptionId) => {
          const option = customerServiceOptions.find((item) => item.id === serviceOptionId);
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
        onGoManage={() => {
          setMode("front");
          setStep(1);
          setFirstVisit(createEmptyFirstVisit());
        }}
      />
    );
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-[430px] bg-white px-3 pb-6 pt-3">
      <section className="overflow-hidden rounded-[12px] border border-[#e5e7eb] bg-white shadow-[0_8px_18px_rgba(15,23,42,0.06)]">
        <div
          className="relative aspect-[16/9] overflow-hidden bg-[#efe7dd] text-white"
          style={{
            backgroundImage: `linear-gradient(180deg, rgba(42, 30, 20, 0.04), rgba(31, 24, 18, 0.36)), url(${heroImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <span className="sr-only">{shop.name}</span>
          <div aria-hidden="true" className="absolute bottom-3 left-1/2 h-1.5 w-12 -translate-x-1/2 rounded-full bg-white/85 shadow-[0_1px_6px_rgba(0,0,0,0.18)]" />
        </div>
      </section>

      <section className="mt-2 rounded-[12px] border border-[#e5e7eb] bg-white p-3 shadow-[0_8px_18px_rgba(15,23,42,0.06)]">
        <div className="flex min-w-0 items-center justify-between gap-3 px-0.5 pb-2">
          <h2 className="truncate text-[21px] font-semibold tracking-[-0.04em] text-[#2b241f]">{shop.name}</h2>
          <button
            type="button"
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-1.5 py-1 text-[16px] font-normal text-[#6f6258]"
          >
            <span className={getDotIndicatorClass("teal")} aria-hidden="true" />
            영업 중
            <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.8} />
          </button>
        </div>

        <CustomerShopFrontPanel
          shop={shop}
          kakaoInquiryUrl={settings.kakao_inquiry_url.trim()}
          bookingHref="#"
          onBookingClick={() => {
            setMode("booking");
            setStep(1);
          }}
        />
      </section>
    </div>
  );
}
