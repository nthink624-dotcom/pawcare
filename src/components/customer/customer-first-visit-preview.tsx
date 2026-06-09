"use client";

import { useMemo } from "react";

import CustomerFirstVisitFlow from "@/components/customer/customer-first-visit-flow";
import {
  applyCustomerServiceOverrides,
  buildCustomerServiceSourceOptions,
} from "@/lib/customer-service-options";
import type { BootstrapStaffMember, Service, Shop } from "@/types/domain";

const previewFirstVisit = {
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

const previewDateOptions = [
  {
    value: "2026-06-09",
    label: "오늘",
    weekday: "화",
  },
];

const noop = () => {};
const noopSubmit = async () => {};

export default function CustomerFirstVisitPreview({
  shop,
  services,
  staffMembers = [],
}: {
  shop: Shop;
  services: Service[];
  staffMembers?: BootstrapStaffMember[];
}) {
  const activeServices = useMemo(() => services.filter((service) => service.is_active), [services]);
  const customerServiceOptions = useMemo(
    () =>
      applyCustomerServiceOverrides(
        buildCustomerServiceSourceOptions(activeServices, { priceGuideOnly: true }),
        shop.customer_page_settings.customer_service_overrides,
      ),
    [activeServices, shop.customer_page_settings.customer_service_overrides],
  );

  return (
    <CustomerFirstVisitFlow
      shop={shop}
      customerServiceOptions={customerServiceOptions}
      dateOptions={previewDateOptions}
      staffMembers={staffMembers}
      firstVisit={previewFirstVisit}
      step={1}
      availableSlots={[]}
      loadingSlots={false}
      submitting={false}
      completedBooking={null}
      onBackToEntry={noop}
      onStepBack={noop}
      onNext={noop}
      onSubmit={noopSubmit}
      onOpenShopInfo={noop}
      onServiceSelect={noop}
      onStaffSelect={noop}
      onDateSelect={noop}
      onTimeSelect={noop}
      onOwnerNameChange={noop}
      onPhoneChange={noop}
      onPetNameChange={noop}
      onBreedChange={noop}
      onNoteChange={noop}
      onGoManage={noop}
    />
  );
}
