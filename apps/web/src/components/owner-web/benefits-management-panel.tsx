"use client";

import BenefitManagementTable from "@/components/owner-web/benefit-management-table";
import BenefitRegistrationForm from "@/components/owner-web/benefit-registration-form";
import {
  OWNER_WEB_COMPACT_PRIMARY_ACTION_BUTTON_CLASS,
  OWNER_WEB_COMPACT_SECONDARY_ACTION_BUTTON_CLASS,
} from "@/components/owner-web/owner-web-action-button-styles";
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
  onRegistrationChange: (patch: Partial<CustomerDiscountCoupon>) => void;
  onRegister: () => void;
  onCancelRegistration: () => void;
  onReload: () => void;
  onDelete: (couponId: string) => void;
  onDeleteMany: (couponIds: string[]) => void;
  onToggleEnabled: (couponId: string) => void;
  onUpdate: (couponId: string, patch: Partial<CustomerDiscountCoupon>) => void;
};

export default function BenefitsManagementPanel({
  view,
  coupons,
  registrationDraft,
  serviceOptions,
  canRegister,
  dirty,
  onViewChange,
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
    <div className="benefit-management-panel flex flex-col gap-0 lg:h-full lg:min-h-0">
      <div className="shrink-0 rounded-t-[13px] rounded-b-none border-b border-[#e1e4ea] bg-white/90 px-3 pt-3 pb-0 backdrop-blur sm:px-5">
        <div className="flex min-w-0 flex-col items-stretch gap-2">
          <div className="owner-settings-tabbar benefit-management-tabbar w-full" role="tablist" aria-label="혜택 관리 보기">
            <button
              type="button"
              id="benefit-register-tab"
              role="tab"
              aria-selected={view === "register"}
              aria-controls="benefit-register-panel"
              onClick={() => onViewChange("register")}
              data-owner-control-size="content"
              className="owner-settings-tab"
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
              data-owner-control-size="content"
              className="owner-settings-tab"
            >
              혜택 조회/수정
            </button>
          </div>
          {view === "manage" ? (
            <div className="flex justify-end pb-2">
              <button
                type="button"
                onClick={onReload}
                disabled={!dirty}
                className={cn(
                  OWNER_WEB_COMPACT_SECONDARY_ACTION_BUTTON_CLASS,
                  "!h-11 shrink-0 !text-[16px] !leading-6",
                )}
              >
                저장된 내용 불러오기
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <WebSurface className="flex flex-col overflow-visible rounded-t-none border-t-0 p-4 pb-5 lg:min-h-0 lg:flex-1 lg:overflow-x-hidden lg:overflow-y-auto">
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
              className={cn(
                OWNER_WEB_COMPACT_SECONDARY_ACTION_BUTTON_CLASS,
                "!h-11 max-w-full rounded-[8px] px-5 !text-[16px] !leading-6 whitespace-normal [word-break:keep-all] focus-visible:ring-2 focus-visible:ring-[#1677ff] focus-visible:ring-offset-2",
              )}
            >
              취소
            </button>
            <button
              type="button"
              disabled={!canRegister}
              onClick={onRegister}
              className={cn(
                OWNER_WEB_COMPACT_PRIMARY_ACTION_BUTTON_CLASS,
                "!h-11 max-w-full rounded-[8px] px-5 !text-[16px] !leading-6 whitespace-normal [word-break:keep-all] focus-visible:ring-2 focus-visible:ring-[#1677ff] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-[#e8edf3] disabled:bg-[#f1f3f7] disabled:text-[#94a3b8]",
              )}
            >
              혜택 등록
            </button>
          </div>
        ) : null}
      </WebSurface>
    </div>
  );
}
