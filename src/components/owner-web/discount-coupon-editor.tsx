"use client";

import { BadgePercent, CalendarDays, ChevronDown, Tag, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";

import type { CustomerServiceSourceOption } from "@/lib/customer-service-options";
import { cn } from "@/lib/utils";
import type { CustomerDiscountCoupon } from "@/types/domain";

function getLinkedOptionId(option: CustomerServiceSourceOption) {
  return option.linkedOptionId ?? option.id;
}

export type DiscountCouponPreset = "first_visit" | "revisit" | "all" | "custom";

function getBenefitTypeName(audience: CustomerDiscountCoupon["audience"]) {
  if (audience === "first_visit") return "첫 방문 혜택";
  if (audience === "revisit") return "재방문 혜택";
  if (audience === "all") return "상시 혜택";
  return "직접 설정 혜택";
}

function getServiceScopeText(coupon: CustomerDiscountCoupon, serviceOptions: CustomerServiceSourceOption[]) {
  if (coupon.service_scope !== "specific") return "전체 서비스";
  if (coupon.service_option_ids.length === 0) return "서비스 선택 필요";
  const selectedIds = new Set(coupon.service_option_ids);
  const selectedNames = serviceOptions
    .filter((option) => selectedIds.has(getLinkedOptionId(option)))
    .map((option) => option.sourceName);
  if (selectedNames.length === 0) return "선택한 서비스";
  if (selectedNames.length === 1) return selectedNames[0] ?? "선택한 서비스";
  return `${selectedNames[0]} 외 ${selectedNames.length - 1}개`;
}

function SelectFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      {children}
      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748b]" />
    </div>
  );
}

const selectClassName =
  "h-11 w-full appearance-none rounded-[8px] border border-[#dbe2ea] bg-white py-0 pl-3 pr-11 text-[16px] font-normal text-[#111827] outline-none transition focus:border-[#2f7866] focus:ring-2 focus:ring-[#dceee8] disabled:bg-[#f8fafc]";

const inputClassName =
  "h-11 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[16px] font-normal text-[#111827] outline-none transition focus:border-[#2f7866] focus:ring-2 focus:ring-[#dceee8] disabled:bg-[#f8fafc] disabled:text-[#64748b]";

const fieldLabelClassName = "text-[14px] font-normal text-[#607080]";

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
  const [collapsedCouponIds, setCollapsedCouponIds] = useState<Set<string>>(() => new Set());
  const allServiceOptionIds = Array.from(new Set(serviceOptions.map(getLinkedOptionId)));

  function toggleCollapsed(couponId: string) {
    setCollapsedCouponIds((current) => {
      const next = new Set(current);
      if (next.has(couponId)) {
        next.delete(couponId);
      } else {
        next.add(couponId);
      }
      return next;
    });
  }

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
            첫 방문 혜택 만들기
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => (onAddPreset ? onAddPreset("revisit") : onAdd())}
            className="inline-flex h-9 items-center rounded-[8px] border border-[#c8ded8] bg-white px-3 text-[15px] font-normal text-[#2f7866] transition hover:bg-[#eef7f4] disabled:opacity-40"
          >
            재방문 혜택
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => (onAddPreset ? onAddPreset("all") : onAdd())}
            className="inline-flex h-9 items-center rounded-[8px] border border-[#c8ded8] bg-white px-3 text-[15px] font-normal text-[#2f7866] transition hover:bg-[#eef7f4] disabled:opacity-40"
          >
            상시 혜택
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => (onAddPreset ? onAddPreset("custom") : onAdd())}
            className="inline-flex h-9 items-center rounded-[8px] border border-[#c8ded8] bg-white px-3 text-[15px] font-normal text-[#2f7866] transition hover:bg-[#eef7f4] disabled:opacity-40"
          >
            직접 설정
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {coupons.map((coupon) => {
        const collapsed = collapsedCouponIds.has(coupon.id);
        return (
        <section key={coupon.id} className="overflow-hidden rounded-[12px] border border-[#dbe2ea] bg-white shadow-[0_8px_22px_rgba(15,23,42,0.035)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf2f7] bg-[#fbfcfd] px-4 py-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#eef7f4] text-[#2f7866]">
                <Tag className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <label className="min-w-[220px] flex-1">
                <span className="sr-only">관리명</span>
                <input
                  value={coupon.owner_label ?? coupon.name}
                  disabled={disabled}
                  onChange={(event) => onUpdate(coupon.id, { owner_label: event.target.value })}
                  className="h-11 w-full rounded-[8px] border border-transparent bg-transparent px-0 text-[18px] font-semibold tracking-[-0.01em] text-[#111827] outline-none transition placeholder:text-[#94a3b8] hover:border-[#dbe2ea] hover:bg-white hover:px-3 focus:border-[#2f7866] focus:bg-white focus:px-3 focus:ring-2 focus:ring-[#dceee8] disabled:text-[#64748b]"
                  placeholder="혜택 이름"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="w-[190px]">
                <span className="sr-only">혜택 분류</span>
                <SelectFrame>
                  <select
                    value={coupon.audience}
                    disabled={disabled}
                    onChange={(event) => {
                      const nextAudience = event.target.value as CustomerDiscountCoupon["audience"];
                      const nextName = getBenefitTypeName(nextAudience);
                      onUpdate(coupon.id, {
                        audience: nextAudience,
                        name: nextName,
                        owner_label: coupon.owner_label?.trim() ? coupon.owner_label : nextName,
                        visible: true,
                        per_customer_limit: nextAudience === "first_visit" ? true : coupon.per_customer_limit,
                      });
                    }}
                    className={selectClassName}
                  >
                    <option value="first_visit">첫 방문 혜택</option>
                    <option value="revisit">재방문 혜택</option>
                    <option value="all">상시 혜택</option>
                    <option value="custom">직접 설정 혜택</option>
                  </select>
                </SelectFrame>
              </label>
              <ToggleChip label={coupon.enabled ? "사용 중" : "중지"} active={coupon.enabled} disabled={disabled} onClick={() => onUpdate(coupon.id, { enabled: !coupon.enabled })} />
              <button
                type="button"
                onClick={() => toggleCollapsed(coupon.id)}
                className="inline-flex h-11 items-center gap-1 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[15px] font-normal text-[#334155] transition hover:border-[#c8ded8] hover:bg-[#f8fafc]"
                aria-expanded={!collapsed}
              >
                {collapsed ? "펼치기" : "접기"}
                <ChevronDown className={cn("h-4 w-4 text-[#64748b] transition-transform", !collapsed && "rotate-180")} />
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onDelete(coupon.id)}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[9px] border border-[#dbe2ea] bg-white text-[#64748b] transition hover:border-[#efcaca] hover:bg-[#fffafa] hover:text-[#a04455] disabled:opacity-40"
                aria-label={`${coupon.owner_label ?? coupon.name} 삭제`}
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          </div>

          {!collapsed ? (
          <div className="grid items-start gap-4 p-4 xl:grid-cols-[minmax(300px,0.78fr)_minmax(460px,1.22fr)]">
            <div className="self-start rounded-[12px] border border-[#dbe2ea] bg-white p-4 shadow-[0_8px_18px_rgba(15,23,42,0.035)]">
              <div className="mb-3 flex items-center gap-2">
                <BadgePercent className="h-4.5 w-4.5 text-[#2f7866]" strokeWidth={1.8} />
                <p className="text-[15px] font-semibold text-[#334155]">할인 조건</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-[minmax(150px,0.8fr)_minmax(160px,1fr)]">
                <label className="space-y-1">
                  <span className={fieldLabelClassName}>할인 방식</span>
                  <SelectFrame>
                    <select
                      value={coupon.discount_type}
                      disabled={disabled}
                      onChange={(event) =>
                        onUpdate(coupon.id, {
                          discount_type: event.target.value === "percent" ? "percent" : "fixed",
                          discount_value: event.target.value === "percent" ? Math.min(coupon.discount_value || 10, 100) : coupon.discount_value || 10000,
                        })
                      }
                      className={selectClassName}
                    >
                      <option value="fixed">정액 할인</option>
                      <option value="percent">정률 할인</option>
                    </select>
                  </SelectFrame>
                </label>

                <label className="space-y-1">
                  <span className={fieldLabelClassName}>{coupon.discount_type === "percent" ? "할인율" : "할인 금액"}</span>
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
                      className="h-11 w-full rounded-[8px] border border-[#dbe2ea] bg-white py-0 pl-3 pr-10 text-[16px] font-normal text-[#111827] outline-none transition focus:border-[#2f7866] focus:ring-2 focus:ring-[#dceee8] disabled:bg-[#f8fafc]"
                      placeholder={coupon.discount_type === "percent" ? "10" : "10000"}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[16px] font-normal text-[#64748b]" aria-hidden="true">
                      {coupon.discount_type === "percent" ? "%" : "원"}
                    </span>
                  </div>
                </label>
              </div>
              <div className="mt-4 rounded-[10px] border border-[#edf2f7] bg-[#f8fafc] px-3 py-3">
                <p className="text-[13px] font-normal text-[#64748b]">적용 할인</p>
                <p className="mt-1 text-[20px] font-semibold tracking-[-0.03em] text-[#111827]">
                  {coupon.discount_type === "percent"
                    ? `${coupon.discount_value || 0}%`
                    : `${Number(coupon.discount_value || 0).toLocaleString("ko-KR")}원`}
                </p>
              </div>
            </div>

            <div className="self-start rounded-[12px] border border-[#dbe2ea] bg-white p-4 shadow-[0_8px_18px_rgba(15,23,42,0.035)]">
              <div className="mb-3 flex items-center gap-2">
                <CalendarDays className="h-4.5 w-4.5 text-[#2f7866]" strokeWidth={1.8} />
                <p className="text-[15px] font-semibold text-[#334155]">적용 범위</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className={fieldLabelClassName}>적용 서비스</span>
                    <span className="truncate text-[13px] font-normal text-[#64748b]">{getServiceScopeText(coupon, serviceOptions)}</span>
                  </div>
                  <div className="rounded-[10px] border border-[#dbe2ea] bg-white p-2">
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[8px] border border-[#edf2f7] bg-[#f8fafc] px-3 py-2 text-[16px] font-semibold text-[#111827] transition hover:bg-[#f1f5f9]">
                      <input
                        type="checkbox"
                        checked={coupon.service_scope !== "specific"}
                        disabled={disabled}
                        onChange={(event) =>
                          onUpdate(coupon.id, {
                            service_scope: event.target.checked ? "all" : "specific",
                            service_option_ids: [],
                          })
                        }
                        className="h-4 w-4 rounded border-[#cbd5e1] text-[#2f7866] focus:ring-[#dceee8]"
                      />
                      전체 서비스
                    </label>
                    <div className="mt-2 max-h-[236px] space-y-1 overflow-y-auto pr-1">
                      {serviceOptions.map((option) => {
                        const linkedOptionId = getLinkedOptionId(option);
                        const selected = coupon.service_scope !== "specific" || coupon.service_option_ids.includes(linkedOptionId);
                        return (
                          <label
                            key={`${option.id}-${linkedOptionId}`}
                            className={cn(
                              "flex min-h-10 cursor-pointer items-center gap-3 rounded-[8px] px-3 py-2 text-[15px] font-normal transition",
                              selected ? "bg-[#f8fbff] text-[#111827]" : "bg-white text-[#334155] hover:bg-[#f8fafc]",
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              disabled={disabled}
                              onChange={() => {
                                const currentIds = coupon.service_scope === "specific" ? coupon.service_option_ids : allServiceOptionIds;
                                const nextIds = selected
                                  ? currentIds.filter((serviceOptionId) => serviceOptionId !== linkedOptionId)
                                  : Array.from(new Set([...currentIds, linkedOptionId]));
                                onUpdate(coupon.id, {
                                  service_scope: nextIds.length === allServiceOptionIds.length ? "all" : "specific",
                                  service_option_ids: nextIds.length === allServiceOptionIds.length ? [] : nextIds,
                                });
                              }}
                              className="h-4 w-4 rounded border-[#cbd5e1] text-[#2f7866] focus:ring-[#dceee8]"
                            />
                            <span className="min-w-0 truncate">{option.sourceName}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <label className="space-y-1">
                  <span className={fieldLabelClassName}>시작일</span>
                  <input
                    type="date"
                    value={coupon.starts_at ?? ""}
                    disabled={disabled}
                    onChange={(event) => onUpdate(coupon.id, { starts_at: event.target.value })}
                    className={inputClassName}
                  />
                </label>
                <label className="space-y-1">
                  <span className={fieldLabelClassName}>종료일</span>
                  <input
                    type="date"
                    value={coupon.ends_at ?? ""}
                    disabled={disabled}
                    onChange={(event) => onUpdate(coupon.id, { ends_at: event.target.value })}
                    className={inputClassName}
                  />
                </label>
              </div>
            </div>
          </div>
          ) : null}
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
        "h-10 rounded-[8px] border px-3 text-[15px] font-normal transition disabled:opacity-40",
        active ? "border-[#2f6bd4] bg-[#2f6bd4] text-white" : "border-[#dbe2ea] bg-white text-[#64748b] hover:border-[#c8ded8] hover:bg-[#f4faf8] hover:text-[#2f7866]",
      )}
    >
      {label}
    </button>
  );
}
