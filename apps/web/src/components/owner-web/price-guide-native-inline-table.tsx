"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";

import { BreedManagementDialog } from "@/components/owner-web/service-price-guide-group-dialogs";
import PriceGuideNativeInlineExtras from "@/components/owner-web/price-guide-native-inline-extras";
import PriceGuideServiceDurationControl from "@/components/owner-web/price-guide-service-duration-control";

import {
  addDirectPriceGuideService,
  addDirectPriceGuideGroup,
  addDirectPriceGuideWeightBand,
  directPriceGuideRowIndex,
  directPriceGuideWeightLabel,
  readDirectPriceGuideMatrix,
  readPreservedPriceGuideRows,
  removeDirectPriceGuideGroup,
  removeDirectPriceGuideService,
  removeDirectPriceGuideWeightBand,
  updateDirectPriceGuideCell,
  updateDirectPriceGuideGroup,
  updateDirectPriceGuideService,
  updateDirectPriceGuideWeightBand,
  updateDirectPriceGuideWeightBandLabel,
} from "@/lib/price-guide-direct-matrix";
import { priceGuideDisplayGroupLabel } from "@/lib/price-guide-structured-table";
import {
  groupPriceGuideRowsByServiceDuration,
  isConfirmedPriceGuideDuration,
} from "@/lib/price-guide-duration-confirmation";
import { applyWeightDurationUpdates } from "@/lib/price-guide-weight-duration-proposal";
import {
  resolvePriceGuideV2Reviews,
  type PriceGuideV2,
  type PriceGuideV2Row,
} from "@/types/price-guide-photo-import";

type ValidationIssue = {
  key: string;
  inputId: string;
  message: string;
};

// PRICE_GUIDE_UI_HARD_CONTRACT: 16/24 only; price left + duration right on one nowrap row.
const inputClass = "h-11 min-w-0 w-full rounded-[8px] border border-[#cbd5e1] bg-white px-2.5 !text-[16px] font-normal !leading-6 text-[#172033] outline-none placeholder:text-[#94a3b8] focus-visible:border-[#2563eb] focus-visible:ring-2 focus-visible:ring-[#2563eb]/20";
const cellButtonClass = "min-h-11 w-full min-w-0 rounded-[8px] px-2.5 py-2 text-left !text-[16px] !font-normal !leading-6 text-[#334155] hover:bg-[#f7f9fc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]";
const actionClass = "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[8px] border border-[#cbd5e1] bg-white px-3 !text-[16px] !font-medium !leading-6 text-[#42536a] hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2";
const iconButtonClass = "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] text-[#64748b] hover:bg-[#f1f5f9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2";

function nullableInteger(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) : null;
}

function nullableDecimal(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function rowInputId(rowIndex: number, field: keyof PriceGuideV2Row) {
  return `price-guide-row-${rowIndex}-${field}`;
}

function InlineError({ issue }: { issue?: ValidationIssue }) {
  return issue ? <p id={`${issue.inputId}-error`} className="mt-1 text-[16px] font-medium leading-6 text-[#a04455]">{issue.message}</p> : null;
}

function compactPriceDurationLabel(row: PriceGuideV2Row) {
  if (row.priceMinKrw === null) return `미정 · ${row.durationMinutes === null ? "미정" : `${row.durationMinutes}분`}`;
  if (row.priceKind === "range") {
    const price = row.priceMaxKrw === null
      ? `${row.priceMinKrw.toLocaleString("ko-KR")}~`
      : `${row.priceMinKrw.toLocaleString("ko-KR")}~${row.priceMaxKrw.toLocaleString("ko-KR")}`;
    return `${price}원 · ${row.durationMinutes === null ? "미정" : `${row.durationMinutes}분`}`;
  }
  return `${row.priceMinKrw.toLocaleString("ko-KR")}원${row.priceKind === "starting" ? "부터" : ""} · ${row.durationMinutes === null ? "미정" : `${row.durationMinutes}분`}`;
}

function priceDisplayLabel(row: PriceGuideV2Row) {
  if (row.priceMinKrw === null) return "미정";
  if (row.priceKind === "range") {
    return row.priceMaxKrw === null
      ? `${row.priceMinKrw.toLocaleString("ko-KR")}원부터`
      : `${row.priceMinKrw.toLocaleString("ko-KR")}~${row.priceMaxKrw.toLocaleString("ko-KR")}원`;
  }
  return `${row.priceMinKrw.toLocaleString("ko-KR")}원${row.priceKind === "starting" ? "부터" : ""}`;
}

function PriceDurationInlineCell({
  row,
  rowIndex,
  priceIssue,
  durationIssue,
  forceInputId,
  onEditStart,
  onChange,
}: {
  row: PriceGuideV2Row;
  rowIndex: number;
  priceIssue?: ValidationIssue;
  durationIssue?: ValidationIssue;
  forceInputId?: string;
  onEditStart: () => void;
  onChange: (patch: Partial<PriceGuideV2Row>, fields: string[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const minPriceId = rowInputId(rowIndex, "priceMinKrw");
  const maxPriceId = rowInputId(rowIndex, "priceMaxKrw");
  const durationId = rowInputId(rowIndex, "durationMinutes");
  const isEditing = editing || Boolean(forceInputId);

  return (
    <div
      data-price-guide-price-duration-cell={rowIndex}
      onFocusCapture={() => setEditing(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setEditing(false);
      }}
    >
      {isEditing ? (
        <div className="grid grid-cols-[minmax(0,1fr)_88px] gap-1.5" data-price-guide-inline-edit="price-duration">
          <div className={row.priceKind === "range" ? "grid grid-cols-2 gap-1" : "min-w-0"}>
            <label htmlFor={minPriceId} className="sr-only">가격</label>
            <input
              id={minPriceId}
              autoFocus={forceInputId !== durationId && forceInputId !== maxPriceId}
              value={row.priceMinKrw ?? ""}
              inputMode="numeric"
              onChange={(event) => onChange({ priceMinKrw: nullableInteger(event.target.value) }, ["priceMinKrw"])}
              aria-invalid={Boolean(priceIssue)}
              aria-describedby={priceIssue ? `${priceIssue.inputId}-error` : undefined}
              className={`${inputClass} tabular-nums`}
              placeholder={row.priceKind === "range" ? "최소" : "미정"}
            />
            {row.priceKind === "range" ? <>
              <label htmlFor={maxPriceId} className="sr-only">최대 금액</label>
              <input
                id={maxPriceId}
                autoFocus={forceInputId === maxPriceId}
                value={row.priceMaxKrw ?? ""}
                inputMode="numeric"
                onChange={(event) => onChange({ priceMaxKrw: nullableInteger(event.target.value) }, ["priceMaxKrw"])}
                aria-invalid={Boolean(priceIssue)}
                aria-describedby={priceIssue ? `${priceIssue.inputId}-error` : undefined}
                className={`${inputClass} tabular-nums`}
                placeholder="최대"
              />
            </> : null}
          </div>
          <div className="min-w-0">
            <label htmlFor={durationId} className="sr-only">예상시간</label>
            <input
              id={durationId}
              autoFocus={forceInputId === durationId}
              value={row.durationMinutes ?? ""}
              inputMode="numeric"
              onChange={(event) => onChange({ durationMinutes: nullableInteger(event.target.value) }, ["durationMinutes"])}
              aria-invalid={Boolean(durationIssue)}
              aria-describedby={durationIssue ? `${durationId}-error` : undefined}
              className={`${inputClass} tabular-nums`}
              placeholder="미정"
            />
          </div>
          <div className="col-span-2">
            <InlineError issue={priceIssue ?? durationIssue} />
          </div>
        </div>
      ) : (
        <button
          id={minPriceId}
          type="button"
          onClick={() => {
            onEditStart();
            setEditing(true);
          }}
          className={`${cellButtonClass} whitespace-nowrap`}
          aria-label={`${compactPriceDurationLabel(row)}. 가격과 예상시간 수정`}
        >
          <span className="grid grid-cols-[minmax(0,1fr)_88px] items-center gap-1.5" data-price-left-time-right="true">
            <span className={`min-w-0 truncate whitespace-nowrap text-[16px] font-medium leading-6 tabular-nums ${row.priceMinKrw === null ? "text-[#7a8798]" : "text-[#172033]"}`} data-price-side="left">{priceDisplayLabel(row)}</span>
            <span className={`min-w-0 whitespace-nowrap border-l border-[#e2e8f0] pl-2 text-[16px] font-medium leading-6 tabular-nums ${row.durationMinutes === null ? "text-[#7a8798]" : "text-[#172033]"}`} data-duration-side="right">{row.durationMinutes === null ? "미정" : `${row.durationMinutes}분`}</span>
          </span>
        </button>
      )}
    </div>
  );
}

export default function PriceGuideNativeInlineTable({
  document: guide,
  onChange,
  validationIssues,
  heading = "요금표",
  photoReviewMode = false,
  focusFirstMissingDuration = false,
  visibleGroupIndex,
  extrasOnly = false,
  headerSlot,
  hideHeader = false,
}: {
  document: PriceGuideV2;
  onChange: (next: PriceGuideV2) => void;
  validationIssues: ValidationIssue[];
  heading?: string;
  photoReviewMode?: boolean;
  focusFirstMissingDuration?: boolean;
  visibleGroupIndex?: number;
  extrasOnly?: boolean;
  /** Explicit opt-in: direct registration may integrate its back action with this table header. */
  headerSlot?: ReactNode;
  /** Explicit opt-in: direct registration controls duration from each service header instead of a pre-table panel. */
  priceFirstDurationControls?: boolean;
  /** Explicit opt-in: direct registration starts at the matrix without a duplicate page header. */
  hideHeader?: boolean;
}) {
  const [activeStructureField, setActiveStructureField] = useState<string | null>(null);
  const [dismissedIssueInputId, setDismissedIssueInputId] = useState<string | null>(null);
  const [breedDialogGroupIndex, setBreedDialogGroupIndex] = useState<number | null>(null);
  const groups = readDirectPriceGuideMatrix(guide);
  const preservedRows = readPreservedPriceGuideRows(guide);
  const durationGroups = groupPriceGuideRowsByServiceDuration(guide);
  const issues = new Map(validationIssues.map((issue) => [issue.key, issue]));
  const firstIssueInputId = validationIssues[0]?.inputId;
  const forcedIssueInputId = dismissedIssueInputId === firstIssueInputId ? undefined : firstIssueInputId;

  function startStructureEdit(inputId: string | null) {
    setDismissedIssueInputId(firstIssueInputId ?? null);
    setActiveStructureField(inputId);
  }

  function startIndependentCellEdit() {
    setDismissedIssueInputId(firstIssueInputId ?? null);
    setActiveStructureField(null);
  }

  function emit(next: PriceGuideV2, rowIndexes: number[], fields: string[]) {
    const targets = new Set(rowIndexes.map((index) => `rows:${index}`));
    const corrected = guide.source === "manual" ? next : { ...next, source: "owner_corrected" as const };
    if (photoReviewMode) {
      onChange(corrected);
      return;
    }
    onChange(resolvePriceGuideV2Reviews(
      corrected,
      (review) => targets.has(review.targetId) && fields.includes(review.field),
      "corrected",
    ));
  }

  function groupRowIndexes(groupIndex: number) {
    const group = groups[groupIndex];
    return group.weightBands.flatMap((_, weightIndex) => group.serviceNames.map((__, serviceIndex) => (
      directPriceGuideRowIndex(groups, groupIndex, weightIndex, serviceIndex)
    )));
  }

  const firstMissingDurationInputId = groups.flatMap((group, groupIndex) => (
    group.weightBands.flatMap((_, weightIndex) => group.serviceNames.flatMap((__, serviceIndex) => {
      const rowIndex = directPriceGuideRowIndex(groups, groupIndex, weightIndex, serviceIndex);
      const row = group.cells[weightIndex][serviceIndex];
      return !isConfirmedPriceGuideDuration(row.durationMinutes)
        ? [rowInputId(rowIndex, "durationMinutes")]
        : [];
    }))
  ))[0];
  const renderedStructureField = activeStructureField
    ?? (focusFirstMissingDuration ? firstMissingDurationInputId : undefined)
    ?? forcedIssueInputId;

  return (
    <div
      className="min-w-0"
      data-price-guide-native-inline-table="true"
      data-price-guide-photo-editing={photoReviewMode ? "true" : undefined}
      data-price-guide-dynamic-service-ui="true"
      onFocusCapture={(event) => {
        if (["INPUT", "SELECT", "TEXTAREA"].includes(event.target.tagName) && event.target.id) {
          const inputId = event.target.id;
          if (!inputId.endsWith("-priceMinKrw") && !inputId.endsWith("-priceMaxKrw") && !inputId.endsWith("-durationMinutes")) {
            setActiveStructureField(inputId);
          }
        }
      }}
    >
      {hideHeader ? null : headerSlot ? (
        <header className="pb-2">{headerSlot}</header>
      ) : (
        <header className="border-b border-[#e2e8f0] pb-3">
          <h2 className="text-[20px] font-semibold leading-7 tracking-[-0.015em] text-[#172033]">{heading}</h2>
        </header>
      )}
      {validationIssues.length > 0 ? (
        <p role="alert" className="mt-4 rounded-[10px] border border-[#ecd6d1] bg-[#fff7f5] px-4 py-3 text-[16px] font-medium leading-6 text-[#a04455]">{validationIssues[0].message}</p>
      ) : null}

      <div className={hideHeader ? "mt-0 space-y-2" : "mt-4 space-y-2"}>
        {groups.map((group, groupIndex) => {
          if (extrasOnly || (visibleGroupIndex !== undefined && groupIndex !== visibleGroupIndex)) return null;
          const rowIndexes = groupRowIndexes(groupIndex);
          const groupName = priceGuideDisplayGroupLabel(group.sourceLabel.trim()) || `그룹 ${groupIndex + 1}`;
          const titleId = `price-guide-direct-group-${groupIndex}-sourceLabel`;
          const titleIssue = issues.get(`tableGroups:${groupIndex}.sourceLabel`);
          const tableWidth = Math.max(760, 120 + group.serviceNames.length * 210);
          return (
            <section key={`group-${groupIndex}`} className="min-w-0 rounded-[12px] border border-[#dbe2ea] bg-white p-2.5" data-native-price-guide-group={groupIndex}>
              {renderedStructureField === titleId ? (
                <div>
                  <label htmlFor={titleId} className="sr-only">그룹 제목</label>
                  <input id={titleId} autoFocus value={group.sourceLabel.trim() ? groupName : ""} onChange={(event) => emit(updateDirectPriceGuideGroup(guide, groupIndex, { sourceLabel: event.target.value }), rowIndexes, ["breedGroup"])} aria-invalid={Boolean(titleIssue)} aria-describedby={titleIssue ? `${titleId}-error` : undefined} className={`${inputClass} max-w-lg !font-medium`} placeholder="그룹 제목 입력" />
                  <InlineError issue={titleIssue} />
                </div>
              ) : null}
              <div className="flex min-w-0 items-start gap-1" data-price-guide-breed-chips="true">
                {renderedStructureField === titleId ? (
                  <span className="inline-flex min-h-11 shrink-0 items-center px-2 text-[16px] font-medium leading-6 text-[#64748b]">요금 :</span>
                ) : (
                  <button id={titleId} type="button" onClick={() => startStructureEdit(titleId)} className="min-h-11 shrink-0 rounded-[8px] px-2 text-left !text-[16px] !font-medium !leading-6 text-[#172033] hover:bg-[#f7f9fc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]">
                    {group.sourceLabel.trim() ? `${groupName} 요금 :` : <span className="text-[#7a8798]">그룹 제목 입력</span>}
                  </button>
                )}
                <button type="button" onClick={() => setBreedDialogGroupIndex(groupIndex)} className="flex min-h-11 min-w-0 flex-1 flex-wrap items-center gap-1.5 rounded-[8px] px-2 py-1.5 text-left !text-[16px] !font-normal !leading-6 hover:bg-[#f7f9fc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]">
                  {group.breedNames.length > 0 ? group.breedNames.map((breed) => <span key={breed} className="inline-flex min-h-8 items-center rounded-full border border-[#dbe2ea] bg-white px-2.5 text-[#334155]">{breed}</span>) : <span className="text-[#7a8798]">품종 선택</span>}
                </button>
                {groups.length > 1 ? <button type="button" onClick={() => { startStructureEdit(null); onChange(removeDirectPriceGuideGroup(guide, groupIndex)); }} aria-label={`${groupName} 요금 분류 삭제`} className={iconButtonClass}><Trash2 className="h-4 w-4" aria-hidden="true" /></button> : null}
              </div>

              <div className="mt-2 max-h-[min(62dvh,680px)] max-w-full overflow-auto overscroll-contain rounded-[10px] border border-[#dbe2ea]" tabIndex={0} aria-label={`${groupName} 인라인 요금표, 좌우와 위아래로 이동할 수 있습니다`} data-price-guide-matrix-scroll="true">
                <table className="w-full border-collapse text-[16px] leading-6 text-[#334155]" style={{ minWidth: tableWidth }}>
                  <thead className="sticky top-0 z-30"><tr className="bg-[#f8fafc] text-left text-[16px] font-medium leading-6 text-[#64748b]">
                    <th className="sticky left-0 top-0 z-40 w-[120px] border-b border-r border-[#dbe2ea] bg-[#f8fafc] px-2 py-3 !font-medium">몸무게</th>
                    {group.serviceNames.map((serviceName, serviceIndex) => {
                      const serviceRowIndex = directPriceGuideRowIndex(groups, groupIndex, 0, serviceIndex);
                      const serviceId = rowInputId(serviceRowIndex, "serviceName");
                      const serviceRowIndexes = group.weightBands.map((_, weightIndex) => directPriceGuideRowIndex(groups, groupIndex, weightIndex, serviceIndex));
                      const durationGroup = durationGroups.find((candidate) => candidate.rowIndexes.includes(serviceRowIndex));
                      const durationTargets = serviceRowIndexes.flatMap((rowIndex, weightIndex) => {
                        const row = guide.rows[rowIndex];
                        return row ? [{ rowIndex, minKg: row.minKg, maxKg: row.maxKg, durationMinutes: row.durationMinutes, label: group.weightBands[weightIndex]?.label }] : [];
                      });
                      return <th key={`service-${serviceIndex}`} className="sticky top-0 z-30 min-w-[210px] border-b border-[#dbe2ea] bg-[#f8fafc] p-1.5 align-top !font-medium">
                        {renderedStructureField === serviceId ? (
                          <div className="flex min-w-[196px] items-start gap-1">
                            <label htmlFor={serviceId} className="sr-only">서비스명</label>
                            <input id={serviceId} autoFocus value={serviceName} onChange={(event) => emit(updateDirectPriceGuideService(guide, groupIndex, serviceIndex, event.target.value), serviceRowIndexes, ["serviceName"])} className={`${inputClass} text-center !font-medium`} placeholder="서비스명 입력" />
                            {group.serviceNames.length > 1 ? <button type="button" onClick={() => { startStructureEdit(null); onChange(removeDirectPriceGuideService(guide, groupIndex, serviceIndex)); }} className={iconButtonClass} aria-label={`${serviceName || `서비스 ${serviceIndex + 1}`} 열 삭제`}><Trash2 className="h-4 w-4" aria-hidden="true" /></button> : null}
                          </div>
                        ) : (
                          <div className="flex min-w-0 items-center gap-1">
                            <button id={serviceId} type="button" onClick={() => startStructureEdit(serviceId)} className="min-h-11 min-w-0 flex-1 rounded-[8px] px-2 text-center !text-[16px] !font-medium !leading-6 text-[#172033] hover:bg-[#f7f9fc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]" aria-label={`${serviceName || `서비스 ${serviceIndex + 1}`} 이름 수정`}>{serviceName || <span className="text-[#7a8798]">서비스명 입력</span>}</button>
                            {durationGroup ? <PriceGuideServiceDurationControl
                              serviceName={durationGroup.serviceName}
                              groupName={groupName}
                              targets={durationTargets}
                              onApply={(updates) => emit(
                                applyWeightDurationUpdates(guide, updates),
                                updates.map((update) => update.rowIndex),
                                ["durationMinutes"],
                              )}
                            /> : null}
                          </div>
                        )}
                      </th>;
                    })}
                  </tr></thead>
                  <tbody>{group.weightBands.map((weightBand, weightIndex) => {
                    const firstWeightRowIndex = directPriceGuideRowIndex(groups, groupIndex, weightIndex, 0);
                    const weightIssue = issues.get(`tableGroups:${groupIndex}.weightBands:${weightIndex}.label`) ?? issues.get(`rows:${firstWeightRowIndex}.maxKg`);
                    const weightLabel = weightBand.label.trim() || directPriceGuideWeightLabel(weightBand.minKg, weightBand.maxKg) || "체급 입력";
                    const minWeightId = rowInputId(firstWeightRowIndex, "minKg");
                    const maxWeightId = rowInputId(firstWeightRowIndex, "maxKg");
                    const weightEditing = [minWeightId, maxWeightId].includes(renderedStructureField ?? "");
                    return <tr key={`weight-${weightIndex}`} className="border-b border-[#edf2f7] last:border-b-0">
                      <th className="sticky left-0 z-20 w-[120px] border-r border-[#dbe2ea] bg-[#fbfcfd] p-1 text-left align-top font-normal">
                        {weightEditing && photoReviewMode ? (
                          <div className="min-w-[122px]" data-price-guide-weight-edit={weightIndex}>
                            <label htmlFor={minWeightId} className="sr-only">몸무게 기준</label>
                            <input id={minWeightId} autoFocus value={weightBand.label} onChange={(event) => emit(updateDirectPriceGuideWeightBandLabel(guide, groupIndex, weightIndex, event.target.value), group.serviceNames.map((_, serviceIndex) => directPriceGuideRowIndex(groups, groupIndex, weightIndex, serviceIndex)), ["minKg", "maxKg", "weightBandLabel"])} className={inputClass} placeholder="예: 4kg" />
                          </div>
                        ) : weightEditing ? (
                          <div className="grid min-w-[146px] grid-cols-2 gap-1" data-price-guide-weight-edit={weightIndex}>
                            <label htmlFor={minWeightId} className="sr-only">체중 하한</label>
                            <input
                              id={minWeightId}
                              autoFocus={renderedStructureField !== maxWeightId}
                              value={weightBand.minKg ?? ""}
                              type="number"
                              min={0}
                              step={0.1}
                              inputMode="decimal"
                              onChange={(event) => emit(updateDirectPriceGuideWeightBand(guide, groupIndex, weightIndex, { minKg: nullableDecimal(event.target.value), maxKg: weightBand.maxKg }), group.serviceNames.map((_, serviceIndex) => directPriceGuideRowIndex(groups, groupIndex, weightIndex, serviceIndex)), ["minKg", "maxKg", "weightBandLabel"])}
                              className={inputClass}
                              placeholder="최소"
                            />
                            <label htmlFor={maxWeightId} className="sr-only">체중 상한</label>
                            <input
                              id={maxWeightId}
                              autoFocus={renderedStructureField === maxWeightId}
                              value={weightBand.maxKg ?? ""}
                              type="number"
                              min={0}
                              step={0.1}
                              inputMode="decimal"
                              onChange={(event) => emit(updateDirectPriceGuideWeightBand(guide, groupIndex, weightIndex, { minKg: weightBand.minKg, maxKg: nullableDecimal(event.target.value) }), group.serviceNames.map((_, serviceIndex) => directPriceGuideRowIndex(groups, groupIndex, weightIndex, serviceIndex)), ["minKg", "maxKg", "weightBandLabel"])}
                              aria-invalid={Boolean(weightIssue)}
                              aria-describedby={weightIssue ? `${weightIssue.inputId}-error` : undefined}
                              className={inputClass}
                              placeholder="최대"
                            />
                            <div className="col-span-2"><InlineError issue={weightIssue} /></div>
                          </div>
                        ) : (
                          <div className="flex min-w-0 items-start gap-1">
                            <button id={minWeightId} type="button" onClick={() => startStructureEdit(minWeightId)} className={`${cellButtonClass} !w-auto min-w-0 flex-1 px-1.5`} data-price-guide-weight-limit={weightBand.maxKg ?? undefined}>
                              {weightLabel}
                              {weightBand.note ? <span className="mt-0.5 block text-[16px] font-normal leading-6 text-[#718096]">{weightBand.note}</span> : null}
                            </button>
                            {group.weightBands.length > 1 ? <button type="button" onClick={() => { if (!window.confirm(`${groupName} ${weightLabel} 체급을 삭제할까요?\n이 몸무게 구간의 모든 서비스 요금이 삭제됩니다.`)) return; startStructureEdit(null); onChange(removeDirectPriceGuideWeightBand(guide, groupIndex, weightIndex)); }} className={iconButtonClass} aria-label={`${groupName} ${weightLabel} 체급 삭제`} data-price-guide-weight-delete={weightIndex}><Trash2 className="h-4 w-4" aria-hidden="true" /></button> : null}
                          </div>
                        )}
                      </th>
                      {group.serviceNames.map((_, serviceIndex) => {
                        const rowIndex = directPriceGuideRowIndex(groups, groupIndex, weightIndex, serviceIndex);
                        const row = group.cells[weightIndex][serviceIndex];
                        const kindId = rowInputId(rowIndex, "priceKind");
                        const minPriceId = rowInputId(rowIndex, "priceMinKrw");
                        const maxPriceId = rowInputId(rowIndex, "priceMaxKrw");
                        const durationId = rowInputId(rowIndex, "durationMinutes");
                        const priceIssue = issues.get(`rows:${rowIndex}.priceKind`) ?? issues.get(`rows:${rowIndex}.priceMinKrw`) ?? issues.get(`rows:${rowIndex}.priceMaxKrw`);
                        const durationIssue = issues.get(`rows:${rowIndex}.durationMinutes`);
                        const priceForceInputId = forcedIssueInputId === kindId
                          ? minPriceId
                          : [minPriceId, maxPriceId].includes(forcedIssueInputId ?? "") ? forcedIssueInputId : undefined;
                        return <td key={`cell-${serviceIndex}`} className="min-w-[210px] p-1 align-top">
                          <PriceDurationInlineCell
                            row={row}
                            rowIndex={rowIndex}
                            priceIssue={priceIssue}
                            durationIssue={durationIssue}
                            forceInputId={renderedStructureField === durationId
                              ? durationId
                              : renderedStructureField === minPriceId
                                ? minPriceId
                                : priceForceInputId}
                            onEditStart={startIndependentCellEdit}
                            onChange={(patch, fields) => emit(updateDirectPriceGuideCell(
                              guide,
                              groupIndex,
                              weightIndex,
                              serviceIndex,
                              photoReviewMode ? patch : { ...patch, priceKind: "fixed", priceMaxKrw: null },
                            ), [rowIndex], photoReviewMode ? fields : [...fields, "priceKind", "priceMaxKrw"])}
                          />
                        </td>;
                      })}
                    </tr>;
                  })}</tbody>
                </table>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={() => { const nextWeightIndex = group.weightBands.length; const next = addDirectPriceGuideWeightBand(guide, groupIndex); const nextGroups = readDirectPriceGuideMatrix(next); onChange(next); if (nextGroups[groupIndex]?.weightBands.length === nextWeightIndex + 1) startStructureEdit(rowInputId(directPriceGuideRowIndex(nextGroups, groupIndex, nextWeightIndex, 0), "minKg")); }} className={actionClass}><Plus className="h-4 w-4" aria-hidden="true" />몸무게</button>
                <button type="button" onClick={() => { const nextServiceIndex = group.serviceNames.length; const next = addDirectPriceGuideService(guide, groupIndex); const nextGroups = readDirectPriceGuideMatrix(next); onChange(next); if (nextGroups[groupIndex]?.serviceNames.length === nextServiceIndex + 1) startStructureEdit(rowInputId(directPriceGuideRowIndex(nextGroups, groupIndex, 0, nextServiceIndex), "serviceName")); }} className={actionClass}><Plus className="h-4 w-4" aria-hidden="true" />서비스</button>
              </div>
            </section>
          );
        })}
      </div>

      {visibleGroupIndex === undefined && !extrasOnly ? (
        <button id="price-guide-add-row" type="button" onClick={() => { const nextGroupIndex = groups.length; onChange(addDirectPriceGuideGroup(guide)); startStructureEdit(`price-guide-direct-group-${nextGroupIndex}-sourceLabel`); }} className={`mt-4 ${actionClass}`}><Plus className="h-4 w-4" aria-hidden="true" />그룹</button>
      ) : null}

      {visibleGroupIndex === undefined ? (
        <PriceGuideNativeInlineExtras
          document={guide}
          onChange={onChange}
          activeField={activeStructureField}
          setActiveField={startStructureEdit}
          validationIssues={validationIssues}
        />
      ) : null}

      {visibleGroupIndex === undefined && !extrasOnly && preservedRows.length > 0 ? (
        <details className="mt-4 rounded-[10px] border border-[#e3e8ef] bg-[#fbfcfd] px-4 py-3" data-price-guide-preserved-review="true">
          <summary className="min-h-11 cursor-pointer py-2 text-[16px] font-medium leading-6 text-[#42536a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]">
            표에 배치되지 않은 기존 항목 {preservedRows.length}개 보존됨
          </summary>
          <ul className="mt-2 space-y-1 text-[16px] font-normal leading-6 text-[#475569]">
            {preservedRows.map((row, index) => <li key={row.sourceItemId ?? `preserved-${index}`}>· {row.serviceName ?? "서비스명 확인 필요"} · {compactPriceDurationLabel(row)}</li>)}
          </ul>
        </details>
      ) : null}

      {breedDialogGroupIndex !== null && groups[breedDialogGroupIndex] ? (
        <BreedManagementDialog
          initialBreeds={groups[breedDialogGroupIndex].breedNames}
          unavailableBreeds={groups.flatMap((group, index) => index === breedDialogGroupIndex ? [] : group.breedNames)}
          onClose={() => setBreedDialogGroupIndex(null)}
          onSave={(breedNames) => {
            const groupIndex = breedDialogGroupIndex;
            emit(updateDirectPriceGuideGroup(guide, groupIndex, { breedNames }), groupRowIndexes(groupIndex), ["breedNames"]);
            setBreedDialogGroupIndex(null);
          }}
        />
      ) : null}
    </div>
  );
}
