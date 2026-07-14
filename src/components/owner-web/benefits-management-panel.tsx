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
  "relative h-10 px-1 text-[14px] font-semibold transition after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full";

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
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex shrink-0 items-end justify-between gap-4 px-1">
        <div className="flex items-center gap-5" role="tablist" aria-label="혜택 관리 보기">
            <button
              type="button"
              role="tab"
              aria-selected={view === "register"}
              onClick={() => onViewChange("register")}
              className={cn(
                tabClassName,
                view === "register"
                  ? "text-[#2f7866]! after:bg-[#2f7866]"
                  : "text-[#64748b]! after:bg-transparent hover:text-[#334155]!",
              )}
            >
              혜택 등록
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === "manage"}
              onClick={() => onViewChange("manage")}
              className={cn(
                tabClassName,
                view === "manage"
                  ? "text-[#2f7866]! after:bg-[#2f7866]"
                  : "text-[#64748b]! after:bg-transparent hover:text-[#334155]!",
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
            className={OWNER_WEB_SECONDARY_ACTION_BUTTON_CLASS}
          >
            저장된 내용 불러오기
          </button>
        ) : null}
      </div>

      <WebSurface className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
        <div className="min-h-0 flex-1 overflow-hidden">
          {view === "register" ? (
            <BenefitRegistrationForm
              draft={registrationDraft}
              serviceOptions={serviceOptions}
              onChange={onRegistrationChange}
            />
          ) : (
            <BenefitManagementTable
              coupons={coupons}
              serviceOptions={serviceOptions}
              onOpenRegister={() => onOpenRegister()}
              onDelete={onDelete}
              onDeleteMany={onDeleteMany}
              onToggleEnabled={onToggleEnabled}
              onUpdate={onUpdate}
            />
          )}
        </div>

        {view === "register" ? (
          <div className="mt-3 flex shrink-0 justify-end gap-2 border-t border-[#e5e7eb] pt-3">
            <button
              type="button"
              onClick={onCancelRegistration}
              className="h-10 rounded-[8px] border border-[#dbe2ea] bg-white px-5 text-[14px] font-medium text-[#64748b] transition hover:border-[#cbd5e1] hover:bg-[#f8fafc]"
            >
              취소
            </button>
            <button
              type="button"
              disabled={!canRegister}
              onClick={onRegister}
              className="h-10 rounded-[8px] border border-[#94a3b8] bg-white px-5 text-[14px] font-semibold text-[#334155] transition hover:border-[#64748b] hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:border-[#e2e8f0] disabled:bg-[#f8fafc] disabled:text-[#a8b2c0]"
            >
              혜택 등록
            </button>
          </div>
        ) : null}
      </WebSurface>
    </div>
  );
}
