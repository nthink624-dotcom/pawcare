"use client";

import { CustomerPagePhonePreview } from "@/components/owner-web/customer-page-phone-preview";
import type { BootstrapPayload } from "@/types/domain";

export default function OwnerBookingReadinessScreen({
  data,
  onTestReservationComplete,
}: {
  data: BootstrapPayload;
  onTestReservationComplete: () => void;
}) {
  return (
    <section className="min-h-[680px] min-w-0 overflow-x-hidden bg-white py-1 text-[#15213b]" data-testid="owner-booking-readiness-screen">
      <p className="mx-auto w-full max-w-[640px] text-center text-[13px] font-normal leading-5 text-[#64748b]">
        테스트 내용은 화면에서만 동작하며 실제 예약이나 고객 정보로 저장되지 않습니다.
      </p>
      <div className="mt-4 flex min-w-0 justify-center">
        <CustomerPagePhonePreview
          shop={data.shop}
          services={data.services}
          ownerProfile={data.ownerProfile ?? null}
          staffMembers={data.staffMembers ?? []}
          onTestReservationComplete={onTestReservationComplete}
          className="min-w-0"
        />
      </div>
    </section>
  );
}
