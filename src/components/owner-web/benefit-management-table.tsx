"use client";

import { Pencil, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import DiscountCouponEditor from "@/components/owner-web/discount-coupon-editor";
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
  onOpenRegister: () => void;
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
  "h-10 w-full rounded-[6px] border border-[#dbe2ea] bg-white px-3 text-[14px] text-[#111827] outline-none focus:border-[#94a3b8] focus:ring-2 focus:ring-[#e2e8f0]";

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
  onOpenRegister,
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
    <div className="flex h-full min-h-0 flex-col">
      <form
        className="grid shrink-0 grid-cols-[minmax(180px,1.35fr)_repeat(3,minmax(140px,1fr))_auto] gap-3 border-b border-[#e5e7eb] pb-4"
        onSubmit={(event) => {
          event.preventDefault();
          setFilters(filterDraft);
        }}
      >
        <label className="space-y-1.5">
          <span className="text-[14px] font-medium text-[#475569]">혜택명</span>
          <input
            value={filterDraft.query}
            onChange={(event) => setFilterDraft((current) => ({ ...current, query: event.target.value }))}
            placeholder="혜택명 검색"
            className={fieldClassName}
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-[14px] font-medium text-[#475569]">혜택 대상</span>
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
        <label className="space-y-1.5">
          <span className="text-[14px] font-medium text-[#475569]">혜택 방식</span>
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
        <label className="space-y-1.5">
          <span className="text-[14px] font-medium text-[#475569]">상태</span>
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
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="inline-flex h-10 items-center gap-1.5 rounded-[6px] border border-[#475569] bg-[#475569] px-4 text-[14px] font-semibold text-white hover:bg-[#3d4958]"
          >
            <Search className="h-4 w-4" />
            조회
          </button>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex h-10 items-center gap-1.5 rounded-[6px] border border-[#dbe2ea] bg-white px-3 text-[14px] font-semibold text-[#475569] hover:bg-[#f8fafc]"
          >
            <RotateCcw className="h-4 w-4" />
            초기화
          </button>
        </div>
      </form>

      <div className="flex shrink-0 items-center justify-between gap-3 py-3">
        <p className="text-[15px] font-medium text-[#334155]">
          혜택 목록 <span className="font-normal text-[#64748b]">총 {filteredCoupons.length}개</span>
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={selectedCount === 0}
            onClick={deleteSelected}
            className="h-10 rounded-[8px] border border-[#dbe2ea] bg-white px-3.5 text-[14px] font-medium text-[#64748b] hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-40"
          >
            선택 삭제{selectedCount > 0 ? ` (${selectedCount})` : ""}
          </button>
          <button
            type="button"
            onClick={onOpenRegister}
            className="inline-flex h-10 items-center gap-1.5 rounded-[8px] border border-[#9bb8f4] bg-white px-3.5 text-[14px] font-medium text-[#2f6bd4] hover:bg-[#f3f7ff]"
          >
            <Plus className="h-4 w-4" />
            새 혜택 등록
          </button>
        </div>
      </div>

      <div className="min-h-[210px] shrink-0 overflow-auto rounded-[6px] border border-[#dbe2ea]">
        <table className="w-full min-w-[1060px] border-collapse text-center text-[14px]">
          <thead className="sticky top-0 z-10 bg-[#f8fafc] font-medium text-[#475569]">
            <tr className="border-b border-[#dbe2ea]">
              <th className="w-11 px-3 py-3">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleVisibleSelection}
                  aria-label="조회된 혜택 전체 선택"
                  className="h-3.5 w-3.5 accent-[#607080]"
                />
              </th>
              <th className="px-3 py-3">상태</th>
              <th className="px-3 py-3">혜택명</th>
              <th className="px-3 py-3">혜택 대상</th>
              <th className="px-3 py-3">혜택 방식</th>
              <th className="px-3 py-3">혜택 내용</th>
              <th className="px-3 py-3">서비스</th>
              <th className="px-3 py-3">기간</th>
              <th className="px-3 py-3 text-center">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e5e7eb] bg-white text-[16px]">
            {filteredCoupons.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-[#64748b]">
                  조회된 혜택이 없습니다.
                </td>
              </tr>
            ) : (
              filteredCoupons.map((coupon) => (
                <tr
                  key={coupon.id}
                  className={cn("hover:bg-[#fbfcfd]", editingCouponId === coupon.id && "bg-[#f7faf9]")}
                >
                  <td className="px-3 py-3">
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
                  </td>
                  <td className="px-3 py-3">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 whitespace-nowrap font-semibold",
                      "text-[#111827]",
                    )}>
                      <span className={cn("h-2 w-2 rounded-full", coupon.enabled ? "bg-[#1f9d55]" : "bg-[#b9c3cf]")} />
                      {coupon.enabled ? "사용 중" : "중지됨"}
                    </span>
                  </td>
                  <td className="px-3 py-3 font-normal text-[#334155]">{coupon.owner_label || coupon.name}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-[#334155]">{getAudienceLabel(coupon.audience)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-[#334155]">{getBenefitMethodLabel(coupon.discount_type)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-[#334155]">{formatDiscountCouponValue(coupon)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-[#334155]">{getServiceScopeLabel(coupon)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-[#334155]">{getPeriodLabel(coupon)}</td>
                  <td className="px-3 py-3">
                    <div className="flex justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => setEditingCouponId((current) => current === coupon.id ? null : coupon.id)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-[7px] border border-[#dbe2ea] bg-white text-[#475569] hover:bg-[#f8fafc]"
                        title="수정"
                        aria-label={`${coupon.owner_label || coupon.name} 수정`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleEnabled(coupon.id)}
                        className="h-9 rounded-[7px] border border-[#dbe2ea] bg-white px-2.5 text-[13px] font-medium text-[#475569] hover:bg-[#f8fafc]"
                      >
                        {coupon.enabled ? "중지" : "재사용"}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteOne(coupon)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-[7px] border border-[#ead6dc] bg-white text-[#a04455] hover:bg-[#fffafa]"
                        title="삭제"
                        aria-label={`${coupon.owner_label || coupon.name} 삭제`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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
