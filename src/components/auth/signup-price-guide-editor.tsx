"use client";

import { AlertCircle, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";

import PriceGuideStructuredReviewTable from "@/components/owner-web/price-guide-structured-review-table";
import { isConfirmedPriceGuideDuration } from "@/lib/price-guide-duration-confirmation";
import {
  findPriceGuideV2ClassificationIssues,
  resolvePriceGuideV2Reviews,
  type PriceGuideV2,
  type PriceGuideV2AiReview,
  type PriceGuideV2Row,
  type PriceGuideV2ReviewResolution,
  type PriceGuideV2Surcharge,
} from "@/types/price-guide-photo-import";

export type PriceGuideValidationIssue = {
  key: string;
  inputId: string;
  message: string;
};

const inputClass =
  "mt-1.5 h-11 w-full min-w-0 rounded-[10px] border border-[#d7e0eb] bg-white px-3 text-[14px] font-normal text-[#172033] outline-none transition focus-visible:border-[#1d3557] focus-visible:ring-2 focus-visible:ring-[#1d3557]/15";
const labelClass = "min-w-0 text-[12px] font-medium leading-5 text-[#607080]";

const speciesLabels: Record<PriceGuideV2Row["species"], string> = {
  dog: "강아지",
  cat: "고양이",
  all: "강아지·고양이 공통",
  unknown: "확인 필요",
};

const sizeLabels: Record<PriceGuideV2Row["sizeClass"], string> = {
  small: "소형견",
  medium: "중형견",
  large: "대형견",
  "extra-large": "초대형견",
  all: "전체 체급",
  unknown: "체급 확인 필요",
};

const priceKindLabels: Record<PriceGuideV2Row["priceKind"], string> = {
  fixed: "정가",
  starting: "시작가",
  range: "가격 범위",
  unknown: "확인 필요",
};

function rowInputId(index: number, field: keyof PriceGuideV2Row) {
  return `price-guide-row-${index}-${field}`;
}

function surchargeInputId(index: number, field: keyof PriceGuideV2Surcharge | "valueKind") {
  return `price-guide-surcharge-${index}-${field}`;
}

function reviewKey(targetId: string, field: string) {
  return `${targetId}.${field}`;
}

function isPending(review: PriceGuideV2AiReview) {
  return !review.userConfirmed && !review.userCorrected;
}

function nullableText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function nullableInteger(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) : null;
}

function nullableDecimal(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function reviewInputId(review: PriceGuideV2AiReview) {
  const rowMatch = /^rows:(\d+)$/.exec(review.targetId);
  if (rowMatch) return rowInputId(Number(rowMatch[1]), review.field as keyof PriceGuideV2Row);
  const surchargeMatch = /^surcharges:(\d+)$/.exec(review.targetId);
  if (surchargeMatch) {
    const field = review.field === "amountKrw" || review.field === "percent" ? review.field : review.field as keyof PriceGuideV2Surcharge;
    return surchargeInputId(Number(surchargeMatch[1]), field);
  }
  if (review.field === "overallNote") return "price-guide-overall-note";
  return "price-guide-pending-toggle";
}

export function validatePriceGuideDocument(
  document: PriceGuideV2,
  options: { photoTable?: boolean } = {},
): PriceGuideValidationIssue[] {
  const issues: PriceGuideValidationIssue[] = [];
  if (document.rows.length === 0) {
    issues.push({ key: "rows", inputId: "price-guide-add-row", message: "요금 행을 한 개 이상 추가해 주세요." });
  }
  if (document.source === "manual") {
    document.tableGroups?.forEach((group, groupIndex) => {
      if (!group.sourceLabel.trim()) {
        issues.push({
          key: `tableGroups:${groupIndex}.sourceLabel`,
          inputId: `price-guide-direct-group-${groupIndex}-sourceLabel`,
          message: "그룹 제목을 입력해 주세요.",
        });
      }
      if (group.species === "unknown") {
        issues.push({
          key: `tableGroups:${groupIndex}.species`,
          inputId: `price-guide-direct-group-${groupIndex}-species`,
          message: "그룹의 대상 동물을 선택해 주세요.",
        });
      }
      if (group.sizeClass === "unknown") {
        issues.push({
          key: `tableGroups:${groupIndex}.sizeClass`,
          inputId: `price-guide-direct-group-${groupIndex}-sizeClass`,
          message: "그룹의 체급 분류를 선택해 주세요.",
        });
      }
      group.weightBands.forEach((weightBand, weightIndex) => {
        if (weightBand.label.trim()) return;
        const firstRowIndex = document.tableGroups!
          .slice(0, groupIndex)
          .reduce((total, item) => total + item.weightBands.length * item.serviceNames.length, 0)
          + weightIndex * group.serviceNames.length;
        issues.push({
          key: `tableGroups:${groupIndex}.weightBands:${weightIndex}.label`,
          inputId: rowInputId(firstRowIndex, "maxKg"),
          message: "체급 행의 최소 또는 최대 kg을 입력해 주세요.",
        });
      });
    });
  }
  const classificationIssues = findPriceGuideV2ClassificationIssues(document);
  document.rows.forEach((row, index) => {
    const targetId = `rows:${index}`;
    if (!row.serviceName?.trim()) {
      issues.push({ key: reviewKey(targetId, "serviceName"), inputId: rowInputId(index, "serviceName"), message: "서비스명을 입력해 주세요." });
    }
    if (!options.photoTable && classificationIssues.some((issue) => issue.rowIndex === index && issue.field === "species")) {
      issues.push({ key: reviewKey(targetId, "species"), inputId: rowInputId(index, "species"), message: "반려동물 종류를 선택해 주세요." });
    }
    if (!options.photoTable && classificationIssues.some((issue) => issue.rowIndex === index && issue.field === "sizeClass")) {
      issues.push({ key: reviewKey(targetId, "sizeClass"), inputId: rowInputId(index, "sizeClass"), message: "체급을 선택해 주세요." });
    }
    if (row.priceKind === "unknown" && (!options.photoTable || row.priceMinKrw === null)) {
      issues.push(options.photoTable
        ? { key: reviewKey(targetId, "priceMinKrw"), inputId: rowInputId(index, "priceMinKrw"), message: "사진에서 읽지 못한 가격을 입력해 주세요." }
        : { key: reviewKey(targetId, "priceKind"), inputId: rowInputId(index, "priceKind"), message: "가격 방식을 선택해 주세요." });
    } else if (row.priceMinKrw === null) {
      issues.push({ key: reviewKey(targetId, "priceMinKrw"), inputId: rowInputId(index, "priceMinKrw"), message: "확정된 가격을 입력해 주세요." });
    }
    if (row.priceKind === "range" && row.priceMaxKrw === null) {
      issues.push({ key: reviewKey(targetId, "priceMaxKrw"), inputId: rowInputId(index, "priceMaxKrw"), message: "최대 금액을 입력해 주세요." });
    }
    if (row.minKg !== null && row.maxKg !== null && row.minKg > row.maxKg) {
      issues.push({ key: reviewKey(targetId, "maxKg"), inputId: rowInputId(index, "maxKg"), message: "최대 체중은 최소 체중보다 작을 수 없습니다." });
    }
    if (row.priceMinKrw !== null && row.priceMaxKrw !== null && row.priceMinKrw > row.priceMaxKrw) {
      issues.push({ key: reviewKey(targetId, "priceMaxKrw"), inputId: rowInputId(index, "priceMaxKrw"), message: "최대 금액은 최소 금액보다 작을 수 없습니다." });
    }
    if (!isConfirmedPriceGuideDuration(row.durationMinutes)) {
      issues.push({ key: reviewKey(targetId, "durationMinutes"), inputId: rowInputId(index, "durationMinutes"), message: "소요 시간은 15~480분으로 확정해 주세요." });
    }
  });
  document.surcharges.forEach((surcharge, index) => {
    const targetId = `surcharges:${index}`;
    if (surcharge.amountKrw !== null && (!Number.isInteger(surcharge.amountKrw) || surcharge.amountKrw < 0 || surcharge.amountKrw > 100_000_000)) {
      issues.push({ key: reviewKey(targetId, "amountKrw"), inputId: surchargeInputId(index, "amountKrw"), message: "추가 금액은 0~100,000,000원 정수로 입력해 주세요." });
    }
    if (surcharge.percent !== null && (!Number.isFinite(surcharge.percent) || surcharge.percent < 0 || surcharge.percent > 1_000)) {
      issues.push({ key: reviewKey(targetId, "percent"), inputId: surchargeInputId(index, "percent"), message: "추가 비율은 0~1,000%로 입력해 주세요." });
    }
    if (surcharge.condition !== null && surcharge.condition.length > 200) {
      issues.push({ key: reviewKey(targetId, "condition"), inputId: surchargeInputId(index, "condition"), message: "조건은 200자 이내로 입력해 주세요." });
    }
    if (surcharge.note !== null && surcharge.note.length > 1_000) {
      issues.push({ key: reviewKey(targetId, "note"), inputId: surchargeInputId(index, "note"), message: "안내는 1,000자 이내로 입력해 주세요." });
    }
  });
  if (document.overallNote !== null && document.overallNote.length > 4_000) {
    issues.push({ key: "overallNote", inputId: "price-guide-overall-note", message: "전체 안내는 4,000자 이내로 입력해 주세요." });
  }
  for (const review of options.photoTable ? [] : document.aiReview) {
    if (!isPending(review)) continue;
    issues.push({
      key: reviewKey(review.targetId, review.field),
      inputId: reviewInputId(review),
      message: "사진에서 확실히 읽지 못한 항목을 확인해 주세요.",
    });
  }
  return issues.filter((issue, index) => issues.findIndex((candidate) => candidate.key === issue.key) === index);
}

function fieldReviews(document: PriceGuideV2, targetId: string, field: string) {
  return document.aiReview.filter((review) => review.targetId === targetId && review.field === field);
}

function FieldReview({
  reviews,
  descriptionId,
  onResolve,
}: {
  reviews: PriceGuideV2AiReview[];
  descriptionId: string;
  onResolve: (resolution: PriceGuideV2ReviewResolution) => void;
}) {
  if (reviews.length === 0) return null;
  const pending = reviews.some(isPending);
  if (!pending) {
    return (
      <p id={descriptionId} className="mt-2 flex items-center gap-1.5 text-[12px] font-medium text-[#1f7a55]">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />확인 완료
      </p>
    );
  }
  return (
    <div id={descriptionId} className="mt-2 rounded-[10px] border border-[#ead7ae] bg-[#fff9ec] p-3 text-[12px] text-[#765617]">
      {reviews.filter(isPending).map((review, index) => (
        <p key={`${review.rawText}-${index}`} className="leading-5">
          <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#b98121]" aria-hidden="true" />
          확인 필요 · {review.confidence === "low" ? "신뢰도 낮음" : "신뢰도 보통"} · 원문 “{review.rawText || "판독값 없음"}”
        </p>
      ))}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => onResolve("confirmed")} className="h-11 rounded-[10px] border border-[#d7c28f] bg-white px-3 font-medium text-[#6b4d12] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8a6418]">맞아요</button>
        <button type="button" onClick={() => onResolve("corrected")} className="h-11 rounded-[10px] bg-[#8a6418] px-3 font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8a6418]">수정했어요</button>
      </div>
    </div>
  );
}

function FieldError({ id, issue }: { id: string; issue?: PriceGuideValidationIssue }) {
  return issue ? <p id={id} className="mt-1.5 text-[12px] font-medium text-[#a04455]">{issue.message}</p> : null;
}

function FormField({
  id,
  label,
  children,
  review,
  issue,
  className = "",
}: {
  id: string;
  label: string;
  children: ReactNode;
  review?: ReactNode;
  issue?: PriceGuideValidationIssue;
  className?: string;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <label htmlFor={id} className={labelClass}>{label}</label>
      {children}
      {review}
      <FieldError id={`${id}-error`} issue={issue} />
    </div>
  );
}

function removeIndexedReviews(reviews: PriceGuideV2AiReview[], prefix: "rows" | "surcharges", removedIndex: number) {
  return reviews.flatMap((review) => {
    const match = new RegExp(`^${prefix}:(\\d+)$`).exec(review.targetId);
    if (!match) return [review];
    const index = Number(match[1]);
    if (index === removedIndex) return [];
    return [{ ...review, targetId: index > removedIndex ? `${prefix}:${index - 1}` : review.targetId }];
  });
}

function emptyRow(): PriceGuideV2Row {
  return {
    serviceName: null,
    species: "unknown",
    breedNames: [],
    breedGroup: null,
    sizeClass: "unknown",
    minKg: null,
    maxKg: null,
    weightBandLabel: null,
    priceKind: "unknown",
    priceMinKrw: null,
    priceMaxKrw: null,
    durationMinutes: null,
    note: null,
  };
}

function emptySurcharge(): PriceGuideV2Surcharge {
  return { condition: null, amountKrw: null, percent: null, note: null };
}

export default function SignupPriceGuideEditor({
  document,
  onChange,
  validationIssues,
  mode,
}: {
  document: PriceGuideV2;
  onChange: (next: PriceGuideV2) => void;
  validationIssues: PriceGuideValidationIssue[];
  mode?: "review" | "manual";
}) {
  const manualMode = mode === "manual" || (mode === undefined && document.source === "manual");
  const pendingCount = document.aiReview.filter(isPending).length;
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const issueMap = new Map(validationIssues.map((issue) => [issue.key, issue]));

  const updateRow = (index: number, update: (row: PriceGuideV2Row) => PriceGuideV2Row) => {
    onChange({ ...document, rows: document.rows.map((row, rowIndex) => rowIndex === index ? update(row) : row) });
  };

  const resolveMatchingReviews = (
    predicate: (review: PriceGuideV2AiReview) => boolean,
    resolution: PriceGuideV2ReviewResolution,
  ) => {
    onChange(resolvePriceGuideV2Reviews(document, predicate, resolution));
  };

  const resolveReview = (targetId: string, field: string, resolution: PriceGuideV2ReviewResolution) => {
    resolveMatchingReviews((review) => review.targetId === targetId && review.field === field, resolution);
  };

  const showField = (targetId: string, field: string) => {
    if (!showPendingOnly) return true;
    return fieldReviews(document, targetId, field).some(isPending) || issueMap.has(reviewKey(targetId, field));
  };

  function focusStructuredRow(rowIndex: number) {
    setShowPendingOnly(false);
    globalThis.requestAnimationFrame(() => {
      const input = globalThis.document.getElementById(rowInputId(rowIndex, "serviceName"));
      input?.scrollIntoView({ behavior: "smooth", block: "center" });
      input?.focus({ preventScroll: true });
    });
  }

  return (
    <div className="min-w-0">
      <div className="flex flex-col gap-3 border-b border-[#e2e8f0] pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-[20px] font-semibold tracking-[-0.025em] text-[#172033]">{manualMode ? "요금표 직접 입력" : "요금표 확인"}</h2>
          <p className="mt-1 text-[14px] font-normal text-[#64748b]">
            {manualMode ? "견종·체급·몸무게·가격·시간과 필요한 메모를 입력해 주세요." : "사진에서 읽은 내용을 확인해 주세요."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-[12px] font-medium text-[#526174]">
            <span className="rounded-full bg-[#eef3f8] px-3 py-1.5">요금 행 {document.rows.length}</span>
            <span className="rounded-full bg-[#eef3f8] px-3 py-1.5">추가요금 {document.surcharges.length}</span>
            {!manualMode ? <span className={pendingCount > 0 ? "rounded-full bg-[#fff4dc] px-3 py-1.5 text-[#8a6418]" : "rounded-full bg-[#edf7f2] px-3 py-1.5 text-[#177856]"}>확인 필요 {pendingCount}</span> : null}
          </div>
        </div>
        {!manualMode && document.aiReview.length > 0 ? <label htmlFor="price-guide-pending-toggle" className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-[10px] border border-[#d7e0eb] bg-white px-3 text-[13px] font-medium text-[#42536a]">
          확인 필요만 보기
          <input id="price-guide-pending-toggle" type="checkbox" checked={showPendingOnly} onChange={(event) => setShowPendingOnly(event.target.checked)} className="h-5 w-5 accent-[#1d3557]" />
        </label> : null}
      </div>

      {validationIssues.length > 0 ? <p role="alert" className="mt-4 rounded-[10px] bg-[#fff2ef] px-4 py-3 text-[13px] font-medium text-[#a04455]">{validationIssues[0].message}</p> : null}

      {!manualMode ? <PriceGuideStructuredReviewTable document={document} onEditRow={focusStructuredRow} /> : null}

      <section className="mt-5" aria-labelledby="price-guide-rows-heading">
        <div className="flex items-center justify-between gap-3">
          <h3 id="price-guide-rows-heading" className="text-[16px] font-semibold text-[#172033]">요금 행</h3>
          <span className="text-[12px] font-normal text-[#7a8798]">필요한 행만 펼쳐 확인하세요</span>
        </div>
        <div className="mt-3 space-y-3">
          {document.rows.map((row, index) => {
            const targetId = `rows:${index}`;
            const targetIssues = validationIssues.filter((issue) => issue.key.startsWith(`${targetId}.`));
            const targetPending = document.aiReview.some((review) => review.targetId === targetId && isPending(review));
            if (showPendingOnly && !targetPending && targetIssues.length === 0) return null;
            const issue = (field: keyof PriceGuideV2Row) => issueMap.get(reviewKey(targetId, field));
            const describe = (field: keyof PriceGuideV2Row) => [
              fieldReviews(document, targetId, field).length ? `${rowInputId(index, field)}-review` : null,
              issue(field) ? `${rowInputId(index, field)}-error` : null,
            ].filter(Boolean).join(" ") || undefined;
            const review = (field: keyof PriceGuideV2Row) => (
              <FieldReview reviews={fieldReviews(document, targetId, field)} descriptionId={`${rowInputId(index, field)}-review`} onResolve={(resolution) => resolveReview(targetId, field, resolution)} />
            );
            return (
              <article key={targetId} className="min-w-0 rounded-[14px] border border-[#dce4ed] bg-white p-4">
                <div className="flex items-center justify-between gap-3 border-b border-[#edf1f5] pb-3">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-[#172033]">{row.serviceName || `요금 행 ${index + 1}`}</p>
                    <p className="mt-0.5 truncate text-[12px] font-normal text-[#718096]">{speciesLabels[row.species]} · {sizeLabels[row.sizeClass]} · {priceKindLabels[row.priceKind]}</p>
                  </div>
                  <button type="button" onClick={() => onChange({ ...document, rows: document.rows.filter((_, rowIndex) => rowIndex !== index), aiReview: removeIndexedReviews(document.aiReview, "rows", index) })} aria-label={`요금 행 ${index + 1} 삭제`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] text-[#7a8798] hover:bg-[#f2f4f7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d3557]"><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
                </div>
                <div className="mt-3 grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {showField(targetId, "serviceName") ? <FormField id={rowInputId(index, "serviceName")} label="서비스명" review={review("serviceName")} issue={issue("serviceName")}><input id={rowInputId(index, "serviceName")} value={row.serviceName ?? ""} onChange={(event) => updateRow(index, (current) => ({ ...current, serviceName: nullableText(event.target.value) }))} aria-invalid={Boolean(issue("serviceName"))} aria-describedby={describe("serviceName")} className={inputClass} placeholder="예: 전체 미용" /></FormField> : null}
                  {showField(targetId, "species") ? <FormField id={rowInputId(index, "species")} label="반려동물" review={review("species")} issue={issue("species")}><select id={rowInputId(index, "species")} value={row.species} onChange={(event) => updateRow(index, (current) => ({ ...current, species: event.target.value as PriceGuideV2Row["species"] }))} aria-invalid={Boolean(issue("species"))} aria-describedby={describe("species")} className={inputClass}><option value="dog">강아지</option><option value="cat">고양이</option><option value="all">공통</option><option value="unknown">확인 필요</option></select></FormField> : null}
                  {showField(targetId, "breedNames") ? <FormField id={rowInputId(index, "breedNames")} label="품종명" review={review("breedNames")}><input id={rowInputId(index, "breedNames")} value={row.breedNames.join(", ")} onChange={(event) => updateRow(index, (current) => ({ ...current, breedNames: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) }))} aria-describedby={describe("breedNames")} className={inputClass} placeholder="말티즈, 푸들" /></FormField> : null}
                  {showField(targetId, "breedGroup") ? <FormField id={rowInputId(index, "breedGroup")} label="품종 그룹" review={review("breedGroup")}><input id={rowInputId(index, "breedGroup")} value={row.breedGroup ?? ""} onChange={(event) => updateRow(index, (current) => ({ ...current, breedGroup: nullableText(event.target.value) }))} aria-describedby={describe("breedGroup")} className={inputClass} placeholder="예: 장모종" /></FormField> : null}
                  {showField(targetId, "sizeClass") ? <FormField id={rowInputId(index, "sizeClass")} label="체급" review={review("sizeClass")} issue={issue("sizeClass")}><select id={rowInputId(index, "sizeClass")} value={row.sizeClass} onChange={(event) => updateRow(index, (current) => ({ ...current, sizeClass: event.target.value as PriceGuideV2Row["sizeClass"] }))} aria-invalid={Boolean(issue("sizeClass"))} aria-describedby={describe("sizeClass")} className={inputClass}><option value="small">소형견</option><option value="medium">중형견</option><option value="large">대형견</option><option value="extra-large">초대형견</option><option value="all">전체 체급</option><option value="unknown">확인 필요</option></select></FormField> : null}
                  {showField(targetId, "minKg") ? <FormField id={rowInputId(index, "minKg")} label="최소 kg" review={review("minKg")}><input id={rowInputId(index, "minKg")} value={row.minKg ?? ""} inputMode="decimal" onChange={(event) => updateRow(index, (current) => ({ ...current, minKg: nullableDecimal(event.target.value) }))} aria-describedby={describe("minKg")} className={inputClass} placeholder="비워둘 수 있어요" /></FormField> : null}
                  {showField(targetId, "maxKg") ? <FormField id={rowInputId(index, "maxKg")} label="최대 kg" review={review("maxKg")} issue={issue("maxKg")}><input id={rowInputId(index, "maxKg")} value={row.maxKg ?? ""} inputMode="decimal" onChange={(event) => updateRow(index, (current) => ({ ...current, maxKg: nullableDecimal(event.target.value) }))} aria-invalid={Boolean(issue("maxKg"))} aria-describedby={describe("maxKg")} className={inputClass} placeholder="비워둘 수 있어요" /></FormField> : null}
                  {showField(targetId, "weightBandLabel") ? <FormField id={rowInputId(index, "weightBandLabel")} label="사진 속 체급 구간" review={review("weightBandLabel")}><input id={rowInputId(index, "weightBandLabel")} value={row.weightBandLabel ?? ""} onChange={(event) => updateRow(index, (current) => ({ ...current, weightBandLabel: nullableText(event.target.value) }))} aria-describedby={describe("weightBandLabel")} className={inputClass} placeholder="예: 2kg~5kg" /></FormField> : null}
                  {showField(targetId, "priceKind") ? <FormField id={rowInputId(index, "priceKind")} label="가격 방식" review={review("priceKind")} issue={issue("priceKind")}><select id={rowInputId(index, "priceKind")} value={row.priceKind} onChange={(event) => updateRow(index, (current) => { const priceKind = event.target.value as PriceGuideV2Row["priceKind"]; return { ...current, priceKind, priceMaxKrw: priceKind === "range" || priceKind === "unknown" ? current.priceMaxKrw : null }; })} aria-invalid={Boolean(issue("priceKind"))} aria-describedby={describe("priceKind")} className={inputClass}><option value="fixed">정가</option><option value="starting">시작가</option><option value="range">가격 범위</option><option value="unknown">확인 필요</option></select></FormField> : null}
                  {showField(targetId, "priceMinKrw") ? <FormField id={rowInputId(index, "priceMinKrw")} label={row.priceKind === "range" ? "최소 금액" : "금액"} review={review("priceMinKrw")} issue={issue("priceMinKrw")}><input id={rowInputId(index, "priceMinKrw")} value={row.priceMinKrw ?? ""} inputMode="numeric" onChange={(event) => updateRow(index, (current) => ({ ...current, priceMinKrw: nullableInteger(event.target.value) }))} aria-invalid={Boolean(issue("priceMinKrw"))} aria-describedby={describe("priceMinKrw")} className={inputClass} placeholder="원 단위" /></FormField> : null}
                  {row.priceKind === "range" && showField(targetId, "priceMaxKrw") ? <FormField id={rowInputId(index, "priceMaxKrw")} label="최대 금액" review={review("priceMaxKrw")} issue={issue("priceMaxKrw")}><input id={rowInputId(index, "priceMaxKrw")} value={row.priceMaxKrw ?? ""} inputMode="numeric" onChange={(event) => updateRow(index, (current) => ({ ...current, priceMaxKrw: nullableInteger(event.target.value) }))} aria-invalid={Boolean(issue("priceMaxKrw"))} aria-describedby={describe("priceMaxKrw")} className={inputClass} placeholder="원 단위" /></FormField> : null}
                  {showField(targetId, "durationMinutes") ? <FormField id={rowInputId(index, "durationMinutes")} label="실제 소요 시간(분)" review={review("durationMinutes")} issue={issue("durationMinutes")}><input id={rowInputId(index, "durationMinutes")} value={row.durationMinutes ?? ""} inputMode="numeric" onChange={(event) => updateRow(index, (current) => ({ ...current, durationMinutes: nullableInteger(event.target.value) }))} aria-invalid={Boolean(issue("durationMinutes"))} aria-describedby={describe("durationMinutes")} className={inputClass} placeholder="15분 이상 입력" /></FormField> : null}
                  {showField(targetId, "note") ? <FormField id={rowInputId(index, "note")} label="행 메모" review={review("note")} className="md:col-span-2 xl:col-span-3"><textarea id={rowInputId(index, "note")} value={row.note ?? ""} onChange={(event) => updateRow(index, (current) => ({ ...current, note: nullableText(event.target.value) }))} aria-describedby={describe("note")} className={`${inputClass} min-h-20 py-3`} placeholder="털 상태, 포함 항목 등" /></FormField> : null}
                </div>
              </article>
            );
          })}
        </div>
        <button id="price-guide-add-row" type="button" onClick={() => onChange({ ...document, rows: [...document.rows, emptyRow()] })} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-[10px] border border-dashed border-[#aebdce] bg-white text-[13px] font-medium text-[#526174] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d3557]"><Plus className="h-4 w-4" aria-hidden="true" />요금 행 추가</button>
      </section>

      <section className="mt-6 border-t border-[#e2e8f0] pt-5" aria-labelledby="price-guide-surcharges-heading">
        <div className="flex items-center justify-between gap-3"><h3 id="price-guide-surcharges-heading" className="text-[16px] font-semibold text-[#172033]">추가요금</h3><span className="text-[12px] font-normal text-[#7a8798]">조건별 금액 또는 비율</span></div>
        <div className="mt-3 space-y-3">
          {document.surcharges.map((surcharge, index) => {
            const targetId = `surcharges:${index}`;
            const pending = document.aiReview.some((review) => review.targetId === targetId && isPending(review));
            if (showPendingOnly && !pending) return null;
            const update = (next: PriceGuideV2Surcharge) => onChange({ ...document, surcharges: document.surcharges.map((item, itemIndex) => itemIndex === index ? next : item) });
            const reviewsFor = (field: keyof PriceGuideV2Surcharge) => fieldReviews(document, targetId, field);
            return (
              <article key={targetId} className="rounded-[14px] border border-[#dce4ed] bg-white p-4">
                <div className="flex justify-end"><button type="button" onClick={() => onChange({ ...document, surcharges: document.surcharges.filter((_, itemIndex) => itemIndex !== index), aiReview: removeIndexedReviews(document.aiReview, "surcharges", index) })} aria-label={`추가요금 ${index + 1} 삭제`} className="flex h-11 w-11 items-center justify-center rounded-[10px] text-[#7a8798] hover:bg-[#f2f4f7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d3557]"><Trash2 className="h-4 w-4" aria-hidden="true" /></button></div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <FormField id={surchargeInputId(index, "condition")} label="적용 조건" review={<FieldReview reviews={reviewsFor("condition")} descriptionId={`${surchargeInputId(index, "condition")}-review`} onResolve={(resolution) => resolveReview(targetId, "condition", resolution)} />}><input id={surchargeInputId(index, "condition")} value={surcharge.condition ?? ""} onChange={(event) => update({ ...surcharge, condition: nullableText(event.target.value) })} className={inputClass} placeholder="예: 털 엉킴" /></FormField>
                  <FormField id={surchargeInputId(index, "amountKrw")} label="추가 금액(원)" review={<FieldReview reviews={reviewsFor("amountKrw")} descriptionId={`${surchargeInputId(index, "amountKrw")}-review`} onResolve={(resolution) => resolveReview(targetId, "amountKrw", resolution)} />}><input id={surchargeInputId(index, "amountKrw")} value={surcharge.amountKrw ?? ""} inputMode="numeric" onChange={(event) => update({ ...surcharge, amountKrw: nullableInteger(event.target.value), percent: null })} className={inputClass} placeholder="금액 또는 비율 중 하나" /></FormField>
                  <FormField id={surchargeInputId(index, "percent")} label="추가 비율(%)" review={<FieldReview reviews={reviewsFor("percent")} descriptionId={`${surchargeInputId(index, "percent")}-review`} onResolve={(resolution) => resolveReview(targetId, "percent", resolution)} />}><input id={surchargeInputId(index, "percent")} value={surcharge.percent ?? ""} inputMode="numeric" onChange={(event) => update({ ...surcharge, percent: nullableInteger(event.target.value), amountKrw: null })} className={inputClass} placeholder="금액 또는 비율 중 하나" /></FormField>
                  <FormField id={surchargeInputId(index, "note")} label="메모" review={<FieldReview reviews={reviewsFor("note")} descriptionId={`${surchargeInputId(index, "note")}-review`} onResolve={(resolution) => resolveReview(targetId, "note", resolution)} />}><input id={surchargeInputId(index, "note")} value={surcharge.note ?? ""} onChange={(event) => update({ ...surcharge, note: nullableText(event.target.value) })} className={inputClass} placeholder="예: 시작 금액" /></FormField>
                </div>
              </article>
            );
          })}
        </div>
        <button type="button" onClick={() => onChange({ ...document, surcharges: [...document.surcharges, emptySurcharge()] })} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-[10px] border border-dashed border-[#aebdce] bg-white text-[13px] font-medium text-[#526174] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d3557]"><Plus className="h-4 w-4" aria-hidden="true" />추가요금 추가</button>
      </section>

      <section className="mt-6 border-t border-[#e2e8f0] pt-5" aria-labelledby="price-guide-note-heading">
        <h3 id="price-guide-note-heading" className="text-[16px] font-semibold text-[#172033]">전체 메모</h3>
        <FormField id="price-guide-overall-note" label="요금표 전체에 적용되는 안내" className="mt-3" review={<FieldReview reviews={document.aiReview.filter((review) => review.field === "overallNote")} descriptionId="price-guide-overall-note-review" onResolve={(resolution) => resolveMatchingReviews((review) => review.field === "overallNote", resolution)} />}><textarea id="price-guide-overall-note" value={document.overallNote ?? ""} onChange={(event) => onChange({ ...document, overallNote: nullableText(event.target.value) })} className={`${inputClass} min-h-28 py-3`} placeholder="예: 모량과 털 상태에 따라 최종 금액이 달라질 수 있습니다." /></FormField>
      </section>

      {!manualMode && document.aiReview.length > 0 ? (pendingCount === 0 ? <p className="mt-5 flex items-center gap-2 rounded-[10px] bg-[#edf7f2] px-4 py-3 text-[13px] font-medium text-[#177856]"><CheckCircle2 className="h-4 w-4" aria-hidden="true" />확인 필요 항목 0개</p> : <p className="mt-5 flex items-center gap-2 rounded-[10px] bg-[#fff9ec] px-4 py-3 text-[13px] font-medium text-[#765617]"><AlertCircle className="h-4 w-4" aria-hidden="true" />확인 필요 {pendingCount}개를 처리하면 다음 단계로 갈 수 있어요.</p>) : null}
    </div>
  );
}
