"use client";

import { Pencil, RotateCcw, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import DiscountCouponEditor from "@/components/owner-web/discount-coupon-editor";
import {
  OWNER_WEB_COMPACT_PRIMARY_ACTION_BUTTON_CLASS,
  OWNER_WEB_COMPACT_SECONDARY_ACTION_BUTTON_CLASS,
} from "@/components/owner-web/owner-web-action-button-styles";
import type { CustomerServiceSourceOption } from "@/lib/customer-service-options";
import { formatDiscountCouponValue } from "@/lib/discount-coupons";
import { cn } from "@/lib/utils";
import type { CustomerDiscountCoupon } from "@/types/domain";

type BenefitFilters = {
  query: string;
  audience: "all_options" | CustomerDiscountCoupon["audience"];
  discountType: "all_options" | CustomerDiscountCoupon["discount_type"];
  status: "all" | "enabled" | "disabled";
};

type Props = {
  coupons: CustomerDiscountCoupon[];
  serviceOptions: CustomerServiceSourceOption[];
  onDelete: (couponId: string) => void;
  onDeleteMany: (couponIds: string[]) => void;
  onToggleEnabled: (couponId: string) => void;
  onUpdate: (couponId: string, patch: Partial<CustomerDiscountCoupon>) => void;
};

const initialFilters: BenefitFilters = {
  query: "",
  audience: "all_options",
  discountType: "all_options",
  status: "all",
};

const fieldClassName =
  "h-11 w-full rounded-[6px] border border-[#dbe2ea] bg-white px-3 text-[16px]! font-medium! leading-6! text-[#111827] outline-none focus:border-[#94a3b8] focus:ring-2 focus:ring-[#e2e8f0]";

const tableHeaderClassName = "px-3 py-3 text-[16px] font-medium leading-6";

function BenefitRowActions({
  coupon,
  onEdit,
  onToggleEnabled,
  onDelete,
}: {
  coupon: CustomerDiscountCoupon;
  onEdit: () => void;
  onToggleEnabled: () => void;
  onDelete: () => void;
}) {
  const name = coupon.owner_label || coupon.name;

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      <button
        type="button"
        onClick={onEdit}
        className="inline-flex h-11 items-center justify-center gap-1.5 rounded-[7px] border border-[#dbe2ea] bg-white px-2.5 text-[16px] font-medium leading-6 text-[#334155] transition hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1677ff] focus-visible:ring-offset-2"
        aria-label={`${name} 수정`}
      >
        <Pencil className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden="true" />
        수정
      </button>
      <button
        type="button"
        onClick={onToggleEnabled}
        className="inline-flex h-11 items-center justify-center rounded-[7px] border border-[#dbe2ea] bg-white px-2.5 text-[16px] font-medium leading-6 text-[#334155] transition hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1677ff] focus-visible:ring-offset-2"
      >
        {coupon.enabled ? "중지" : "재사용"}
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="inline-flex h-11 w-11 items-center justify-center rounded-[7px] border border-[#ead6dc] bg-white text-[#a04455] transition hover:bg-[#fffafa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1677ff] focus-visible:ring-offset-2"
        aria-label={`${name} 삭제`}
      >
        <Trash2 className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden="true" />
      </button>
    </div>
  );
}

function getAudienceLabel(audience: CustomerDiscountCoupon["audience"]) {
  if (audience === "first_visit") return "첫 방문 고객";
  if (audience === "revisit") return "재방문 고객";
  return "전체 고객";
}

function getBenefitMethodLabel(discountType: CustomerDiscountCoupon["discount_type"]) {
  if (discountType === "percent") return "정률 할인";
  if (discountType === "service") return "서비스 추가";
  return "정액 할인";
}

function getServiceScopeLabel(coupon: CustomerDiscountCoupon) {
  if (coupon.service_scope !== "specific") return "내 서비스 전체";
  return `${coupon.service_option_ids.length}개 서비스`;
}

function getPeriodLabel(coupon: CustomerDiscountCoupon) {
  if (!coupon.starts_at && !coupon.ends_at) return "상시";
  return `${coupon.starts_at || "제한 없음"} ~ ${coupon.ends_at || "제한 없음"}`;
}

export default function BenefitManagementTable({
  coupons,
  serviceOptions,
  onDelete,
  onDeleteMany,
  onToggleEnabled,
  onUpdate,
}: Props) {
  const [filterDraft, setFilterDraft] = useState<BenefitFilters>(initialFilters);
  const [filters, setFilters] = useState<BenefitFilters>(initialFilters);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [editingCouponId, setEditingCouponId] = useState<string | null>(null);

  const filteredCoupons = useMemo(() => {
    const query = filters.query.trim().toLocaleLowerCase("ko-KR");

    return coupons.filter((coupon) => {
      const label = (coupon.owner_label || coupon.name).toLocaleLowerCase("ko-KR");
      if (query && !label.includes(query)) return false;
      if (filters.audience !== "all_options" && coupon.audience !== filters.audience) return false;
      if (filters.discountType !== "all_options" && coupon.discount_type !== filters.discountType) return false;
      if (filters.status === "enabled" && !coupon.enabled) return false;
      if (filters.status === "disabled" && coupon.enabled) return false;
      return true;
    });
  }, [coupons, filters]);

  const editingCoupon = coupons.find((coupon) => coupon.id === editingCouponId) ?? null;
  const visibleIds = filteredCoupons.map((coupon) => coupon.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const selectedCount = coupons.reduce((count, coupon) => count + Number(selectedIds.has(coupon.id)), 0);
  const emptyMessage = coupons.length === 0
    ? "등록된 혜택이 없습니다. 혜택 등록 탭에서 먼저 등록해 주세요."
    : "조건에 맞는 혜택이 없습니다. 검색 조건을 바꿔 다시 조회해 주세요.";

  function resetFilters() {
    setFilterDraft(initialFilters);
    setFilters(initialFilters);
  }

  function toggleVisibleSelection() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  }

  function deleteOne(coupon: CustomerDiscountCoupon) {
    if (!window.confirm(`'${coupon.owner_label || coupon.name}' 혜택을 삭제할까요?`)) return;
    onDelete(coupon.id);
    setSelectedIds((current) => {
      const next = new Set(current);
      next.delete(coupon.id);
      return next;
    });
    if (editingCouponId === coupon.id) setEditingCouponId(null);
  }

  function deleteSelected() {
    const couponIds = coupons.filter((coupon) => selectedIds.has(coupon.id)).map((coupon) => coupon.id);
    if (couponIds.length === 0) return;
    if (!window.confirm(`선택한 혜택 ${couponIds.length}개를 삭제할까요?`)) return;
    onDeleteMany(couponIds);
    setSelectedIds(new Set());
    if (editingCouponId && couponIds.includes(editingCouponId)) setEditingCouponId(null);
  }

  return (
    <div className="flex min-h-0 flex-col lg:h-full">
      <form
        className="grid shrink-0 grid-cols-1 gap-3 border-b border-[#e5e7eb] pb-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[minmax(0,1.35fr)_repeat(3,minmax(0,1fr))_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          setFilters(filterDraft);
        }}
      >
        <label className="min-w-0 space-y-1.5">
          <span className="text-[16px] font-medium leading-6 text-[#475569]">혜택명</span>
          <input
            value={filterDraft.query}
            onChange={(event) => setFilterDraft((current) => ({ ...current, query: event.target.value }))}
            placeholder="혜택명 검색"
            className={fieldClassName}
          />
        </label>
        <label className="min-w-0 space-y-1.5">
          <span className="text-[16px] font-medium leading-6 text-[#475569]">혜택 대상</span>
          <select
            value={filterDraft.audience}
            onChange={(event) => setFilterDraft((current) => ({
              ...current,
              audience: event.target.value as BenefitFilters["audience"],
            }))}
            className={fieldClassName}
          >
            <option value="all_options">전체</option>
            <option value="all">전체 고객</option>
            <option value="first_visit">첫 방문 고객</option>
            <option value="revisit">재방문 고객</option>
          </select>
        </label>
        <label className="min-w-0 space-y-1.5">
          <span className="text-[16px] font-medium leading-6 text-[#475569]">혜택 방식</span>
          <select
            value={filterDraft.discountType}
            onChange={(event) => setFilterDraft((current) => ({
              ...current,
              discountType: event.target.value as BenefitFilters["discountType"],
            }))}
            className={fieldClassName}
          >
            <option value="all_options">전체</option>
            <option value="fixed">정액 할인</option>
            <option value="percent">정률 할인</option>
            <option value="service">서비스 추가</option>
          </select>
        </label>
        <label className="min-w-0 space-y-1.5">
          <span className="text-[16px] font-medium leading-6 text-[#475569]">상태</span>
          <select
            value={filterDraft.status}
            onChange={(event) => setFilterDraft((current) => ({
              ...current,
              status: event.target.value as BenefitFilters["status"],
            }))}
            className={fieldClassName}
          >
            <option value="all">전체</option>
            <option value="enabled">사용 중</option>
            <option value="disabled">중지됨</option>
          </select>
        </label>
        <div className="flex min-w-0 flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-2 xl:col-span-1">
          <button
            type="submit"
            className={cn(
              OWNER_WEB_COMPACT_PRIMARY_ACTION_BUTTON_CLASS,
              "!h-11 min-w-0 flex-1 rounded-[6px] px-4 !text-[16px] !leading-6 whitespace-normal [word-break:keep-all] focus-visible:ring-2 focus-visible:ring-[#1677ff] focus-visible:ring-offset-2",
            )}
          >
            <Search className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden="true" />
            조회
          </button>
          <button
            type="button"
            onClick={resetFilters}
            className={cn(
              OWNER_WEB_COMPACT_SECONDARY_ACTION_BUTTON_CLASS,
              "!h-11 min-w-max flex-none rounded-[6px] px-3 !text-[16px] !leading-6 whitespace-normal [word-break:keep-all] focus-visible:ring-2 focus-visible:ring-[#1677ff] focus-visible:ring-offset-2",
            )}
          >
            <RotateCcw className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden="true" />
            초기화
          </button>
        </div>
      </form>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 py-3">
        <p className="text-[18px] font-semibold leading-[26px] text-[#334155]">
          혜택 목록 <span className="text-[14px] font-normal leading-5 text-[#64748b]">총 {filteredCoupons.length}개</span>
        </p>
        <div className="flex min-w-0 basis-full flex-wrap items-center justify-end gap-2 sm:basis-auto sm:flex-none">
          <button
            type="button"
            disabled={selectedCount === 0}
            onClick={deleteSelected}
            className={cn(
              OWNER_WEB_COMPACT_SECONDARY_ACTION_BUTTON_CLASS,
              "!h-11 min-w-max flex-none rounded-[8px] px-3.5 !text-[16px] !leading-6 whitespace-normal [word-break:keep-all] text-center focus-visible:ring-2 focus-visible:ring-[#1677ff] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40",
            )}
          >
            선택 삭제{selectedCount > 0 ? ` (${selectedCount})` : ""}
          </button>
        </div>
      </div>

      <div className="benefit-management-results">
      <div className="benefit-management-desktop-table min-h-0 min-w-0 flex-1 overflow-auto rounded-[6px] border border-[#dbe2ea]">
        <table
          className={cn(
            "w-full min-w-[960px] table-fixed border-collapse text-center text-[16px] font-normal leading-6",
            filteredCoupons.length === 0 && "h-full",
          )}
        >
          <colgroup>
            <col className="w-[44px]" />
            <col className="w-[74px]" />
            <col className="w-[120px]" />
            <col className="w-[102px]" />
            <col className="w-[100px]" />
            <col className="w-[110px]" />
            <col className="w-[110px]" />
            <col className="w-[128px]" />
            <col className="w-[172px]" />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-[#f8fafc] text-[#475569]">
            <tr className="border-b border-[#dbe2ea]">
              <th className="h-11 w-11 p-0 text-[16px] font-medium leading-6">
                <label className="inline-flex h-11 w-11 cursor-pointer items-center justify-center">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleVisibleSelection}
                    aria-label="조회된 혜택 전체 선택"
                    className="h-3.5 w-3.5 accent-[#607080]"
                  />
                </label>
              </th>
              <th className={tableHeaderClassName}>상태</th>
              <th className={tableHeaderClassName}>혜택명</th>
              <th className={tableHeaderClassName}>혜택 대상</th>
              <th className={tableHeaderClassName}>혜택 방식</th>
              <th className={tableHeaderClassName}>혜택 내용</th>
              <th className={tableHeaderClassName}>서비스</th>
              <th className={tableHeaderClassName}>기간</th>
              <th className={cn(tableHeaderClassName, "sticky right-0 z-20 min-w-[172px] bg-[#f8fafc] text-center")}>관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e5e7eb] bg-white text-[16px] font-normal leading-6">
            {filteredCoupons.length === 0 ? (
              <tr className="h-full">
                <td colSpan={9} className="px-4 py-12 text-center align-middle text-[16px] leading-6 text-[#64748b]">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              filteredCoupons.map((coupon) => (
                <tr
                  key={coupon.id}
                  className={cn("group bg-white hover:bg-[#fbfcfd]", editingCouponId === coupon.id && "bg-[#f7faf9]")}
                >
                  <td className="h-11 w-11 p-0">
                    <label className="inline-flex h-11 w-11 cursor-pointer items-center justify-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(coupon.id)}
                        onChange={() => setSelectedIds((current) => {
                          const next = new Set(current);
                          if (next.has(coupon.id)) next.delete(coupon.id);
                          else next.add(coupon.id);
                          return next;
                        })}
                        aria-label={`${coupon.owner_label || coupon.name} 선택`}
                        className="h-3.5 w-3.5 accent-[#607080]"
                      />
                    </label>
                  </td>
                  <td className="px-3 py-3">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] font-medium leading-[18px]",
                      "text-[#111827]",
                    )}>
                      <span className={cn("h-2 w-2 rounded-full", coupon.enabled ? "bg-[#1f9d55]" : "bg-[#b9c3cf]")} />
                      {coupon.enabled ? "사용 중" : "중지됨"}
                    </span>
                  </td>
                  <td className="break-words px-3 py-3 font-normal text-[#334155]">{coupon.owner_label || coupon.name}</td>
                  <td className="break-words px-3 py-3 text-[#334155]">{getAudienceLabel(coupon.audience)}</td>
                  <td className="break-words px-3 py-3 text-[#334155]">{getBenefitMethodLabel(coupon.discount_type)}</td>
                  <td className="break-words px-3 py-3 text-[#334155]">{formatDiscountCouponValue(coupon)}</td>
                  <td className="break-words px-3 py-3 text-[#334155]">{getServiceScopeLabel(coupon)}</td>
                  <td className="break-words px-3 py-3 tabular-nums text-[#334155]">{getPeriodLabel(coupon)}</td>
                  <td className={cn(
                    "sticky right-0 z-[1] px-1.5 py-2 shadow-[-8px_0_12px_rgba(15,23,42,0.04)]",
                    editingCouponId === coupon.id ? "bg-[#f7faf9]" : "bg-white group-hover:bg-[#fbfcfd]",
                  )}>
                    <BenefitRowActions
                      coupon={coupon}
                      onEdit={() => setEditingCouponId((current) => current === coupon.id ? null : coupon.id)}
                      onToggleEnabled={() => onToggleEnabled(coupon.id)}
                      onDelete={() => deleteOne(coupon)}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="benefit-management-card-list min-h-[210px] min-w-0 flex-1 flex-col gap-2 overflow-y-auto">
        {filteredCoupons.length === 0 ? (
          <div className="flex min-h-[210px] flex-1 items-center justify-center rounded-[8px] border border-[#dbe2ea] px-4 py-8 text-center">
            <p className="max-w-[42ch] text-[16px] font-normal leading-6 text-[#64748b]">{emptyMessage}</p>
          </div>
        ) : (
          filteredCoupons.map((coupon) => (
            <article
              key={coupon.id}
              className={cn(
                "min-w-0 rounded-[8px] border border-[#dbe2ea] bg-white p-3",
                editingCouponId === coupon.id && "border-[#cbd5e1] bg-[#f7faf9]",
              )}
            >
              <div className="flex min-w-0 items-start gap-2">
                <label className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(coupon.id)}
                    onChange={() => setSelectedIds((current) => {
                      const next = new Set(current);
                      if (next.has(coupon.id)) next.delete(coupon.id);
                      else next.add(coupon.id);
                      return next;
                    })}
                    aria-label={`${coupon.owner_label || coupon.name} 선택`}
                    className="h-3.5 w-3.5 accent-[#607080]"
                  />
                </label>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <h3 className="min-w-0 break-words text-[16px] font-medium leading-6 text-[#17243c]">{coupon.owner_label || coupon.name}</h3>
                    <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[12px] font-medium leading-[18px] text-[#111827]">
                      <span className={cn("h-2 w-2 rounded-full", coupon.enabled ? "bg-[#1f9d55]" : "bg-[#b9c3cf")} />
                      {coupon.enabled ? "사용 중" : "중지됨"}
                    </span>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-[#edf2f7] pt-3 text-[16px] leading-6">
                    <div className="min-w-0"><dt className="text-[16px] font-medium leading-6 text-[#475569]">혜택 대상</dt><dd className="mt-0.5 break-words text-[#334155]">{getAudienceLabel(coupon.audience)}</dd></div>
                    <div className="min-w-0"><dt className="text-[16px] font-medium leading-6 text-[#475569]">혜택 방식</dt><dd className="mt-0.5 break-words text-[#334155]">{getBenefitMethodLabel(coupon.discount_type)}</dd></div>
                    <div className="min-w-0"><dt className="text-[16px] font-medium leading-6 text-[#475569]">혜택 내용</dt><dd className="mt-0.5 break-words text-[#334155]">{formatDiscountCouponValue(coupon)}</dd></div>
                    <div className="min-w-0"><dt className="text-[16px] font-medium leading-6 text-[#475569]">서비스</dt><dd className="mt-0.5 break-words text-[#334155]">{getServiceScopeLabel(coupon)}</dd></div>
                    <div className="col-span-2 min-w-0"><dt className="text-[16px] font-medium leading-6 text-[#475569]">기간</dt><dd className="mt-0.5 break-words tabular-nums text-[#334155]">{getPeriodLabel(coupon)}</dd></div>
                  </dl>
                  <div className="mt-3 border-t border-[#edf2f7] pt-3">
                    <BenefitRowActions
                      coupon={coupon}
                      onEdit={() => setEditingCouponId((current) => current === coupon.id ? null : coupon.id)}
                      onToggleEnabled={() => onToggleEnabled(coupon.id)}
                      onDelete={() => deleteOne(coupon)}
                    />
                  </div>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
      </div>

      {editingCoupon ? (
        <div className="mt-3 min-h-0 flex-1 overflow-hidden border-t border-[#e5e7eb] pt-3">
          <DiscountCouponEditor
            coupons={[editingCoupon]}
            serviceOptions={serviceOptions}
            disabled={false}
            onAdd={() => undefined}
            onDelete={() => deleteOne(editingCoupon)}
            onToggleEnabled={onToggleEnabled}
            onUpdate={onUpdate}
          />
        </div>
      ) : null}
    </div>
  );
}
