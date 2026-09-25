"use client";

import BenefitManagementTable from "@/components/owner-web/benefit-management-table";
import type { DiscountCouponPreset } from "@/components/owner-web/discount-coupon-editor";
import BenefitRegistrationForm from "@/components/owner-web/benefit-registration-form";
import { OWNER_WEB_SECONDARY_ACTION_BUTTON_CLASS } from "@/components/owner-web/owner-web-action-button-styles";
import { WebSurface } from "@/components/owner-web/owner-web-ui";
import type { CustomerServiceSourceOption } from "@/lib/customer-service-options";
import { cn } from "@/lib/utils";
import type { CustomerDiscountCoupon } from "@/types/domain";

export type BenefitsManagementView = "register" | "manage";

type Props = {
  view: BenefitsManagementView;
  coupons: CustomerDiscountCoupon[];
  registrationDraft: CustomerDiscountCoupon;
  serviceOptions: CustomerServiceSourceOption[];
  canRegister: boolean;
  dirty: boolean;
  onViewChange: (view: BenefitsManagementView) => void;
  onOpenRegister: (preset?: DiscountCouponPreset) => void;
  onRegistrationChange: (patch: Partial<CustomerDiscountCoupon>) => void;
  onRegister: () => void;
  onCancelRegistration: () => void;
  onReload: () => void;
  onDelete: (couponId: string) => void;
  onDeleteMany: (couponIds: string[]) => void;
  onToggleEnabled: (couponId: string) => void;
  onUpdate: (couponId: string, patch: Partial<CustomerDiscountCoupon>) => void;
};

const tabClassName =
  "benefit-management-tab relative inline-flex h-11 items-center justify-center rounded-[8px] border px-4 text-[16px] font-medium leading-6 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 after:absolute after:inset-x-4 after:bottom-0 after:h-0.5 after:rounded-full";

export default function BenefitsManagementPanel({
  view,
  coupons,
  registrationDraft,
  serviceOptions,
  canRegister,
  dirty,
  onViewChange,
  onOpenRegister,
  onRegistrationChange,
  onRegister,
  onCancelRegistration,
  onReload,
  onDelete,
  onDeleteMany,
  onToggleEnabled,
  onUpdate,
}: Props) {
  return (
    <div className="benefit-management-panel flex flex-col gap-2 lg:h-full lg:min-h-0">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-4 px-1">
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="혜택 관리 보기">
            <button
              type="button"
              id="benefit-register-tab"
              role="tab"
              aria-selected={view === "register"}
              aria-controls="benefit-register-panel"
              onClick={() => onViewChange("register")}
              className={cn(
                tabClassName,
                view === "register"
                  ? "border-[#2563eb] bg-[#eff6ff] text-[#1d4ed8] after:bg-[#1d4ed8] hover:bg-[#dbeafe]"
                  : "border-[#e8edf3] bg-white text-[#475569] after:bg-transparent hover:border-[#cbd5e1] hover:bg-[#f8fafc] hover:text-[#15213b]",
              )}
            >
              혜택 등록
            </button>
            <button
              type="button"
              id="benefit-manage-tab"
              role="tab"
              aria-selected={view === "manage"}
              aria-controls="benefit-manage-panel"
              onClick={() => onViewChange("manage")}
              className={cn(
                tabClassName,
                view === "manage"
                  ? "border-[#2563eb] bg-[#eff6ff] text-[#1d4ed8] after:bg-[#1d4ed8] hover:bg-[#dbeafe]"
                  : "border-[#e8edf3] bg-white text-[#475569] after:bg-transparent hover:border-[#cbd5e1] hover:bg-[#f8fafc] hover:text-[#15213b]",
              )}
            >
              혜택 조회/수정
            </button>
        </div>
        {view === "manage" ? (
          <button
            type="button"
            onClick={onReload}
            disabled={!dirty}
            className={cn(OWNER_WEB_SECONDARY_ACTION_BUTTON_CLASS, "!text-[16px] !leading-6")}
          >
            저장된 내용 불러오기
          </button>
        ) : null}
      </div>

      <WebSurface className="flex flex-col overflow-visible p-4 pb-5 lg:min-h-0 lg:flex-1 lg:overflow-x-hidden lg:overflow-y-auto">
        <div
          id="benefit-register-panel"
          role="tabpanel"
          aria-labelledby="benefit-register-tab"
          hidden={view !== "register"}
          className={cn("overflow-visible lg:min-h-0 lg:flex-1 lg:overflow-hidden", view !== "register" && "hidden")}
        >
          <BenefitRegistrationForm
            draft={registrationDraft}
            serviceOptions={serviceOptions}
            onChange={onRegistrationChange}
          />
        </div>
        <div
          id="benefit-manage-panel"
          role="tabpanel"
          aria-labelledby="benefit-manage-tab"
          hidden={view !== "manage"}
          className={cn("overflow-visible lg:min-h-0 lg:flex-1 lg:overflow-hidden", view !== "manage" && "hidden")}
        >
          <BenefitManagementTable
            coupons={coupons}
            serviceOptions={serviceOptions}
            onOpenRegister={() => onOpenRegister()}
            onDelete={onDelete}
            onDeleteMany={onDeleteMany}
            onToggleEnabled={onToggleEnabled}
            onUpdate={onUpdate}
          />
        </div>

        {view === "register" ? (
          <div className="mt-3 flex shrink-0 flex-wrap justify-end gap-2 border-t border-[#e8edf3] pt-3">
            <button
              type="button"
              onClick={onCancelRegistration}
              className="min-h-11 max-w-full rounded-[8px] border border-[#e8edf3] bg-white px-5 py-2 text-[16px] font-medium leading-6 whitespace-normal [word-break:keep-all] text-[#475569] transition hover:border-[#cbd5e1] hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2"
            >
              취소
            </button>
            <button
              type="button"
              disabled={!canRegister}
              onClick={onRegister}
              className="min-h-11 max-w-full rounded-[8px] border border-[#1d4ed8] bg-[#1d4ed8] px-5 py-2 text-[16px] font-medium leading-6 whitespace-normal [word-break:keep-all] text-white transition hover:border-[#1e40af] hover:bg-[#1e40af] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-[#e8edf3] disabled:bg-[#f1f3f7] disabled:text-[#94a3b8]"
            >
              혜택 등록
            </button>
          </div>
        ) : null}
      </WebSurface>
    </div>
  );
}
