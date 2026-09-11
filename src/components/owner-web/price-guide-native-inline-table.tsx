"use client";

import { Clock3, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import {
  addDirectPriceGuideGroup,
  addDirectPriceGuideService,
  directPriceGuideRowIndex,
  directPriceGuideWeightLabel,
  readDirectPriceGuideMatrix,
  removeDirectPriceGuideGroup,
  removeDirectPriceGuideService,
  updateDirectPriceGuideCell,
  updateDirectPriceGuideGroup,
  updateDirectPriceGuideService,
} from "@/lib/price-guide-direct-matrix";
import { priceGuideDisplayGroupLabel } from "@/lib/price-guide-structured-table";
import {
  applyConfirmedDurationToService,
  groupPriceGuideRowsByServiceDuration,
  isConfirmedPriceGuideDuration,
  PRICE_GUIDE_DURATION_QUICK_OPTIONS,
} from "@/lib/price-guide-duration-confirmation";
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

const inputClass = "h-11 min-w-0 w-full rounded-[8px] border border-[#cbd5e1] bg-white px-2.5 text-[16px] font-normal leading-6 text-[#172033] outline-none placeholder:text-[#94a3b8] focus-visible:border-[#2563eb] focus-visible:ring-2 focus-visible:ring-[#2563eb]/20";
const cellButtonClass = "min-h-11 w-full min-w-0 rounded-[8px] px-2.5 py-2 text-left text-[14px] font-normal leading-5 text-[#334155] hover:bg-[#f7f9fc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]";
const actionClass = "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[8px] border border-[#cbd5e1] bg-white px-3 text-[13px] font-medium leading-5 text-[#42536a] hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2";
const iconButtonClass = "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] text-[#64748b] hover:bg-[#f1f5f9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2";

function nullableInteger(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) : null;
}

function rowInputId(rowIndex: number, field: keyof PriceGuideV2Row) {
  return `price-guide-row-${rowIndex}-${field}`;
}

function InlineError({ issue }: { issue?: ValidationIssue }) {
  return issue ? <p id={`${issue.inputId}-error`} className="mt-1 text-[12px] font-medium leading-[18px] text-[#a04455]">{issue.message}</p> : null;
}

function priceLabel(row: PriceGuideV2Row) {
  if (row.priceMinKrw === null) return "가격 입력";
  if (row.priceKind === "range") {
    return row.priceMaxKrw === null
      ? `${row.priceMinKrw.toLocaleString("ko-KR")}원 ~`
      : `${row.priceMinKrw.toLocaleString("ko-KR")}~${row.priceMaxKrw.toLocaleString("ko-KR")}원`;
  }
  return `${row.priceMinKrw.toLocaleString("ko-KR")}${row.priceKind === "starting" ? "원부터" : "원"}`;
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
            <label htmlFor={minPriceId} className="sr-only">금액</label>
            <input
              id={minPriceId}
              autoFocus={forceInputId !== durationId && forceInputId !== maxPriceId}
              value={row.priceMinKrw ?? ""}
              inputMode="numeric"
              onChange={(event) => onChange({ priceMinKrw: nullableInteger(event.target.value) }, ["priceMinKrw"])}
              aria-invalid={Boolean(priceIssue)}
              aria-describedby={priceIssue ? `${priceIssue.inputId}-error` : undefined}
              className={`${inputClass} tabular-nums`}
              placeholder={row.priceKind === "range" ? "최소" : "금액"}
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
              placeholder="분"
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
        >
          <span className={`font-medium tabular-nums ${row.priceMinKrw === null || row.durationMinutes === null ? "text-[#7a8798]" : "text-[#172033]"}`}>
            {priceLabel(row)} / {row.durationMinutes === null ? "시간 입력" : `${row.durationMinutes}분`}
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
}: {
  document: PriceGuideV2;
  onChange: (next: PriceGuideV2) => void;
  validationIssues: ValidationIssue[];
  heading?: string;
  photoReviewMode?: boolean;
  focusFirstMissingDuration?: boolean;
}) {
  const [activeStructureField, setActiveStructureField] = useState<string | null>(null);
  const [dismissedIssueInputId, setDismissedIssueInputId] = useState<string | null>(null);
  const [customDurations, setCustomDurations] = useState<Record<string, string>>({});
  const groups = readDirectPriceGuideMatrix(guide);
  const durationGroups = groupPriceGuideRowsByServiceDuration(guide);
  const unresolvedDurationGroups = durationGroups.filter((group) => group.unresolvedCount > 0);
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
      data-price-guide-fixed-price-ui="true"
      onFocusCapture={(event) => {
        if (["INPUT", "SELECT", "TEXTAREA"].includes(event.target.tagName) && event.target.id) {
          const inputId = event.target.id;
          if (!inputId.endsWith("-priceMinKrw") && !inputId.endsWith("-priceMaxKrw") && !inputId.endsWith("-durationMinutes")) {
            setActiveStructureField(inputId);
          }
        }
      }}
    >
      <header className="border-b border-[#e2e8f0] pb-4">
        <h2 className="text-[20px] font-semibold leading-7 tracking-[-0.015em] text-[#172033]">{heading}</h2>
        <p className="mt-1 text-[14px] font-normal leading-5 text-[#64748b]">바꿀 칸을 누르면 그 자리에서 입력할 수 있어요. 저장 버튼을 누르기 전에는 반영되지 않습니다.</p>
      </header>
      {firstMissingDurationInputId ? (
        <section className="mt-4 rounded-[10px] border border-[#dbe7f7] bg-[#f7faff] px-4 py-3" data-price-guide-average-time-notice="true">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-[#2563eb]" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[14px] font-semibold leading-5 text-[#23395b]">서비스별 평균 시간을 확인해 주세요</p>
                <p className="mt-0.5 text-[12px] font-normal leading-[18px] text-[#607080]">한 번 선택하면 같은 서비스의 모든 체급에 적용됩니다. 체급별 예외는 표에서 따로 바꿀 수 있어요.</p>
                <p className="mt-0.5 text-[12px] font-normal leading-[18px] text-[#607080]">완료 기록이 3건 이상 쌓이면 추천으로만 보여 드리며, 적용하기 전에는 예약 시간에 사용하지 않습니다.</p>
              </div>
            </div>
            <p className="text-[12px] font-medium leading-5 text-[#52657a]" aria-live="polite">
              시간 확정 {durationGroups.length - unresolvedDurationGroups.length}개 · 확인 필요 {unresolvedDurationGroups.length}개
            </p>
          </div>
          <div className="mt-3 grid gap-2" data-price-guide-service-duration-groups="true">
            {unresolvedDurationGroups.map((durationGroup) => {
              const directValue = customDurations[durationGroup.key] ?? "";
              const directMinutes = Number(directValue);
              const quickOptions = Array.from(new Set([
                ...durationGroup.confirmedDurations,
                ...PRICE_GUIDE_DURATION_QUICK_OPTIONS,
              ])).sort((left, right) => left - right);
              const directInputId = `price-guide-service-duration-${durationGroup.rowIndexes[0]}`;
              const applyDuration = (durationMinutes: number) => {
                if (!isConfirmedPriceGuideDuration(durationMinutes)) return;
                emit(
                  applyConfirmedDurationToService(guide, durationGroup.serviceName, durationMinutes),
                  durationGroup.rowIndexes,
                  ["durationMinutes"],
                );
              };
              return (
                <div key={durationGroup.key} className="rounded-[8px] border border-[#dbe2ea] bg-white p-2.5" data-price-guide-service-duration={durationGroup.key}>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="min-w-[120px] flex-1 text-[13px] font-medium leading-5 text-[#334155]">{durationGroup.serviceName}</p>
                    {quickOptions.map((minutes) => (
                      <button key={minutes} type="button" onClick={() => applyDuration(minutes)} className={actionClass}>
                        {durationGroup.confirmedDurations.includes(minutes) ? `기존 ${minutes}분` : `${minutes}분`}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <label htmlFor={directInputId} className="text-[12px] font-medium text-[#607080]">직접 입력</label>
                    <input
                      id={directInputId}
                      type="number"
                      min={15}
                      max={480}
                      step={1}
                      inputMode="numeric"
                      value={directValue}
                      onChange={(event) => setCustomDurations((current) => ({ ...current, [durationGroup.key]: event.target.value }))}
                      className={`${inputClass} w-28`}
                      placeholder="15~480분"
                    />
                    <button type="button" disabled={!isConfirmedPriceGuideDuration(directMinutes)} onClick={() => applyDuration(directMinutes)} className={`${actionClass} disabled:cursor-not-allowed disabled:opacity-50`}>전체 체급에 적용</button>
                  </div>
                </div>
              );
            })}
          </div>
          <button type="button" onClick={() => setActiveStructureField(firstMissingDurationInputId)} className={`mt-3 ${actionClass}`}>첫 확인 항목으로 이동</button>
        </section>
      ) : null}
      {validationIssues.length > 0 ? (
        <p role="alert" className="mt-4 rounded-[10px] border border-[#ecd6d1] bg-[#fff7f5] px-4 py-3 text-[13px] font-medium leading-5 text-[#a04455]">{validationIssues[0].message}</p>
      ) : null}

      <div className="mt-4 space-y-3">
        {groups.map((group, groupIndex) => {
          const rowIndexes = groupRowIndexes(groupIndex);
          const groupName = priceGuideDisplayGroupLabel(group.sourceLabel.trim()) || `그룹 ${groupIndex + 1}`;
          const titleId = `price-guide-direct-group-${groupIndex}-sourceLabel`;
          const breedsId = `price-guide-group-${groupIndex}-breedNames`;
          const titleIssue = issues.get(`tableGroups:${groupIndex}.sourceLabel`);
          const tableWidth = Math.max(620, 160 + group.serviceNames.length * 210 + 88);
          return (
            <section key={`group-${groupIndex}`} className="min-w-0 rounded-[12px] border border-[#dbe2ea] bg-white p-3" data-native-price-guide-group={groupIndex}>
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {renderedStructureField === titleId ? (
                    <div>
                      <label htmlFor={titleId} className="sr-only">그룹 제목</label>
                      <input id={titleId} autoFocus value={group.sourceLabel.trim() ? groupName : ""} onChange={(event) => emit(updateDirectPriceGuideGroup(guide, groupIndex, { sourceLabel: event.target.value }), rowIndexes, ["breedGroup"])} aria-invalid={Boolean(titleIssue)} aria-describedby={titleIssue ? `${titleId}-error` : undefined} className={`${inputClass} max-w-lg font-semibold`} placeholder="그룹 제목 입력" />
                      <InlineError issue={titleIssue} />
                    </div>
                  ) : (
                    <button id={titleId} type="button" onClick={() => startStructureEdit(titleId)} className="min-h-11 max-w-full rounded-[8px] px-2 text-left text-[18px] font-semibold leading-[26px] text-[#172033] hover:bg-[#f7f9fc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]">
                      {group.sourceLabel.trim() ? groupName : <span className="text-[#7a8798]">그룹 제목 입력</span>}
                    </button>
                  )}
                </div>
                {groups.length > 1 ? <button type="button" onClick={() => { startStructureEdit(null); onChange(removeDirectPriceGuideGroup(guide, groupIndex)); }} aria-label={`${groupName} 그룹 삭제`} className={iconButtonClass}><Trash2 className="h-4 w-4" aria-hidden="true" /></button> : null}
              </div>

              {renderedStructureField === breedsId ? (
                <div className="mt-2"><label htmlFor={breedsId} className="sr-only">포함 품종</label><input id={breedsId} autoFocus value={group.breedNames.join(", ")} onChange={(event) => emit(updateDirectPriceGuideGroup(guide, groupIndex, { breedNames: event.target.value.split(",").map((breed) => breed.trim()).filter(Boolean) }), rowIndexes, ["breedNames"])} className={inputClass} placeholder="품종 입력(쉼표로 구분)" /></div>
              ) : <button id={breedsId} type="button" onClick={() => startStructureEdit(breedsId)} className={`mt-1 flex min-h-11 w-full flex-wrap items-center gap-1.5 rounded-[8px] px-2 py-1.5 text-left text-[13px] font-normal leading-5 hover:bg-[#f7f9fc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]`} data-price-guide-breed-chips="true"><span className="mr-0.5 text-[#64748b]">품종</span>{group.breedNames.length > 0 ? group.breedNames.map((breed) => <span key={breed} className="inline-flex min-h-8 items-center rounded-full border border-[#dbe2ea] bg-white px-2.5 text-[#334155]">{breed}</span>) : <span className="text-[#7a8798]">눌러서 품종 입력</span>}</button>}

              <div className="mt-2 max-h-[min(62dvh,680px)] max-w-full overflow-auto overscroll-contain rounded-[10px] border border-[#dbe2ea]" tabIndex={0} aria-label={`${groupName} 인라인 요금표, 좌우와 위아래로 이동할 수 있습니다`} data-price-guide-matrix-scroll="true">
                <table className="border-collapse text-[13px] leading-5 text-[#334155]" style={{ minWidth: tableWidth }}>
                  <thead className="sticky top-0 z-30"><tr className="bg-[#f8fafc] text-left text-[12px] font-medium leading-[18px] text-[#64748b]">
                    <th className="sticky left-0 top-0 z-40 w-[160px] border-b border-r border-[#dbe2ea] bg-[#f8fafc] px-3 py-3">체중 상한</th>
                    {group.serviceNames.map((serviceName, serviceIndex) => {
                      const serviceRowIndex = directPriceGuideRowIndex(groups, groupIndex, 0, serviceIndex);
                      const serviceId = rowInputId(serviceRowIndex, "serviceName");
                      const serviceIssue = issues.get(`rows:${serviceRowIndex}.serviceName`);
                      return <th key={`service-${serviceIndex}`} className="sticky top-0 z-30 min-w-[210px] border-b border-[#dbe2ea] bg-[#f8fafc] p-1.5 align-top">
                        {renderedStructureField === serviceId ? <div><label htmlFor={serviceId} className="sr-only">서비스 항목 {serviceIndex + 1}</label><input id={serviceId} autoFocus value={serviceName} onChange={(event) => emit(updateDirectPriceGuideService(guide, groupIndex, serviceIndex, event.target.value), group.weightBands.map((_, weightIndex) => directPriceGuideRowIndex(groups, groupIndex, weightIndex, serviceIndex)), ["serviceName"])} aria-invalid={Boolean(serviceIssue)} aria-describedby={serviceIssue ? `${serviceId}-error` : undefined} className={`${inputClass} font-medium`} placeholder="항목명 입력" /><InlineError issue={serviceIssue} /></div> : <button id={serviceId} type="button" onClick={() => startStructureEdit(serviceId)} className={`${cellButtonClass} font-medium text-[#172033]`}>{serviceName || <span className="text-[#7a8798]">항목명 입력</span>}</button>}
                        {group.serviceNames.length > 1 ? <button type="button" onClick={() => { startStructureEdit(null); onChange(removeDirectPriceGuideService(guide, groupIndex, serviceIndex)); }} className="mt-1 inline-flex min-h-11 items-center gap-1 rounded-[8px] px-2 text-[12px] font-medium text-[#64748b] hover:bg-[#eef2f6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]" aria-label={`${groupName} ${serviceName || `항목 ${serviceIndex + 1}`} 삭제`}><Trash2 className="h-3.5 w-3.5" aria-hidden="true" />삭제</button> : null}
                      </th>;
                    })}
                    <th className="w-[88px] border-b border-l border-[#dbe2ea] p-1.5 align-top"><button type="button" onClick={() => { const nextIndex = group.serviceNames.length; const next = addDirectPriceGuideService(guide, groupIndex); onChange(next); startStructureEdit(rowInputId(directPriceGuideRowIndex(readDirectPriceGuideMatrix(next), groupIndex, 0, nextIndex), "serviceName")); }} className={actionClass}><Plus className="h-4 w-4" aria-hidden="true" />항목</button></th>
                  </tr></thead>
                  <tbody>{group.weightBands.map((weightBand, weightIndex) => {
                    const firstWeightRowIndex = directPriceGuideRowIndex(groups, groupIndex, weightIndex, 0);
                    const weightIssue = issues.get(`tableGroups:${groupIndex}.weightBands:${weightIndex}.label`) ?? issues.get(`rows:${firstWeightRowIndex}.maxKg`);
                    const weightLabel = weightBand.label.trim() || directPriceGuideWeightLabel(weightBand.minKg, weightBand.maxKg) || "체급 입력";
                    return <tr key={`weight-${weightIndex}`} className="border-b border-[#edf2f7] last:border-b-0">
                      <th className="sticky left-0 z-20 border-r border-[#dbe2ea] bg-[#fbfcfd] p-1.5 text-left align-top font-normal">
                        <div className="min-h-11 px-2.5 py-2 text-[14px] font-medium leading-5 text-[#334155]" data-price-guide-weight-limit={weightBand.maxKg ?? undefined}>
                          {weightLabel}
                          {weightBand.note ? <span className="mt-0.5 block text-[12px] font-normal leading-[18px] text-[#718096]">{weightBand.note}</span> : null}
                        </div>
                        <InlineError issue={weightIssue} />
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
                            forceInputId={renderedStructureField === durationId ? durationId : priceForceInputId}
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
                      <td className="border-l border-[#edf2f7]" aria-hidden="true" />
                    </tr>;
                  })}</tbody>
                </table>
              </div>
            </section>
          );
        })}
      </div>

      <button id="price-guide-add-row" type="button" onClick={() => { const nextGroupIndex = groups.length; onChange(addDirectPriceGuideGroup(guide)); startStructureEdit(`price-guide-direct-group-${nextGroupIndex}-sourceLabel`); }} className={`mt-4 ${actionClass}`}><Plus className="h-4 w-4" aria-hidden="true" />그룹</button>
    </div>
  );
}
