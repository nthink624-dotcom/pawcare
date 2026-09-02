"use client";

import { Check, PencilLine, ShieldCheck, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  validatePriceGuideDocument,
  type PriceGuideValidationIssue,
} from "@/components/auth/signup-price-guide-editor";
import {
  resolvePriceGuideV2Reviews,
  type PriceGuideV2,
  type PriceGuideV2Row,
  type PriceGuideV2Surcharge,
} from "@/types/price-guide-photo-import";

type MatrixGroup = {
  key: string;
  label: string;
  breeds: string[];
  weights: string[];
  services: string[];
  rowIndexes: number[];
  rows: PriceGuideV2Row[];
};

const sizeLabels: Record<PriceGuideV2Row["sizeClass"], string> = {
  small: "소형견",
  medium: "중형견",
  large: "대형견",
  "extra-large": "초대형견",
  all: "전체 체급",
  unknown: "체급 확인 필요",
};

const speciesLabels: Record<PriceGuideV2Row["species"], string> = {
  dog: "강아지",
  cat: "고양이",
  all: "강아지·고양이 공통",
  unknown: "확인 필요",
};

const priceKindLabels: Record<PriceGuideV2Row["priceKind"], string> = {
  fixed: "정가",
  starting: "시작가",
  range: "가격 범위",
  unknown: "확인 필요",
};

export function isFixedManualPriceGuideDocument(document: PriceGuideV2) {
  return document.source === "manual" && document.rows.every((row) => row.priceKind === "fixed");
}

function weightLabel(row: PriceGuideV2Row) {
  if (row.minKg !== null && row.maxKg !== null) return `${row.minKg}~${row.maxKg}kg`;
  if (row.maxKg !== null) return `${row.maxKg}kg 이하`;
  if (row.minKg !== null) return `${row.minKg}kg 이상`;
  return "몸무게 공통";
}

function serviceLabel(row: PriceGuideV2Row) {
  return row.serviceName?.trim() || "서비스명 확인 필요";
}

function priceLabel(row: PriceGuideV2Row) {
  if (row.priceMinKrw === null || row.priceKind === "unknown") return "가격 확인 필요";
  if (row.priceKind === "range") {
    return row.priceMaxKrw === null
      ? "가격 범위 확인 필요"
      : `${row.priceMinKrw.toLocaleString("ko-KR")}~${row.priceMaxKrw.toLocaleString("ko-KR")}원`;
  }
  const suffix = row.priceKind === "starting" ? "원부터" : "원";
  return `${row.priceMinKrw.toLocaleString("ko-KR")}${suffix}`;
}

function buildMatrixGroups(document: PriceGuideV2): MatrixGroup[] {
  const groups = new Map<string, MatrixGroup>();
  document.rows.forEach((row, rowIndex) => {
    const label = row.breedGroup?.trim() || sizeLabels[row.sizeClass];
    const bucketKey = `${row.species}:${label}`;
    const group = groups.get(bucketKey) ?? {
      key: `rows:${rowIndex}`,
      label,
      breeds: [],
      weights: [],
      services: [],
      rowIndexes: [],
      rows: [],
    };
    const weight = weightLabel(row);
    const service = serviceLabel(row);
    group.rowIndexes.push(rowIndex);
    group.rows.push(row);
    group.breeds = [...new Set([...group.breeds, ...row.breedNames])];
    if (!group.weights.includes(weight)) group.weights.push(weight);
    if (!group.services.includes(service)) group.services.push(service);
    groups.set(bucketKey, group);
  });
  return [...groups.values()];
}

function MatrixGroupCard({ group, onEdit }: { group: MatrixGroup; onEdit: () => void }) {
  return (
    <section className="min-w-0 rounded-[14px] border border-[#dbe2ea] bg-white p-4" data-price-guide-matrix-group={group.label}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="text-[18px] font-semibold leading-[26px] text-[#172033]">{group.label}</h3>
          <span className="text-[12px] font-medium leading-[18px] text-[#64748b]">등록 품종 {group.breeds.length}개</span>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-[8px] border border-[#cbd5e1] bg-white px-4 text-[14px] font-medium text-[#334155] transition hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2"
        >
          <PencilLine className="h-4 w-4" aria-hidden="true" />
          이 그룹 편집
        </button>
      </div>
      <div className="mt-3 flex min-h-11 flex-wrap items-center gap-2 rounded-[10px] bg-[#f8fafc] px-3 py-2">
        {group.breeds.length > 0 ? group.breeds.map((breed) => (
          <span key={breed} className="rounded-full border border-[#dbe2ea] bg-white px-3 py-1.5 text-[12px] font-medium leading-[18px] text-[#475569]">{breed}</span>
        )) : <span className="text-[13px] font-normal leading-5 text-[#64748b]">포함 품종이 지정되지 않았습니다.</span>}
      </div>
      <p className="mt-3 text-right text-[12px] font-normal leading-[18px] text-[#64748b]">가격 / 예상 시간</p>
      <div className="mt-1 max-w-full overflow-x-auto rounded-[10px] border border-[#dbe2ea]" tabIndex={0} aria-label={`${group.label} 요금표, 좌우로 이동할 수 있습니다`}>
        <table className="w-full min-w-[620px] border-collapse text-[14px] leading-5 text-[#334155]">
          <thead>
            <tr className="bg-[#f8fafc] text-left text-[12px] font-medium leading-[18px] text-[#64748b]">
              <th className="w-28 border-b border-r border-[#dbe2ea] px-3 py-2.5">체급·조건</th>
              {group.services.map((service) => <th key={service} className="border-b border-[#dbe2ea] px-3 py-2.5">{service}</th>)}
            </tr>
          </thead>
          <tbody>
            {group.weights.map((weight) => (
              <tr key={weight} className="border-b border-[#edf2f7] last:border-b-0">
                <th className="whitespace-nowrap border-r border-[#dbe2ea] bg-[#fbfcfd] px-3 py-2.5 text-left font-medium text-[#334155]">{weight}</th>
                {group.services.map((service) => {
                  const row = group.rows.find((candidate) => weightLabel(candidate) === weight && serviceLabel(candidate) === service);
                  return (
                    <td key={service} className="px-3 py-2.5 align-middle">
                      {row ? (
                        <p className="whitespace-nowrap text-[14px] leading-5 tabular-nums">
                          <span className="font-medium text-[#172033]">{priceLabel(row)}</span>
                          <span className="font-normal text-[#64748b]"> / {row.durationMinutes === null ? "시간 확인 필요" : `${row.durationMinutes}분`}</span>
                        </p>
                      ) : <span className="text-[#94a3b8]">-</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function digitsOnly(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) : null;
}

function EditableMatrixGroup({
  document,
  group,
  onChange,
  onCancel,
  onSave,
  saving,
  validationIssues,
  manualMatrixMode = false,
}: {
  document: PriceGuideV2;
  group: MatrixGroup;
  onChange: (next: PriceGuideV2) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  validationIssues: PriceGuideValidationIssue[];
  manualMatrixMode?: boolean;
}) {
  const pendingReviews = document.aiReview.filter((review) => {
    const match = /^rows:(\d+)$/.exec(review.targetId);
    return match
      && group.rowIndexes.includes(Number(match[1]))
      && !review.userConfirmed
      && !review.userCorrected;
  });

  function updateRows(rowIndexes: number[], update: (row: PriceGuideV2Row) => PriceGuideV2Row) {
    onChange({
      ...document,
      source: document.source === "manual" ? "manual" : "owner_corrected",
      rows: document.rows.map((row, rowIndex) => rowIndexes.includes(rowIndex) ? update(row) : row),
    });
  }

  function updateRow(rowIndex: number, field: "priceMinKrw" | "priceMaxKrw" | "durationMinutes", value: string) {
    const numeric = digitsOnly(value);
    const targetId = `rows:${rowIndex}`;
    const next: PriceGuideV2 = {
      ...document,
      source: document.source === "manual" ? "manual" : "owner_corrected",
      rows: document.rows.map((row, index) => {
        if (index !== rowIndex) return row;
        if (field === "durationMinutes") return { ...row, durationMinutes: numeric };
        if (field === "priceMaxKrw") return { ...row, priceMaxKrw: numeric };
        return {
          ...row,
          priceKind: numeric === null ? "unknown" : row.priceKind === "unknown" ? "fixed" : row.priceKind,
          priceMinKrw: numeric,
          priceMaxKrw: row.priceKind === "fixed" || row.priceKind === "unknown" ? null : row.priceMaxKrw,
        };
      }),
    };
    onChange(resolvePriceGuideV2Reviews(next, (review) => review.targetId === targetId && review.field === field, "corrected"));
  }

  function updateServiceName(service: string, value: string) {
    const rowIndexes = group.rowIndexes.filter((rowIndex) => serviceLabel(document.rows[rowIndex]) === service);
    updateRows(rowIndexes, (row) => ({ ...row, serviceName: value.trim() || null }));
  }

  function updateSpecies(value: PriceGuideV2Row["species"]) {
    const targetId = `rows:${group.rowIndexes[0]}`;
    const next: PriceGuideV2 = {
      ...document,
      source: document.source === "manual" ? "manual" : "owner_corrected",
      rows: document.rows.map((row, rowIndex) => group.rowIndexes.includes(rowIndex) ? { ...row, species: value } : row),
    };
    onChange(resolvePriceGuideV2Reviews(next, (review) => review.targetId === targetId && review.field === "species", "corrected"));
  }

  function updatePriceKind(rowIndex: number, value: PriceGuideV2Row["priceKind"]) {
    const targetId = `rows:${rowIndex}`;
    const next: PriceGuideV2 = {
      ...document,
      source: document.source === "manual" ? "manual" : "owner_corrected",
      rows: document.rows.map((row, index) => {
        if (index !== rowIndex) return row;
        if (value === "unknown") return { ...row, priceKind: value, priceMinKrw: null, priceMaxKrw: null };
        return { ...row, priceKind: value, priceMaxKrw: value === "range" ? row.priceMaxKrw : null };
      }),
    };
    onChange(resolvePriceGuideV2Reviews(next, (review) => review.targetId === targetId && review.field === "priceKind", "corrected"));
  }

  function fieldIssue(rowIndex: number, field: string) {
    return validationIssues.find((issue) => issue.key === `rows:${rowIndex}.${field}`);
  }

  const groupSpeciesIssue = group.rowIndexes
    .map((rowIndex) => fieldIssue(rowIndex, "species"))
    .find(Boolean);
  const unresolved = validationIssues.length > 0;

  return (
    <section className="min-w-0 rounded-[14px] border border-[#9fb0c5] bg-white p-4" data-price-guide-matrix-editor={group.label}>
      {unresolved ? <p role="alert" className="mb-3 rounded-[10px] border border-[#ead7ae] bg-[#fff9ec] px-3 py-2.5 text-[13px] font-medium leading-5 text-[#765617]">저장하려면 아래 항목을 확인해 주세요.</p> : null}
      <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_180px_180px]">
        <label className="min-w-0 text-[14px] font-medium leading-5 text-[#607080]">
          그룹명
          <input
            value={group.label}
            onChange={(event) => updateRows(group.rowIndexes, (row) => ({ ...row, breedGroup: event.target.value.trim() || null }))}
            className="mt-1.5 h-11 w-full rounded-[9px] border border-[#cbd5e1] bg-white px-3 text-[14px] font-medium text-[#172033] outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
          />
        </label>
        <label className="min-w-0 text-[14px] font-medium leading-5 text-[#607080]">
          체급
          <select
            value={document.rows[group.rowIndexes[0]]?.sizeClass ?? "unknown"}
            onChange={(event) => updateRows(group.rowIndexes, (row) => ({ ...row, sizeClass: event.target.value as PriceGuideV2Row["sizeClass"] }))}
            className="mt-1.5 h-11 w-full rounded-[9px] border border-[#cbd5e1] bg-white px-3 text-[14px] font-medium text-[#172033] outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
          >
            {Object.entries(sizeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="min-w-0 text-[14px] font-medium leading-5 text-[#607080]">
          대상 동물
          <select
            id={`price-guide-row-${group.rowIndexes[0]}-species`}
            value={document.rows[group.rowIndexes[0]]?.species ?? "unknown"}
            onChange={(event) => updateSpecies(event.target.value as PriceGuideV2Row["species"])}
            aria-describedby={groupSpeciesIssue ? `price-guide-row-${group.rowIndexes[0]}-species-error` : undefined}
            className="mt-1.5 h-11 w-full rounded-[9px] border border-[#cbd5e1] bg-white px-3 text-[14px] font-medium text-[#172033] outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
          >
            {Object.entries(speciesLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          {groupSpeciesIssue ? <p id={`price-guide-row-${group.rowIndexes[0]}-species-error`} className="mt-1.5 text-[13px] font-medium leading-5 text-[#a04455]">{groupSpeciesIssue.message}</p> : null}
        </label>
      </div>
      <label className="mt-3 block min-w-0 text-[14px] font-medium leading-5 text-[#607080]">
        포함 품종 (쉼표로 구분)
        <input
          value={group.breeds.join(", ")}
          onChange={(event) => {
            const breeds = event.target.value.split(",").map((breed) => breed.trim()).filter(Boolean);
            updateRows(group.rowIndexes, (row) => ({ ...row, breedNames: breeds }));
          }}
          className="mt-1.5 h-11 w-full rounded-[9px] border border-[#cbd5e1] bg-white px-3 text-[14px] font-normal text-[#172033] outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
        />
      </label>

      {manualMatrixMode ? <p className="mt-3 text-right text-[13px] font-medium leading-5 text-[#607080]">가격 / 예상 시간</p> : null}
      <div className="mt-4 max-w-full overflow-x-auto rounded-[10px] border border-[#dbe2ea]" tabIndex={0} aria-label={`${group.label} 요금표 편집, 좌우로 이동할 수 있습니다`}>
        <table className="w-full min-w-[760px] border-collapse text-[14px] leading-5 text-[#334155]">
          <thead>
            <tr className="bg-[#f8fafc] text-left text-[12px] font-medium leading-[18px] text-[#64748b]">
              <th className="w-28 border-b border-r border-[#dbe2ea] px-3 py-3">체급·조건</th>
              {group.services.map((service) => {
                const firstRowIndex = group.rowIndexes.find((rowIndex) => serviceLabel(document.rows[rowIndex]) === service) ?? group.rowIndexes[0];
                return (
                  <th key={service} className="min-w-40 border-b border-[#dbe2ea] px-2 py-2">
                    <input
                      id={`price-guide-row-${firstRowIndex}-serviceName`}
                      value={service === "서비스명 확인 필요" ? "" : service}
                      onChange={(event) => updateServiceName(service, event.target.value)}
                      aria-label={`${group.label} 서비스명`}
                      className="h-11 w-full rounded-[8px] border border-[#cbd5e1] bg-white px-2.5 text-[13px] font-medium text-[#172033] outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
                    />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {group.weights.map((weight) => (
              <tr key={weight} className="border-b border-[#edf2f7] last:border-b-0">
                <th className="whitespace-nowrap border-r border-[#dbe2ea] bg-[#fbfcfd] px-3 py-3 text-left font-medium text-[#334155]">{weight}</th>
                {group.services.map((service) => {
                  const rowIndex = group.rowIndexes.find((index) => weightLabel(document.rows[index]) === weight && serviceLabel(document.rows[index]) === service);
                  const row = rowIndex === undefined ? null : document.rows[rowIndex];
                  return (
                    <td key={service} className="px-2 py-2 align-top">
                      {row && rowIndex !== undefined ? (
                        manualMatrixMode ? (
                          <div className="min-w-[282px]" data-price-guide-manual-cell={`${rowIndex}`}>
                            <div className="flex items-center gap-1.5">
                              <div className="relative min-w-0 flex-1">
                                <input
                                  id={`price-guide-row-${rowIndex}-priceMinKrw`}
                                  value={row.priceMinKrw?.toLocaleString("ko-KR") ?? ""}
                                  onChange={(event) => updateRow(rowIndex, "priceMinKrw", event.target.value)}
                                  inputMode="numeric"
                                  aria-label={`${weight} ${service} 가격`}
                                  placeholder="가격"
                                  className="h-11 w-full rounded-[8px] border border-[#cbd5e1] bg-white px-2.5 pr-7 text-right text-[16px] font-normal leading-6 tabular-nums text-[#172033] outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
                                  style={{ fontSize: "16px", lineHeight: "24px", fontVariantNumeric: "tabular-nums" }}
                                />
                                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-[#64748b]">원</span>
                              </div>
                              <span className="shrink-0 text-[14px] leading-5 text-[#94a3b8]" aria-hidden="true">/</span>
                              <div className="relative min-w-0 flex-1">
                                <input
                                  id={`price-guide-row-${rowIndex}-durationMinutes`}
                                  value={row.durationMinutes ?? ""}
                                  onChange={(event) => updateRow(rowIndex, "durationMinutes", event.target.value)}
                                  inputMode="numeric"
                                  aria-label={`${weight} ${service} 예상 시간`}
                                  placeholder="예상 시간"
                                  className="h-11 w-full rounded-[8px] border border-[#cbd5e1] bg-white px-2.5 pr-7 text-right text-[16px] font-normal leading-6 tabular-nums text-[#172033] outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
                                  style={{ fontSize: "16px", lineHeight: "24px", fontVariantNumeric: "tabular-nums" }}
                                />
                                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-[#64748b]">분</span>
                              </div>
                            </div>
                            {fieldIssue(rowIndex, "priceMinKrw") ? <p id={`price-guide-row-${rowIndex}-priceMinKrw-error`} className="mt-1.5 text-[13px] font-medium leading-5 text-[#a04455]">{fieldIssue(rowIndex, "priceMinKrw")?.message}</p> : null}
                            {fieldIssue(rowIndex, "durationMinutes") ? <p id={`price-guide-row-${rowIndex}-durationMinutes-error`} className="mt-1.5 text-[13px] font-medium leading-5 text-[#a04455]">{fieldIssue(rowIndex, "durationMinutes")?.message}</p> : null}
                          </div>
                        ) : (
                        <div className="grid gap-2">
                          <label className="grid gap-1 text-[14px] font-medium leading-5 text-[#607080]">
                            가격 기준
                            <select
                              id={`price-guide-row-${rowIndex}-priceKind`}
                              value={row.priceKind}
                              onChange={(event) => updatePriceKind(rowIndex, event.target.value as PriceGuideV2Row["priceKind"])}
                              aria-describedby={fieldIssue(rowIndex, "priceKind") ? `price-guide-row-${rowIndex}-priceKind-error` : undefined}
                              className="h-11 w-full rounded-[8px] border border-[#cbd5e1] bg-white px-2.5 text-[14px] font-medium text-[#172033] outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
                            >
                              {Object.entries(priceKindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                            </select>
                            {fieldIssue(rowIndex, "priceKind") ? <span id={`price-guide-row-${rowIndex}-priceKind-error`} className="text-[13px] font-medium leading-5 text-[#a04455]">{fieldIssue(rowIndex, "priceKind")?.message}</span> : null}
                          </label>
                          <div className="relative">
                            <input
                              id={`price-guide-row-${rowIndex}-priceMinKrw`}
                              value={row.priceMinKrw?.toLocaleString("ko-KR") ?? ""}
                              onChange={(event) => updateRow(rowIndex, "priceMinKrw", event.target.value)}
                              inputMode="numeric"
                              aria-label={`${weight} ${service} 가격`}
                              placeholder="가격"
                              className="h-11 w-full rounded-[8px] border border-[#cbd5e1] bg-white px-2.5 pr-7 text-right text-[14px] font-medium tabular-nums text-[#172033] outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
                            />
                            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-[#64748b]">원</span>
                          </div>
                          {fieldIssue(rowIndex, "priceMinKrw") ? <p id={`price-guide-row-${rowIndex}-priceMinKrw-error`} className="text-[13px] font-medium leading-5 text-[#a04455]">{fieldIssue(rowIndex, "priceMinKrw")?.message}</p> : null}
                          {row.priceKind === "range" ? <div className="relative">
                            <input
                              id={`price-guide-row-${rowIndex}-priceMaxKrw`}
                              value={row.priceMaxKrw?.toLocaleString("ko-KR") ?? ""}
                              onChange={(event) => updateRow(rowIndex, "priceMaxKrw", event.target.value)}
                              inputMode="numeric"
                              aria-label={`${weight} ${service} 최대 가격`}
                              placeholder="최대 가격"
                              aria-describedby={fieldIssue(rowIndex, "priceMaxKrw") ? `price-guide-row-${rowIndex}-priceMaxKrw-error` : undefined}
                              className="h-11 w-full rounded-[8px] border border-[#cbd5e1] bg-white px-2.5 pr-7 text-right text-[14px] font-medium tabular-nums text-[#172033] outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
                            />
                            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-[#64748b]">원</span>
                          </div> : null}
                          {row.priceKind === "range" && fieldIssue(rowIndex, "priceMaxKrw") ? <p id={`price-guide-row-${rowIndex}-priceMaxKrw-error`} className="text-[13px] font-medium leading-5 text-[#a04455]">{fieldIssue(rowIndex, "priceMaxKrw")?.message}</p> : null}
                          <div className="relative">
                            <input
                              id={`price-guide-row-${rowIndex}-durationMinutes`}
                              value={row.durationMinutes ?? ""}
                              onChange={(event) => updateRow(rowIndex, "durationMinutes", event.target.value)}
                              inputMode="numeric"
                              aria-label={`${weight} ${service} 예상시간`}
                              placeholder="시간"
                              className="h-11 w-full rounded-[8px] border border-[#cbd5e1] bg-white px-2.5 pr-7 text-right text-[14px] font-medium tabular-nums text-[#172033] outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
                            />
                            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-[#64748b]">분</span>
                          </div>
                          {fieldIssue(rowIndex, "durationMinutes") ? <p id={`price-guide-row-${rowIndex}-durationMinutes-error`} className="text-[13px] font-medium leading-5 text-[#a04455]">{fieldIssue(rowIndex, "durationMinutes")?.message}</p> : null}
                        </div>
                        )
                      ) : <span className="text-[#94a3b8]">-</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pendingReviews.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-[#ead7ae] bg-[#fff9ec] px-3 py-2.5">
          <p className="text-[13px] font-medium leading-5 text-[#765617]">사진에서 불확실했던 항목 {pendingReviews.length}개를 확인해 주세요.</p>
          <button
            type="button"
            onClick={() => onChange(resolvePriceGuideV2Reviews(document, (review) => pendingReviews.includes(review), "confirmed"))}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[8px] border border-[#d7c28f] bg-white px-3 text-[13px] font-medium text-[#6b4d12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a6418]"
          >
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            이 그룹 확인 완료
          </button>
        </div>
      ) : null}

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={onCancel} disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[8px] border border-[#cbd5e1] bg-white px-4 text-[14px] font-medium text-[#475569] transition hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] disabled:opacity-60">
          <X className="h-4 w-4" aria-hidden="true" />
          취소
        </button>
        <button type="button" onClick={onSave} disabled={saving || unresolved} aria-describedby={unresolved ? `price-guide-${group.key}-save-help` : undefined} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[8px] bg-[#172033] px-4 text-[14px] font-medium text-white transition hover:bg-[#25314a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
          <Check className="h-4 w-4" aria-hidden="true" />
          {saving ? "저장 중" : unresolved ? "확인 후 저장하기" : "상세 요금표 저장"}
        </button>
      </div>
      {unresolved ? <p id={`price-guide-${group.key}-save-help`} className="mt-2 text-[13px] font-normal leading-5 text-[#64748b]">표시된 확인 필요 항목을 채우면 저장할 수 있습니다.</p> : null}
    </section>
  );
}

function SupplementalDetails({ document, onEdit }: { document: PriceGuideV2; onEdit?: () => void }) {
  if (document.surcharges.length === 0 && !document.overallNote) return null;
  return (
    <section className="rounded-[14px] border border-[#dbe2ea] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[16px] font-semibold leading-6 text-[#172033]">추가요금·전체 안내</h3>
        {onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-[8px] border border-[#cbd5e1] bg-white px-3 text-[14px] font-medium leading-5 text-[#334155] transition hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2"
          >
            <PencilLine className="h-4 w-4" aria-hidden="true" />
            수정
          </button>
        ) : null}
      </div>
      {document.surcharges.length > 0 ? (
        <ul className="mt-3 divide-y divide-[#edf2f7]">
          {document.surcharges.map((fee, index) => (
            <li key={`${fee.condition ?? "추가요금"}-${index}`} className="flex min-h-11 items-center justify-between gap-4 py-2 text-[14px] leading-5">
              <span className="min-w-0 break-words text-[#475569]">{fee.condition || fee.note || "조건 확인 필요"}</span>
              <span className="shrink-0 tabular-nums font-medium text-[#172033]">{fee.amountKrw !== null ? `${fee.amountKrw.toLocaleString("ko-KR")}원` : fee.percent !== null ? `${fee.percent}%` : "금액 확인 필요"}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {document.overallNote ? <p className="mt-3 whitespace-pre-wrap border-t border-[#edf2f7] pt-3 text-[13px] font-normal leading-5 text-[#64748b]">{document.overallNote}</p> : null}
    </section>
  );
}

function EditableSupplementalDetails({
  document,
  onChange,
  onCancel,
  onSave,
  saving,
  saveError,
  validationIssues,
}: {
  document: PriceGuideV2;
  onChange: (next: PriceGuideV2) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  saveError: string;
  validationIssues: PriceGuideValidationIssue[];
}) {
  function fieldIssue(index: number, field: keyof PriceGuideV2Surcharge | "overallNote") {
    const key = field === "overallNote" ? "overallNote" : `surcharges:${index}.${field}`;
    return validationIssues.find((issue) => issue.key === key);
  }

  function updateSurcharge(index: number, field: keyof PriceGuideV2Surcharge, value: string) {
    const nextValue = field === "amountKrw" || field === "percent" ? digitsOnly(value) : value.trim() || null;
    const next = {
      ...document,
      source: document.source === "manual" ? "manual" : "owner_corrected" as const,
      surcharges: document.surcharges.map((fee, feeIndex) => feeIndex === index ? { ...fee, [field]: nextValue } : fee),
    } as PriceGuideV2;
    onChange(resolvePriceGuideV2Reviews(next, (review) => review.targetId === `surcharges:${index}` && review.field === field, "corrected"));
  }

  function updateOverallNote(value: string) {
    const next: PriceGuideV2 = {
      ...document,
      source: document.source === "manual" ? "manual" : "owner_corrected",
      overallNote: value.trim() || null,
    };
    onChange(resolvePriceGuideV2Reviews(next, (review) => review.targetId === "overallNote", "corrected"));
  }

  return (
    <section className="rounded-[14px] border border-[#9fb0c5] bg-white p-4" data-price-guide-supplemental-editor="true">
      <h3 className="text-[16px] font-semibold leading-6 text-[#172033]">추가요금·전체 안내</h3>
      {document.surcharges.length > 0 ? (
        <div className="mt-3 space-y-3">
          {document.surcharges.map((fee, index) => (
            <div key={`${fee.condition ?? "추가요금"}-${index}`} className="grid min-w-0 gap-2 rounded-[10px] border border-[#edf2f7] p-3 sm:grid-cols-[minmax(0,1fr)_132px_112px]">
              <label className="min-w-0 text-[14px] font-medium leading-5 text-[#607080]">
                조건
                <input
                  id={`price-guide-surcharge-${index}-condition`}
                  value={fee.condition ?? ""}
                  onChange={(event) => updateSurcharge(index, "condition", event.target.value)}
                  aria-describedby={fieldIssue(index, "condition") ? `price-guide-surcharge-${index}-condition-error` : undefined}
                  className="mt-1.5 h-11 w-full rounded-[8px] border border-[#cbd5e1] bg-white px-3 text-[16px] font-normal leading-6 text-[#172033] outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
                />
                {fieldIssue(index, "condition") ? <p id={`price-guide-surcharge-${index}-condition-error`} className="mt-1.5 text-[13px] font-medium leading-5 text-[#a04455]">{fieldIssue(index, "condition")?.message}</p> : null}
              </label>
              <label className="min-w-0 text-[14px] font-medium leading-5 text-[#607080]">
                금액
                <div className="relative mt-1.5">
                  <input
                    id={`price-guide-surcharge-${index}-amountKrw`}
                    value={fee.amountKrw?.toLocaleString("ko-KR") ?? ""}
                    onChange={(event) => updateSurcharge(index, "amountKrw", event.target.value)}
                    inputMode="numeric"
                    aria-describedby={fieldIssue(index, "amountKrw") ? `price-guide-surcharge-${index}-amountKrw-error` : undefined}
                    className="h-11 w-full rounded-[8px] border border-[#cbd5e1] bg-white px-3 pr-7 text-right text-[16px] font-normal leading-6 tabular-nums text-[#172033] outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
                  />
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-[#64748b]">원</span>
                </div>
                {fieldIssue(index, "amountKrw") ? <p id={`price-guide-surcharge-${index}-amountKrw-error`} className="mt-1.5 text-[13px] font-medium leading-5 text-[#a04455]">{fieldIssue(index, "amountKrw")?.message}</p> : null}
              </label>
              <label className="min-w-0 text-[14px] font-medium leading-5 text-[#607080]">
                비율
                <div className="relative mt-1.5">
                  <input
                    id={`price-guide-surcharge-${index}-percent`}
                    value={fee.percent ?? ""}
                    onChange={(event) => updateSurcharge(index, "percent", event.target.value)}
                    inputMode="numeric"
                    aria-describedby={fieldIssue(index, "percent") ? `price-guide-surcharge-${index}-percent-error` : undefined}
                    className="h-11 w-full rounded-[8px] border border-[#cbd5e1] bg-white px-3 pr-7 text-right text-[16px] font-normal leading-6 tabular-nums text-[#172033] outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
                  />
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-[#64748b]">%</span>
                </div>
                {fieldIssue(index, "percent") ? <p id={`price-guide-surcharge-${index}-percent-error`} className="mt-1.5 text-[13px] font-medium leading-5 text-[#a04455]">{fieldIssue(index, "percent")?.message}</p> : null}
              </label>
              <label className="min-w-0 text-[14px] font-medium leading-5 text-[#607080] sm:col-span-3">
                안내
                <textarea
                  id={`price-guide-surcharge-${index}-note`}
                  value={fee.note ?? ""}
                  onChange={(event) => updateSurcharge(index, "note", event.target.value)}
                  aria-describedby={fieldIssue(index, "note") ? `price-guide-surcharge-${index}-note-error` : undefined}
                  className="mt-1.5 min-h-[68px] w-full rounded-[8px] border border-[#cbd5e1] bg-white px-3 py-2 text-[14px] font-normal leading-5 text-[#172033] outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
                />
                {fieldIssue(index, "note") ? <p id={`price-guide-surcharge-${index}-note-error`} className="mt-1.5 text-[13px] font-medium leading-5 text-[#a04455]">{fieldIssue(index, "note")?.message}</p> : null}
              </label>
            </div>
          ))}
        </div>
      ) : null}
      <label className="mt-3 block min-w-0 text-[14px] font-medium leading-5 text-[#607080]">
        전체 안내
        <textarea
          id="price-guide-overall-note"
          value={document.overallNote ?? ""}
          onChange={(event) => updateOverallNote(event.target.value)}
          aria-describedby={fieldIssue(0, "overallNote") ? "price-guide-overall-note-error" : undefined}
          className="mt-1.5 min-h-[92px] w-full rounded-[8px] border border-[#cbd5e1] bg-white px-3 py-2 text-[14px] font-normal leading-5 text-[#172033] outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
        />
        {fieldIssue(0, "overallNote") ? <p id="price-guide-overall-note-error" className="mt-1.5 text-[13px] font-medium leading-5 text-[#a04455]">{fieldIssue(0, "overallNote")?.message}</p> : null}
      </label>
      {saveError ? <p role="alert" className="mt-3 text-[13px] font-medium leading-5 text-[#a04455]">{saveError}</p> : null}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={onCancel} disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[8px] border border-[#cbd5e1] bg-white px-4 text-[14px] font-medium leading-5 text-[#475569] transition hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] disabled:opacity-60">
          <X className="h-4 w-4" aria-hidden="true" />
          취소
        </button>
        <button type="button" onClick={onSave} disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[8px] bg-[#172033] px-4 text-[14px] font-medium leading-5 text-white transition hover:bg-[#25314a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
          <Check className="h-4 w-4" aria-hidden="true" />
          {saving ? "저장 중" : "저장"}
        </button>
      </div>
    </section>
  );
}

export default function PriceGuideV2ServiceDetail({
  document: value,
  onSave,
  startEditing = false,
  manualMatrixMode = false,
  onSaveActionReady,
}: {
  document: PriceGuideV2;
  onSave: (next: PriceGuideV2) => void | boolean | Promise<void | boolean>;
  startEditing?: boolean;
  /** Keeps manual price-entry cells to the fixed price-and-duration pair without exposing priceKind controls. */
  manualMatrixMode?: boolean;
  onSaveActionReady?: (action: (() => Promise<void>) | null) => void;
}) {
  const signature = JSON.stringify(value);
  const savedDocument = useMemo(() => value, [signature]);
  const initialGroupKey = buildMatrixGroups(value)[0]?.key ?? null;
  const [editingGroupKey, setEditingGroupKey] = useState<string | null>(startEditing ? initialGroupKey : null);
  const [editingSupplemental, setEditingSupplemental] = useState(false);
  const [draft, setDraft] = useState(savedDocument);
  const [validationIssues, setValidationIssues] = useState<PriceGuideValidationIssue[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (!editingGroupKey && !editingSupplemental) setDraft(savedDocument);
  }, [editingGroupKey, editingSupplemental, savedDocument]);

  const groups = useMemo(() => buildMatrixGroups(editingGroupKey ? draft : savedDocument), [draft, editingGroupKey, savedDocument]);
  const draftIssues = useMemo(() => validatePriceGuideDocument(draft), [draft]);

  function beginEdit(groupKey: string) {
    setDraft(savedDocument);
    setValidationIssues([]);
    setSaveError("");
    setEditingSupplemental(false);
    setEditingGroupKey(groupKey);
  }

  function cancelEdit() {
    setDraft(savedDocument);
    setValidationIssues([]);
    setSaveError("");
    setEditingGroupKey(null);
  }

  function beginSupplementalEdit() {
    setDraft(savedDocument);
    setValidationIssues([]);
    setSaveError("");
    setEditingGroupKey(null);
    setEditingSupplemental(true);
  }

  function cancelSupplementalEdit() {
    setDraft(savedDocument);
    setValidationIssues([]);
    setSaveError("");
    setEditingSupplemental(false);
  }

  const saveDraft = useCallback(async () => {
    const issues = draftIssues;
    setValidationIssues(issues);
    setSaveError("");
    if (issues.length > 0) {
      const rowMatch = /^price-guide-row-(\d+)-/.exec(issues[0].inputId);
      if (rowMatch) {
        const rowIndex = Number(rowMatch[1]);
        const nextGroup = buildMatrixGroups(draft).find((group) => group.rowIndexes.includes(rowIndex));
        if (nextGroup) setEditingGroupKey(nextGroup.key);
      }
      window.requestAnimationFrame(() => globalThis.document.getElementById(issues[0].inputId)?.focus());
      return;
    }
    setSaving(true);
    try {
      const saved = await onSave(draft);
      if (saved === false) {
        setSaveError("요금표를 저장하지 못했습니다. 입력 내용을 확인하고 다시 시도해 주세요.");
        return;
      }
      setEditingGroupKey(null);
      setEditingSupplemental(false);
    } catch {
      setSaveError("요금표를 저장하지 못했습니다. 입력 내용은 유지됩니다.");
    } finally {
      setSaving(false);
    }
  }, [draft, draftIssues, onSave]);

  const saveDraftRef = useRef(saveDraft);
  useEffect(() => {
    saveDraftRef.current = saveDraft;
  }, [saveDraft]);

  const registeredSaveAction = useCallback(async () => saveDraftRef.current(), []);

  useEffect(() => {
    onSaveActionReady?.(registeredSaveAction);
    return () => onSaveActionReady?.(null);
  }, [onSaveActionReady, registeredSaveAction]);

  return (
    <div className="min-w-0 space-y-4" data-price-guide-detail-matrix="true">
      {groups.map((group) => editingGroupKey === group.key ? (
        <EditableMatrixGroup
          key={group.key}
          document={draft}
          group={group}
          onChange={setDraft}
          onCancel={cancelEdit}
          onSave={() => void saveDraft()}
          saving={saving}
          validationIssues={draftIssues}
          manualMatrixMode={manualMatrixMode}
        />
      ) : (
        <MatrixGroupCard key={group.key} group={group} onEdit={() => beginEdit(group.key)} />
      ))}
      {editingSupplemental ? (
        <EditableSupplementalDetails
          document={draft}
          onChange={setDraft}
          onCancel={cancelSupplementalEdit}
          onSave={() => void saveDraft()}
          saving={saving}
          saveError={saveError}
          validationIssues={validationIssues}
        />
      ) : (
        <SupplementalDetails document={editingGroupKey ? draft : savedDocument} onEdit={editingGroupKey ? undefined : beginSupplementalEdit} />
      )}
      {validationIssues.length > 0 ? <p role="alert" className="text-[13px] font-medium leading-5 text-[#a04455]">{validationIssues[0].message}</p> : null}
      {saveError ? <p role="alert" className="text-[13px] font-medium leading-5 text-[#a04455]">{saveError}</p> : null}
    </div>
  );
}
