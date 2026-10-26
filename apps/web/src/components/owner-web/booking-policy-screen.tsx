"use client";

import BookingPolicyPanel from "@/components/owner-web/booking-policy-panel";

/** Same policy surface, without mounting unrelated shop/media/alert editors. */
export default function BookingPolicyScreen({ shopId }: { shopId: string }) {
  return (
    <div className="h-full min-h-0 overflow-y-auto" data-settings-management-active-tab="shop">
      <div className="grid h-full min-h-0 gap-6">
        <div className="h-full min-h-0 min-w-0 space-y-4">
          <div className="flex h-full min-h-0 min-w-0 flex-col gap-1" data-shop-info-main-surface>
            <div className="grid min-h-0 min-w-0 flex-1 gap-3">
              <div data-shop-info-scroll-region className="no-scrollbar min-h-0 min-w-0 overflow-y-auto rounded-[14px] bg-white px-3 pt-1 pb-1 sm:px-5 xl:flex xl:flex-col xl:overflow-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="w-full min-w-0 space-y-[18px] xl:flex xl:min-h-0 xl:flex-1 xl:flex-col">
                  <section id="shop-info-panel-policy" aria-label="예약 정책" className="xl:flex xl:min-h-0 xl:flex-1 xl:flex-col">
                    <BookingPolicyPanel shopId={shopId} editable />
                  </section>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
