"use client";

import { useMemo, type CSSProperties } from "react";

import CustomerBookingManagePanel from "@/components/customer/customer-booking-manage-panel";
import {
  applyConfiguredCustomerServiceOverrides,
  buildCustomerServiceSourceOptions,
} from "@/lib/customer-service-options";
import type { BootstrapStaffMember, Service, Shop } from "@/types/domain";

export default function CustomerBookingManagePage({
  shopId,
  initialShop,
  initialServices,
  initialStaffMembers = [],
  initialAccessToken,
  entryHref,
}: {
  shopId: string;
  initialShop: Shop;
  initialServices: Service[];
  initialStaffMembers?: BootstrapStaffMember[];
  initialAccessToken?: string;
  entryHref: string;
}) {
  const services = useMemo(() => initialServices.filter((service) => service.is_active), [initialServices]);
  const staffMembers = useMemo(() => initialStaffMembers.filter((staff) => staff.name.trim()), [initialStaffMembers]);
  const customerServiceOptions = useMemo(
    () =>
      applyConfiguredCustomerServiceOverrides(
        buildCustomerServiceSourceOptions(
          services
            .slice()
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name, "ko")),
          { priceGuideOnly: true },
        ),
        initialShop.customer_page_settings.customer_service_overrides,
      ),
    [initialShop.customer_page_settings.customer_service_overrides, services],
  );

  return (
    <div
      className="mx-auto min-h-[100dvh] w-full max-w-[430px] space-y-3.5 bg-white px-4 pt-4 text-[#2b241f] [&_.field]:w-full [&_.field]:outline-none"
      style={
        {
          "--background": "#ffffff",
          "--surface": "#fffaf8",
          "--border": "#f1d7d1",
          "--muted": "#8a7a72",
          "--text": "#2b241f",
          "--accent": "#ec7f72",
          "--accent-soft": "#fce9e4",
          "--selection-soft": "rgba(236,127,114,0.10)",
          "--cta": "#ec7f72",
          "--cta-hover": "#d35f50",
          "--shadow-soft": "none",
        } as CSSProperties
      }
    >
      <CustomerBookingManagePanel
        shopId={shopId}
        shop={initialShop}
        services={initialServices}
        customerServiceOptions={customerServiceOptions}
        staffMembers={staffMembers}
        initialAccessToken={initialAccessToken}
        onBack={() => {
          window.location.href = entryHref;
        }}
      />
    </div>
  );
}
