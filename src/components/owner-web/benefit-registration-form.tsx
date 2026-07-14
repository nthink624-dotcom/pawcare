"use client";

import { BadgePercent, Gift, RefreshCw, UserRoundPlus, UsersRound } from "lucide-react";
import { useMemo, type ReactNode } from "react";

import { buildDiscountServiceScopeOptions } from "@/components/owner-web/discount-service-scope";
import type { CustomerServiceSourceOption } from "@/lib/customer-service-options";
import { cn } from "@/lib/utils";
import type { CustomerDiscountCoupon } from "@/types/domain";

type Props = {
  draft: CustomerDiscountCoupon;
  serviceOptions: CustomerServiceSourceOption[];
  onChange: (patch: Partial<CustomerDiscountCoupon>) => void;
};

const inputClassName =
  "h-11 w-full rounded-[6px] border border-[#dbe2ea] bg-white px-3 text-[15px] text-[#111827] outline-none transition placeholder:text-[#94a3b8] focus:border-[#94a3b8] focus:ring-2 focus:ring-[#e2e8f0]";

function FormRow({ label, required = false, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="grid gap-4 border-b border-[#e5e7eb] px-1 py-5 lg:grid-cols-[150px_minmax(0,1fr)]">
      <div className="flex items-start gap-1 pt-2 text-[14px] font-semibold text-[#475569]">
        <span>{label}</span>
        {required ? <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#c85b67]" aria-label="필수" /> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function ChoiceButton({
  selected,
  disabled = false,
  icon,
  label,
  onClick,
}: {
  selected: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "benefit-registration-choice flex h-[74px] min-w-[132px] flex-col items-center justify-center gap-2 rounded-[6px] border px-4 text-[14px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-55",
        selected
          ? "border-[#2f7866]! bg-[#f4faf8]! text-[#2f7866]!"
          : "border-[#dbe2ea] bg-white text-[#475569]! hover:bg-[#f8fafc]",
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export default function BenefitRegistrationForm({ draft, serviceOptions, onChange }: Props) {
  const scopeOptions = useMemo(() => buildDiscountServiceScopeOptions(serviceOptions), [serviceOptions]);
  const allServiceOptionIds = useMemo(
    () => Array.from(new Set(scopeOptions.flatMap((option) => option.linkedOptionIds))),
    [scopeOptions],
  );
  const combinationLocked =
    draft.discount_type === "service" || draft.audience === "first_visit" || draft.audience === "revisit";

  function changeAudience(audience: CustomerDiscountCoupon["audience"]) {
    onChange({
      audience,
      combination_policy: audience === "all" && draft.discount_type !== "service" ? draft.combination_policy : "exclusive",
      per_customer_limit: audience === "first_visit" ? true : draft.per_customer_limit,
    });
  }

  function changeBenefitType(discountType: CustomerDiscountCoupon["discount_type"]) {
    onChange({
      discount_type: discountType,
      discount_value:
        discountType === "service"
          ? 0
          : discountType === "percent"
            ? Math.min(draft.discount_value || 10, 100)
            : draft.discount_value || 10000,
      service_benefit_name:
        discountType === "service" ? draft.service_benefit_name?.trim() || "발바닥 보습" : "",
      combination_policy: discountType === "service" ? "stackable" : draft.combination_policy,
    });
  }

  return (
    <div className="benefit-registration-form h-full overflow-y-auto px-1">
      <style>{`
        .benefit-registration-form .benefit-registration-choice[aria-pressed="true"] {
          border-color: #2f7866 !important;
          background: #f4faf8 !important;
          color: #2f7866 !important;
        }
      `}</style>
      <FormRow label="혜택명" required>
        <div className="relative">
          <input
            value={draft.owner_label ?? ""}
            maxLength={40}
            onChange={(event) => onChange({ owner_label: event.target.value })}
            className={`${inputClassName} pr-16`}
            placeholder="고객에게 보여줄 혜택명을 입력하세요."
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[#64748b]">
            {(draft.owner_label ?? "").length}/40
          </span>
        </div>
      </FormRow>

      <FormRow label="혜택 대상" required>
        <div className="flex flex-wrap gap-2">
          <ChoiceButton
            selected={draft.audience === "all"}
            icon={<UsersRound className="h-5 w-5" strokeWidth={1.7} />}
            label="전체 고객"
            onClick={() => changeAudience("all")}
          />
          <ChoiceButton
            selected={draft.audience === "first_visit"}
            icon={<UserRoundPlus className="h-5 w-5" strokeWidth={1.7} />}
            label="첫 방문 고객"
            onClick={() => changeAudience("first_visit")}
          />
          <ChoiceButton
            selected={draft.audience === "revisit"}
            icon={<RefreshCw className="h-5 w-5" strokeWidth={1.7} />}
            label="재방문 고객"
            onClick={() => changeAudience("revisit")}
          />
        </div>
      </FormRow>

      <FormRow label="혜택 방식" required>
        <div className="flex flex-wrap gap-2">
          <ChoiceButton
            selected={draft.discount_type === "fixed"}
            icon={<Gift className="h-5 w-5" strokeWidth={1.7} />}
            label="정액 할인"
            onClick={() => changeBenefitType("fixed")}
          />
          <ChoiceButton
            selected={draft.discount_type === "percent"}
            icon={<BadgePercent className="h-5 w-5" strokeWidth={1.7} />}
            label="정률 할인"
            onClick={() => changeBenefitType("percent")}
          />
          <ChoiceButton
            selected={draft.discount_type === "service"}
            icon={<Gift className="h-5 w-5" strokeWidth={1.7} />}
            label="서비스 추가"
            onClick={() => changeBenefitType("service")}
          />
        </div>
      </FormRow>

      {draft.discount_type === "service" ? (
        <FormRow label="추가 서비스" required>
          <input
            value={draft.service_benefit_name ?? ""}
            maxLength={40}
            onChange={(event) => onChange({ service_benefit_name: event.target.value })}
            className={`${inputClassName} max-w-[520px]`}
            placeholder="예: 발바닥 보습"
          />
        </FormRow>
      ) : (
        <FormRow label="할인 설정" required>
          <div className="flex max-w-[560px] items-center gap-3">
            <div className="flex min-w-0 flex-1">
              <input
                value={draft.discount_value || ""}
                inputMode="numeric"
                onChange={(event) => {
                  const value = Number(event.target.value.replace(/[^0-9]/g, ""));
                  onChange({ discount_value: draft.discount_type === "percent" ? Math.min(value, 100) : value });
                }}
                className="h-11 min-w-0 flex-1 rounded-l-[6px] border border-[#dbe2ea] bg-white px-3 text-[15px] text-[#111827] outline-none transition placeholder:text-[#94a3b8] focus:z-10 focus:border-[#94a3b8] focus:ring-2 focus:ring-[#e2e8f0]"
                placeholder={draft.discount_type === "percent" ? "10" : "10000"}
              />
              <span className="inline-flex h-11 w-[62px] shrink-0 items-center justify-center rounded-r-[6px] border border-l-0 border-[#dbe2ea] bg-[#f8fafc] text-[14px] font-semibold text-[#475569]">
                {draft.discount_type === "percent" ? "%" : "원"}
              </span>
            </div>
            <span className="shrink-0 text-[14px] font-medium text-[#64748b]">할인</span>
          </div>
        </FormRow>
      )}

      <FormRow label="적용 방식" required>
        <div className="flex flex-wrap gap-2">
          {(["exclusive", "stackable"] as const).map((policy) => (
            <button
              key={policy}
              type="button"
              disabled={combinationLocked}
              aria-pressed={draft.combination_policy === policy}
              onClick={() => onChange({ combination_policy: policy })}
              className={cn(
                "benefit-registration-choice h-10 min-w-[132px] rounded-[6px] border px-4 text-[14px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-55",
                draft.combination_policy === policy
                  ? "border-[#2f7866]! bg-[#f4faf8]! text-[#2f7866]!"
                  : "border-[#dbe2ea] bg-white text-[#475569]! hover:bg-[#f8fafc]",
              )}
            >
              {policy === "exclusive" ? "단독 적용" : "중복 가능"}
            </button>
          ))}
        </div>
      </FormRow>

      <FormRow label="적용 기간">
        <div className="grid max-w-[620px] gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-[13px] text-[#64748b]">시작일</span>
            <input type="date" value={draft.starts_at ?? ""} onChange={(event) => onChange({ starts_at: event.target.value })} className={inputClassName} />
          </label>
          <label className="space-y-1">
            <span className="text-[13px] text-[#64748b]">종료일</span>
            <input type="date" value={draft.ends_at ?? ""} onChange={(event) => onChange({ ends_at: event.target.value })} className={inputClassName} />
          </label>
        </div>
      </FormRow>

      <FormRow label="혜택 서비스 지정" required>
        <div className="max-w-[760px]">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={draft.service_scope !== "specific"}
              onClick={() => onChange({ service_scope: "all", service_option_ids: [] })}
              className={cn(
                "benefit-registration-choice h-10 min-w-[150px] rounded-[6px] border px-4 text-[14px] font-semibold transition",
                draft.service_scope !== "specific"
                  ? "border-[#2f7866]! bg-[#f4faf8]! text-[#2f7866]!"
                  : "border-[#dbe2ea] bg-white text-[#475569]! hover:bg-[#f8fafc]",
              )}
            >
              내 서비스 전체
            </button>
            <button
              type="button"
              aria-pressed={draft.service_scope === "specific"}
              onClick={() => onChange({ service_scope: "specific", service_option_ids: [] })}
              className={cn(
                "benefit-registration-choice h-10 min-w-[150px] rounded-[6px] border px-4 text-[14px] font-semibold transition",
                draft.service_scope === "specific"
                  ? "border-[#2f7866]! bg-[#f4faf8]! text-[#2f7866]!"
                  : "border-[#dbe2ea] bg-white text-[#475569]! hover:bg-[#f8fafc]",
              )}
            >
              서비스 선택
            </button>
          </div>
          {draft.service_scope === "specific" ? (
          <div className="mt-3 grid max-h-[170px] gap-1 overflow-y-auto rounded-[6px] border border-[#dbe2ea] bg-white p-2 sm:grid-cols-2">
            {scopeOptions.length === 0 ? (
              <p className="col-span-full px-2 py-4 text-center text-[13px] text-[#64748b]">등록된 서비스가 없습니다.</p>
            ) : scopeOptions.map((option) => {
              const selected = option.linkedOptionIds.some((optionId) => draft.service_option_ids.includes(optionId));
              return (
                <label key={option.id} className="flex min-h-9 cursor-pointer items-center gap-2 rounded-[5px] px-3 text-[14px] text-[#334155] hover:bg-[#f8fafc]">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => {
                      const currentIds = draft.service_option_ids;
                      const nextIds = selected
                        ? currentIds.filter((optionId) => !option.linkedOptionIds.includes(optionId))
                        : Array.from(new Set([...currentIds, ...option.linkedOptionIds]));
                      onChange({
                        service_scope: nextIds.length === allServiceOptionIds.length ? "all" : "specific",
                        service_option_ids: nextIds.length === allServiceOptionIds.length ? [] : nextIds,
                      });
                    }}
                    className="h-3.5 w-3.5 accent-[#607080]!"
                  />
                  <span className="truncate">{option.sourceName}</span>
                </label>
              );
            })}
          </div>
          ) : null}
        </div>
      </FormRow>
    </div>
  );
}
