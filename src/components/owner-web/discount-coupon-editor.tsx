"use client";

import { Trash2 } from "lucide-react";

import type { CustomerServiceSourceOption } from "@/lib/customer-service-options";
import { cn } from "@/lib/utils";
import type { CustomerDiscountCoupon } from "@/types/domain";

function getLinkedOptionId(option: CustomerServiceSourceOption) {
  return option.linkedOptionId ?? option.id;
}

export type DiscountCouponPreset = "first_visit" | "revisit" | "all" | "custom";

function getAudienceDiscountName(audience: CustomerDiscountCoupon["audience"]) {
  if (audience === "first_visit") return "첫 방문 할인";
  if (audience === "revisit") return "재방문 할인";
  if (audience === "all") return "전체 고객 할인";
  return "";
}

export default function DiscountCouponEditor({
  coupons,
  serviceOptions,
  disabled,
  onAdd,
  onAddPreset,
  onDelete,
  onUpdate,
}: {
  coupons: CustomerDiscountCoupon[];
  serviceOptions: CustomerServiceSourceOption[];
  disabled: boolean;
  onAdd: () => void;
  onAddPreset?: (preset: DiscountCouponPreset) => void;
  onDelete: (couponId: string) => void;
  onUpdate: (couponId: string, patch: Partial<CustomerDiscountCoupon>) => void;
}) {
  if (coupons.length === 0) {
    return (
      <div className="rounded-[10px] border border-dashed border-[#c8ded8] bg-[#f4faf8] px-4 py-6 text-center">
        <p className="text-[16px] font-normal text-[#2f7866]">등록된 혜택이 없습니다.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => (onAddPreset ? onAddPreset("first_visit") : onAdd())}
            className="inline-flex h-9 items-center rounded-[8px] border border-[#2f7866] bg-[#2f7866] px-3 text-[15px] font-normal text-white transition hover:bg-[#286a5a] disabled:opacity-40"
          >
            첫 방문 할인 만들기
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => (onAddPreset ? onAddPreset("revisit") : onAdd())}
            className="inline-flex h-9 items-center rounded-[8px] border border-[#c8ded8] bg-white px-3 text-[15px] font-normal text-[#2f7866] transition hover:bg-[#eef7f4] disabled:opacity-40"
          >
            재방문 할인
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => (onAddPreset ? onAddPreset("all") : onAdd())}
            className="inline-flex h-9 items-center rounded-[8px] border border-[#c8ded8] bg-white px-3 text-[15px] font-normal text-[#2f7866] transition hover:bg-[#eef7f4] disabled:opacity-40"
          >
            전체 고객 할인
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => (onAddPreset ? onAddPreset("custom") : onAdd())}
            className="inline-flex h-9 items-center rounded-[8px] border border-[#c8ded8] bg-white px-3 text-[15px] font-normal text-[#2f7866] transition hover:bg-[#eef7f4] disabled:opacity-40"
          >
            기타 할인
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {coupons.map((coupon) => {
        const isFirstVisit = coupon.audience === "first_visit";
        const isCustomAudience = coupon.audience === "custom";

        return (
        <section key={coupon.id} className="rounded-[10px] border border-[#dbe2ea] bg-[#fbfcfd] p-4">
          <div className="grid items-end gap-2 lg:grid-cols-[minmax(220px,0.9fr)_minmax(240px,1.1fr)_auto]">
            <label className="space-y-1">
              <span className="text-[13px] font-normal text-[#64748b]">적용 대상</span>
              <select
                value={coupon.audience}
                disabled={disabled}
                onChange={(event) => {
                  const nextAudience = event.target.value as CustomerDiscountCoupon["audience"];
                  const nextName = nextAudience === "custom" ? coupon.name : getAudienceDiscountName(nextAudience);
                  onUpdate(coupon.id, {
                    audience: nextAudience,
                    name: nextName || coupon.name,
                    visible: true,
                    per_customer_limit: nextAudience === "first_visit" ? true : coupon.per_customer_limit,
                  });
                }}
                className="h-9 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[15px] font-normal text-[#111827] outline-none transition focus:border-[#2f7866] focus:ring-2 focus:ring-[#dceee8] disabled:bg-[#f8fafc]"
              >
                <option value="first_visit">첫 방문</option>
                <option value="revisit">재방문</option>
                <option value="all">전체 고객</option>
                <option value="custom">기타</option>
              </select>
            </label>
            {isCustomAudience ? (
              <label className="space-y-1">
                <span className="text-[13px] font-normal text-[#64748b]">직접 입력</span>
                <input
                  value={coupon.name}
                  disabled={disabled}
                  onChange={(event) => onUpdate(coupon.id, { name: event.target.value })}
                  className="h-9 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[15px] font-medium text-[#111827] outline-none transition focus:border-[#2f7866] focus:ring-2 focus:ring-[#dceee8] disabled:bg-[#f8fafc] disabled:text-[#64748b]"
                  placeholder="예: 생일 할인"
                />
              </label>
            ) : (
              <div className="hidden lg:block" />
            )}
            <button
              type="button"
              disabled={disabled}
              onClick={() => onDelete(coupon.id)}
              className="inline-flex h-9 w-10 shrink-0 items-center justify-center rounded-[8px] border border-[#dbe2ea] bg-white text-[#64748b] transition hover:border-[#efcaca] hover:bg-[#fffafa] hover:text-[#a04455] disabled:opacity-40"
              aria-label={`${coupon.name} 삭제`}
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-3 grid gap-2 lg:grid-cols-3">
            <label className="space-y-1">
              <span className="text-[13px] font-normal text-[#64748b]">할인 방식</span>
              <select
                value={coupon.discount_type}
                disabled={disabled}
                onChange={(event) =>
                  onUpdate(coupon.id, {
                    discount_type: event.target.value === "percent" ? "percent" : "fixed",
                    discount_value: event.target.value === "percent" ? Math.min(coupon.discount_value || 10, 100) : coupon.discount_value || 10000,
                  })
                }
                className="h-9 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[15px] font-normal text-[#111827] outline-none transition focus:border-[#2f7866] focus:ring-2 focus:ring-[#dceee8] disabled:bg-[#f8fafc]"
              >
                <option value="fixed">정액 할인</option>
                <option value="percent">정률 할인</option>
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-[13px] font-normal text-[#64748b]">{coupon.discount_type === "percent" ? "할인율" : "할인 금액"}</span>
              <div className="relative">
                <input
                  value={coupon.discount_value || ""}
                  disabled={disabled}
                  inputMode="numeric"
                  onChange={(event) => {
                    const nextValue = Number(event.target.value.replace(/[^0-9]/g, ""));
                    const safeValue = Number.isFinite(nextValue) ? nextValue : 0;
                    onUpdate(coupon.id, { discount_value: coupon.discount_type === "percent" ? Math.min(safeValue, 100) : safeValue });
                  }}
                  className="h-9 w-full rounded-[8px] border border-[#dbe2ea] bg-white py-0 pl-3 pr-10 text-[15px] font-normal text-[#111827] outline-none transition focus:border-[#2f7866] focus:ring-2 focus:ring-[#dceee8] disabled:bg-[#f8fafc]"
                  placeholder={coupon.discount_type === "percent" ? "10" : "10000"}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[15px] font-normal text-[#64748b]" aria-hidden="true">
                  {coupon.discount_type === "percent" ? "%" : "원"}
                </span>
              </div>
            </label>

            <label className="space-y-1">
              <span className="text-[13px] font-normal text-[#64748b]">적용 서비스</span>
              <select
                value={coupon.service_scope === "specific" ? coupon.service_option_ids[0] ?? "" : "all"}
                disabled={disabled}
                onChange={(event) =>
                  onUpdate(coupon.id, {
                    service_scope: event.target.value === "all" ? "all" : "specific",
                    service_option_ids: event.target.value === "all" ? [] : [event.target.value],
                  })
                }
                className="h-9 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[15px] font-normal text-[#111827] outline-none transition focus:border-[#2f7866] focus:ring-2 focus:ring-[#dceee8] disabled:bg-[#f8fafc]"
              >
                <option value="all">전체 서비스</option>
                {serviceOptions.map((option) => (
                  <option key={option.id} value={getLinkedOptionId(option)}>
                    {option.sourceName}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-3 grid gap-2 lg:grid-cols-[1fr_1fr_auto]">
            <label className="space-y-1">
              <span className="text-[13px] font-normal text-[#64748b]">시작일</span>
              <input
                type="date"
                value={coupon.starts_at ?? ""}
                disabled={disabled}
                onChange={(event) => onUpdate(coupon.id, { starts_at: event.target.value })}
                className="h-9 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[15px] font-normal text-[#111827] outline-none transition focus:border-[#2f7866] focus:ring-2 focus:ring-[#dceee8] disabled:bg-[#f8fafc]"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[13px] font-normal text-[#64748b]">종료일</span>
              <input
                type="date"
                value={coupon.ends_at ?? ""}
                disabled={disabled}
                onChange={(event) => onUpdate(coupon.id, { ends_at: event.target.value })}
                className="h-9 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[15px] font-normal text-[#111827] outline-none transition focus:border-[#2f7866] focus:ring-2 focus:ring-[#dceee8] disabled:bg-[#f8fafc]"
              />
            </label>
            <div className="flex items-end justify-end">
              <ToggleChip label={coupon.enabled ? "사용 중" : "중지"} active={coupon.enabled} disabled={disabled} onClick={() => onUpdate(coupon.id, { enabled: !coupon.enabled })} />
            </div>
          </div>
        </section>
        );
      })}
    </div>
  );
}

function ToggleChip({ label, active, disabled, onClick }: { label: string; active: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-9 rounded-[8px] border px-3 text-[15px] font-normal transition disabled:opacity-40",
        active ? "border-[#2f7866] bg-[#2f7866] text-white" : "border-[#dbe2ea] bg-white text-[#64748b] hover:border-[#c8ded8] hover:bg-[#f4faf8] hover:text-[#2f7866]",
      )}
    >
      {label}
    </button>
  );
}
