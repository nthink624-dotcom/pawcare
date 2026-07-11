"use client";

import { AlertTriangle, BadgePercent, CalendarDays, ChevronDown, Info, Trash2 } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import type { CustomerServiceSourceOption } from "@/lib/customer-service-options";
import { cn } from "@/lib/utils";
import type { CustomerDiscountCoupon } from "@/types/domain";

function getLinkedOptionId(option: CustomerServiceSourceOption) {
  return option.linkedOptionId ?? option.id;
}

type DiscountServiceScopeOption = CustomerServiceSourceOption & {
  linkedOptionIds: string[];
};

function getServiceScopeDisplayKey(option: CustomerServiceSourceOption) {
  return [
    option.category,
    option.sourceName,
    option.durationMinutes,
    option.price,
    option.priceType,
  ].join("|").replace(/\s+/g, " ").trim().toLocaleLowerCase("ko-KR");
}

function buildServiceScopeOptions(options: CustomerServiceSourceOption[]): DiscountServiceScopeOption[] {
  const optionByDisplayKey = new Map<string, DiscountServiceScopeOption>();

  for (const option of options) {
    const displayKey = getServiceScopeDisplayKey(option);
    const linkedOptionId = getLinkedOptionId(option);
    const existing = optionByDisplayKey.get(displayKey);
    if (existing) {
      if (!existing.linkedOptionIds.includes(linkedOptionId)) {
        existing.linkedOptionIds.push(linkedOptionId);
      }
      continue;
    }

    optionByDisplayKey.set(displayKey, {
      ...option,
      linkedOptionIds: [linkedOptionId],
    });
  }

  return Array.from(optionByDisplayKey.values());
}

export type DiscountCouponPreset = "first_visit" | "revisit" | "all" | "custom";

function getBenefitTypeName(audience: CustomerDiscountCoupon["audience"]) {
  if (audience === "first_visit") return "첫 방문 혜택";
  if (audience === "revisit") return "재방문 혜택";
  if (audience === "all") return "상시 혜택";
  return "직접 설정 혜택";
}

function audiencesOverlap(first: CustomerDiscountCoupon["audience"], second: CustomerDiscountCoupon["audience"]) {
  if (first === second) return true;
  if (first === "all" || second === "all") return true;
  if (first === "custom" || second === "custom") return true;
  return false;
}

function datesOverlap(first: CustomerDiscountCoupon, second: CustomerDiscountCoupon) {
  const firstStart = first.starts_at || "0000-01-01";
  const firstEnd = first.ends_at || "9999-12-31";
  const secondStart = second.starts_at || "0000-01-01";
  const secondEnd = second.ends_at || "9999-12-31";
  return firstStart <= secondEnd && secondStart <= firstEnd;
}

function servicesOverlap(first: CustomerDiscountCoupon, second: CustomerDiscountCoupon, allServiceOptionIds: string[]) {
  if (first.service_scope !== "specific" || second.service_scope !== "specific") return true;
  const firstIds = first.service_option_ids.length > 0 ? first.service_option_ids : allServiceOptionIds;
  const secondIds = second.service_option_ids.length > 0 ? second.service_option_ids : allServiceOptionIds;
  return firstIds.some((serviceOptionId) => secondIds.includes(serviceOptionId));
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
  "h-9 w-full appearance-none rounded-[8px] border border-[#dbe2ea] bg-white py-0 pl-3 pr-9 text-[14px] font-medium text-[#111827] outline-none transition focus:border-[#2f7866] focus:ring-2 focus:ring-[#dceee8] disabled:bg-[#f8fafc] disabled:text-[#64748b]";

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
  onToggleEnabled,
  onUpdate,
}: {
  coupons: CustomerDiscountCoupon[];
  serviceOptions: CustomerServiceSourceOption[];
  disabled: boolean;
  onAdd: () => void;
  onAddPreset?: (preset: DiscountCouponPreset) => void;
  onDelete: (couponId: string) => void;
  onToggleEnabled: (couponId: string) => void;
  onUpdate: (couponId: string, patch: Partial<CustomerDiscountCoupon>) => void;
}) {
  const [collapsedCouponIds, setCollapsedCouponIds] = useState<Set<string>>(() => new Set());
  const serviceScopeOptions = useMemo(() => buildServiceScopeOptions(serviceOptions), [serviceOptions]);
  const allServiceOptionIds = useMemo(
    () => Array.from(new Set(serviceScopeOptions.flatMap((option) => option.linkedOptionIds))),
    [serviceScopeOptions],
  );
  const conflictCouponLabelsById = useMemo(() => {
    const labelsById = new Map<string, string[]>();
    const activeCoupons = coupons.filter((coupon) => coupon.enabled && coupon.discount_value > 0);

    for (let index = 0; index < activeCoupons.length; index += 1) {
      const coupon = activeCoupons[index];
      if (coupon.combination_policy !== "exclusive") continue;

      for (let compareIndex = 0; compareIndex < activeCoupons.length; compareIndex += 1) {
        if (index === compareIndex) continue;
        const otherCoupon = activeCoupons[compareIndex];
        if (
          audiencesOverlap(coupon.audience, otherCoupon.audience) &&
          datesOverlap(coupon, otherCoupon) &&
          servicesOverlap(coupon, otherCoupon, allServiceOptionIds)
        ) {
          const couponLabels = labelsById.get(coupon.id) ?? [];
          couponLabels.push(otherCoupon.owner_label || otherCoupon.name);
          labelsById.set(coupon.id, couponLabels);

          const otherLabels = labelsById.get(otherCoupon.id) ?? [];
          otherLabels.push(coupon.owner_label || coupon.name);
          labelsById.set(otherCoupon.id, otherLabels);
        }
      }
    }

    return labelsById;
  }, [allServiceOptionIds, coupons]);

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
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="mb-3 flex items-start gap-2 rounded-[8px] border border-[#dfe6e3] bg-[#f7faf9] px-3 py-2 text-[13px] font-normal leading-5 text-[#475569]">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#2f7866]" aria-hidden="true" />
        <p>
          첫 방문과 재방문 혜택은 방문 이력에 맞춰 자동으로 구분됩니다. 고객에게는 조건에 맞는 혜택만 보입니다.
        </p>
      </div>
      <div className="no-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto">
      {coupons.map((coupon) => {
        const collapsed = collapsedCouponIds.has(coupon.id);
        const conflictLabels = Array.from(new Set(conflictCouponLabelsById.get(coupon.id) ?? []));
        const combinationPolicyLocked = coupon.audience === "first_visit" || coupon.audience === "revisit";
        return (
        <section
          key={coupon.id}
          className={cn(
            "overflow-hidden rounded-[8px] border bg-white transition",
            coupon.enabled ? "border-[#dbe2ea]" : "border-[#e2e8f0] bg-[#fbfcfd]",
          )}
        >
          <div
            className={cn(
              "flex flex-wrap items-center justify-between gap-3 px-4 py-3",
              coupon.enabled ? "border-[#edf2f7] bg-white" : "border-[#e5eaf0] bg-[#f8fafc]",
            )}
          >
            <div className="flex min-w-[260px] flex-1 items-center gap-2">
              <label className="min-w-[160px] max-w-[260px] flex-1">
                <span className="sr-only">관리명</span>
                <input
                  value={coupon.owner_label ?? coupon.name}
                  disabled={disabled}
                  onChange={(event) => onUpdate(coupon.id, { owner_label: event.target.value })}
                  className={cn(
                    "h-9 w-full rounded-[8px] border border-transparent bg-transparent px-0 text-[16px] font-semibold tracking-normal outline-none transition placeholder:text-[#94a3b8] hover:border-[#dbe2ea] hover:bg-white hover:px-3 focus:border-[#2563eb] focus:bg-white focus:px-3 focus:ring-2 focus:ring-[#dbeafe] disabled:text-[#64748b]",
                    coupon.enabled ? "text-[#111827]" : "text-[#64748b]",
                  )}
                  placeholder="혜택 이름"
                />
              </label>
              <span className={cn("inline-flex shrink-0 items-center gap-1.5 text-[12px] font-medium", coupon.enabled ? "text-[#2f7866]" : "text-[#64748b]")}>
                <span className={cn("h-2 w-2 rounded-full", coupon.enabled ? "bg-[#1f9d55]" : "bg-[#b9c3cf]")} aria-hidden="true" />
                {coupon.enabled ? "사용 중" : "중지됨"}
              </span>
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <label className="w-[170px]">
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
                        combination_policy: nextAudience === "first_visit" || nextAudience === "revisit" ? "exclusive" : coupon.combination_policy,
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
              <label className="w-[140px]">
                <span className="sr-only">적용 방식</span>
                <SelectFrame>
                  <select
                    value={coupon.combination_policy}
                    disabled={disabled || combinationPolicyLocked}
                    onChange={(event) =>
                      onUpdate(coupon.id, {
                        combination_policy: event.target.value === "exclusive" ? "exclusive" : "stackable",
                      })
                    }
                    className={selectClassName}
                  >
                    <option value="exclusive">단독 적용</option>
                    <option value="stackable">중복 가능</option>
                  </select>
                </SelectFrame>
              </label>
              <ToggleChip
                label={coupon.enabled ? "사용 중지" : "다시 사용"}
                active={coupon.enabled}
                disabled={disabled}
                onClick={() => onToggleEnabled(coupon.id)}
              />
              <button
                type="button"
                onClick={() => toggleCollapsed(coupon.id)}
                className="inline-flex h-9 w-[96px] items-center justify-center gap-1.5 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[14px] font-medium text-[#334155] transition hover:bg-[#f8fafc]"
                aria-expanded={!collapsed}
              >
                {collapsed ? "펼치기" : "접기"}
                <ChevronDown className={cn("h-4 w-4 text-[#64748b] transition-transform", !collapsed && "rotate-180")} />
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onDelete(coupon.id)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border border-[#dbe2ea] bg-white text-[#64748b] transition hover:border-[#efcaca] hover:bg-[#fffafa] hover:text-[#a04455] disabled:opacity-40"
                aria-label={`${coupon.owner_label ?? coupon.name} 삭제`}
              >
                <Trash2 className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>

          {conflictLabels.length > 0 ? (
            <div className="flex items-start gap-2 border-t border-[#f0e3ce] bg-[#fffbf5] px-4 py-2 text-[12px] font-normal leading-5 text-[#8a5a13]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>
                {conflictLabels.slice(0, 2).join(", ")}
                {conflictLabels.length > 2 ? ` 외 ${conflictLabels.length - 2}개` : ""}와 조건이 겹칩니다. 하나만 사용하거나 중복 가능으로 변경해 주세요.
              </p>
            </div>
          ) : null}

          {!collapsed ? (
          <div className="grid border-t border-[#edf2f7] bg-[#fbfcfd] xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <div className="flex h-full min-h-0 flex-col overflow-hidden p-4 xl:border-r xl:border-[#e5eaf0]">
              <div className="mb-2 flex items-center gap-2">
                <BadgePercent className="h-4.5 w-4.5 text-[#2f7866]" strokeWidth={1.8} />
                <p className="text-[15px] font-semibold text-[#334155]">할인 조건</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-[minmax(150px,0.8fr)_minmax(160px,1fr)]">
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
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
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

            <div className="flex h-full min-h-0 flex-col overflow-hidden border-t border-[#e5eaf0] p-4 xl:border-t-0">
              <div className="mb-2 flex items-center gap-2">
                <CalendarDays className="h-4.5 w-4.5 text-[#2f7866]" strokeWidth={1.8} />
                <p className="text-[15px] font-semibold text-[#334155]">적용 범위</p>
              </div>
              <div className="h-[170px] overflow-hidden">
                <div className="flex h-full">
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[10px] border border-[#dbe2ea] bg-white p-1.5">
                    <label className="flex min-h-9 cursor-pointer items-center gap-2 rounded-[8px] border border-[#edf2f7] bg-[#f8fafc] px-2.5 py-1.5 text-[15px] font-semibold text-[#111827] transition hover:bg-[#f1f5f9]">
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
                        className="h-3.5 w-3.5 rounded border-[#cbd5e1] text-[#2f7866] focus:ring-[#dceee8]"
                      />
                      전체 서비스
                    </label>
                    <div className="no-scrollbar mt-1 min-h-0 flex-1 space-y-0.5 overflow-y-auto">
                      {serviceScopeOptions.map((option) => {
                        const selected =
                          coupon.service_scope !== "specific" ||
                          option.linkedOptionIds.some((linkedOptionId) => coupon.service_option_ids.includes(linkedOptionId));
                        return (
                          <label
                            key={`${option.id}-${option.linkedOptionIds.join("|")}`}
                            className={cn(
                              "flex min-h-8 cursor-pointer items-center gap-2 rounded-[7px] px-2.5 py-1 text-[14px] font-normal transition",
                              selected ? "bg-[#f2f7f5] text-[#111827]" : "bg-white text-[#334155] hover:bg-[#f8fafc]",
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              disabled={disabled}
                              onChange={() => {
                                const currentIds = coupon.service_scope === "specific" ? coupon.service_option_ids : allServiceOptionIds;
                                const nextIds = selected
                                  ? currentIds.filter((serviceOptionId) => !option.linkedOptionIds.includes(serviceOptionId))
                                  : Array.from(new Set([...currentIds, ...option.linkedOptionIds]));
                                onUpdate(coupon.id, {
                                  service_scope: nextIds.length === allServiceOptionIds.length ? "all" : "specific",
                                  service_option_ids: nextIds.length === allServiceOptionIds.length ? [] : nextIds,
                                });
                              }}
                              className="h-3.5 w-3.5 rounded border-[#cbd5e1] text-[#2f7866] focus:ring-[#dceee8]"
                            />
                            <span className="min-w-0 truncate">{option.sourceName}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          ) : null}
        </section>
      );
      })}
      </div>
    </div>
  );
}

function ToggleChip({ label, active, disabled, onClick }: { label: string; active: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-9 rounded-[8px] border px-4 text-[14px] font-medium transition disabled:opacity-40",
        active
          ? "border-[#ead6dc] bg-white text-[#a04455] hover:border-[#d9a9b5] hover:bg-[#fffafa]"
          : "border-[#2f7866] bg-[#2f7866] text-white hover:border-[#286a5a] hover:bg-[#286a5a]",
      )}
    >
      {label}
    </button>
  );
}
