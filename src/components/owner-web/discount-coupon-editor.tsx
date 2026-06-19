"use client";

import { Trash2 } from "lucide-react";

import type { CustomerServiceSourceOption } from "@/lib/customer-service-options";
import { cn } from "@/lib/utils";
import type { CustomerDiscountCoupon } from "@/types/domain";

function getLinkedOptionId(option: CustomerServiceSourceOption) {
  return option.linkedOptionId ?? option.id;
}

export default function DiscountCouponEditor({
  coupons,
  serviceOptions,
  disabled,
  onAdd,
  onDelete,
  onUpdate,
}: {
  coupons: CustomerDiscountCoupon[];
  serviceOptions: CustomerServiceSourceOption[];
  disabled: boolean;
  onAdd: () => void;
  onDelete: (couponId: string) => void;
  onUpdate: (couponId: string, patch: Partial<CustomerDiscountCoupon>) => void;
}) {
  if (coupons.length === 0) {
    return (
      <div className="rounded-[10px] border border-dashed border-[#dbe2ea] bg-[#fbfcfd] px-4 py-5 text-center">
        <p className="text-[16px] font-normal text-[#334155]">등록된 혜택이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {coupons.map((coupon) => (
        <section key={coupon.id} className="rounded-[10px] border border-[#dbe2ea] bg-white p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <input
                value={coupon.name}
                disabled={disabled}
                onChange={(event) => onUpdate(coupon.id, { name: event.target.value })}
                className="h-9 w-full min-w-[260px] rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[15px] font-medium text-[#111827] outline-none focus:border-[#334155] disabled:bg-[#f8fafc]"
              />
              <p className="mt-1 text-[13px] font-normal text-[#64748b]">
                {coupon.visible ? "고객 예약 화면 노출" : "고객 화면 숨김"} · {coupon.enabled ? "사용 중" : "중지"}
              </p>
            </div>
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

          <div className="mt-3 grid gap-2 lg:grid-cols-4">
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
                className="h-9 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[15px] font-normal text-[#111827]"
              >
                <option value="fixed">정액 할인</option>
                <option value="percent">정률 할인</option>
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-[13px] font-normal text-[#64748b]">{coupon.discount_type === "percent" ? "할인율" : "할인 금액"}</span>
              <input
                value={coupon.discount_value || ""}
                disabled={disabled}
                inputMode="numeric"
                onChange={(event) => {
                  const nextValue = Number(event.target.value.replace(/[^0-9]/g, ""));
                  onUpdate(coupon.id, { discount_value: Number.isFinite(nextValue) ? nextValue : 0 });
                }}
                className="h-9 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[15px] font-normal text-[#111827]"
                placeholder={coupon.discount_type === "percent" ? "10" : "10000"}
              />
            </label>

            <label className="space-y-1">
              <span className="text-[13px] font-normal text-[#64748b]">적용 대상</span>
              <select
                value={coupon.audience}
                disabled={disabled}
                onChange={(event) => onUpdate(coupon.id, { audience: event.target.value as CustomerDiscountCoupon["audience"] })}
                className="h-9 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[15px] font-normal text-[#111827]"
              >
                <option value="all">전체 고객</option>
                <option value="first_visit">첫 방문</option>
                <option value="revisit">재방문</option>
              </select>
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
                className="h-9 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[15px] font-normal text-[#111827]"
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

          <div className="mt-3 grid gap-2 lg:grid-cols-[1fr_1fr_1.2fr]">
            <label className="space-y-1">
              <span className="text-[13px] font-normal text-[#64748b]">시작일</span>
              <input
                type="date"
                value={coupon.starts_at ?? ""}
                disabled={disabled}
                onChange={(event) => onUpdate(coupon.id, { starts_at: event.target.value })}
                className="h-9 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[15px] font-normal text-[#111827]"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[13px] font-normal text-[#64748b]">종료일</span>
              <input
                type="date"
                value={coupon.ends_at ?? ""}
                disabled={disabled}
                onChange={(event) => onUpdate(coupon.id, { ends_at: event.target.value })}
                className="h-9 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[15px] font-normal text-[#111827]"
              />
            </label>
            <div className="flex flex-wrap items-end gap-2">
              <ToggleChip label="고객당 1회" active={coupon.per_customer_limit} disabled={disabled} onClick={() => onUpdate(coupon.id, { per_customer_limit: !coupon.per_customer_limit })} />
              <ToggleChip label="고객 노출" active={coupon.visible} disabled={disabled} onClick={() => onUpdate(coupon.id, { visible: !coupon.visible })} />
              <ToggleChip label={coupon.enabled ? "사용 중" : "중지"} active={coupon.enabled} disabled={disabled} onClick={() => onUpdate(coupon.id, { enabled: !coupon.enabled })} />
            </div>
          </div>
        </section>
      ))}
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
        active ? "border-[#334155] bg-[#334155] text-white" : "border-[#dbe2ea] bg-white text-[#64748b] hover:bg-[#f8fafc]",
      )}
    >
      {label}
    </button>
  );
}
