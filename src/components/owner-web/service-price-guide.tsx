"use client";

import { useState } from "react";
import { PencilLine, Plus } from "lucide-react";

import { BasilIcon } from "@/components/owner-web/basil-icon";
import { cn } from "@/lib/utils";

export type ServicePriceGuideCell = {
  price: string;
  durationMinutes: string;
};

export type ServicePriceGuideSection = {
  id: string;
  title: string;
  note: string;
  weightBands: string[];
  items: Array<{
    id: string;
    label: string;
    cells: Record<string, ServicePriceGuideCell>;
  }>;
};

export type ServicePriceGuideExtraFee = {
  id: string;
  label: string;
  price: string;
};

export type ServicePriceGuide = {
  enabled: boolean;
  weightBands: string[];
  items: Array<{
    id: string;
    label: string;
    durationMinutes: string;
    prices: Record<string, string>;
  }>;
  sections?: ServicePriceGuideSection[];
  extraNote: string;
  extraFees: ServicePriceGuideExtraFee[];
};

type DeleteTarget =
  | { kind: "section"; sectionId: string; title: string }
  | { kind: "item"; sectionId: string; itemId: string; title: string }
  | { kind: "weight"; sectionId: string; index: number; title: string };

const defaultExtraNote = [
  "얼굴 가위컷 추가 +5,000원",
  "포메 라인컷, 곰돌이 얼굴컷, 털엉킴, 입질, 피부 상태에 따라 추가 요금이 발생할 수 있어요.",
  "미용 시간은 아이 상태와 현장 상담에 따라 달라질 수 있어요.",
].join("\n");

const defaultExtraFees: ServicePriceGuideExtraFee[] = [
  { id: "face_cut", label: "기본 얼굴컷", price: "5,000" },
  { id: "nail", label: "발톱컷", price: "10,000" },
  { id: "matting_fee", label: "털엉킴", price: "5,000~" },
  { id: "manner_fee", label: "매너 추가", price: "5,000" },
  { id: "coat_length_fee", label: "모량/기장 추가", price: "5,000" },
];

function createGuideItemId() {
  return `price_item_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function createGuideSectionId() {
  return `price_section_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function createExtraFeeId() {
  return `extra_fee_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function normalizePriceText(value: string) {
  return value.replace(/[^0-9]/g, "");
}

function normalizeMinutesText(value: string) {
  return value.replace(/[^0-9]/g, "");
}

function formatPriceInput(value: string) {
  const numericValue = Number(normalizePriceText(value));
  if (!numericValue) return "";
  return numericValue.toLocaleString("ko-KR");
}

function buildCells(weightBands: string[], prices: string[], durations: string[]) {
  return Object.fromEntries(
    weightBands.map((band, index) => [
      band,
      {
        price: normalizePriceText(prices[index] ?? ""),
        durationMinutes: normalizeMinutesText(durations[index] ?? ""),
      },
    ]),
  );
}

function buildSection({
  id,
  title,
  note,
  weightBands,
  items,
}: {
  id: string;
  title: string;
  note: string;
  weightBands: string[];
  items: Array<{ id: string; label: string; prices: string[]; durations: string[] }>;
}): ServicePriceGuideSection {
  return {
    id,
    title,
    note,
    weightBands,
    items: items.map((item) => ({
      id: item.id,
      label: item.label,
      cells: buildCells(weightBands, item.prices, item.durations),
    })),
  };
}

const basicWeightBands = ["4kg 이하", "6kg 이하", "8kg 이하"];
const plusPremiumWeightBands = ["4kg 이하", "6kg 이하", "8kg 이하", "10kg 이하"];
const removedDefaultItemLabels = new Set(["빡빡이"]);

const defaultGuideSections: ServicePriceGuideSection[] = [
  buildSection({
    id: "basic",
    title: "베이직",
    note: "말티즈, 포메라니안, 토이푸들, 시츄, 요크셔테리어, 치와와, 빠삐용 등",
    weightBands: basicWeightBands,
    items: [
      { id: "basic_hygiene_bath", label: "위생미용+목욕", prices: ["30000", "35000", "40000"], durations: ["60", "70", "80"] },
      { id: "basic_clipping", label: "클리핑", prices: ["45000", "50000", "55000"], durations: ["90", "100", "110"] },
      { id: "basic_spotting", label: "스포팅", prices: ["70000", "80000", "90000"], durations: ["120", "140", "160"] },
      { id: "basic_scissor", label: "가위컷", prices: ["90000", "100000", "110000"], durations: ["150", "170", "190"] },
    ],
  }),
  buildSection({
    id: "plus",
    title: "플러스",
    note: "미니어처푸들, 말티푸, 스피츠, 슈나우저, 비글, 패키니즈, 믹스견 등",
    weightBands: plusPremiumWeightBands,
    items: [
      { id: "plus_hygiene_bath", label: "위생미용+목욕", prices: ["35000", "40000", "45000", "50000"], durations: ["70", "80", "90", "100"] },
      { id: "plus_clipping", label: "클리핑", prices: ["50000", "55000", "60000", "65000"], durations: ["100", "110", "120", "130"] },
      { id: "plus_spotting", label: "스포팅", prices: ["80000", "90000", "100000", "110000"], durations: ["140", "160", "180", "200"] },
      { id: "plus_scissor", label: "가위컷", prices: ["100000", "110000", "120000", "130000"], durations: ["170", "190", "210", "230"] },
    ],
  }),
  buildSection({
    id: "premium",
    title: "프리미엄",
    note: "비숑프리제, 꼬똥드툴레아, 코카스파니엘, 웰시코기, 베들링턴테리어 등",
    weightBands: plusPremiumWeightBands,
    items: [
      { id: "premium_hygiene_bath", label: "위생미용+목욕", prices: ["40000", "45000", "50000", "55000"], durations: ["80", "90", "100", "110"] },
      { id: "premium_clipping", label: "클리핑", prices: ["60000", "65000", "70000", "75000"], durations: ["120", "130", "140", "150"] },
      { id: "premium_spotting", label: "스포팅", prices: ["90000", "100000", "110000", "120000"], durations: ["160", "180", "200", "220"] },
      { id: "premium_scissor", label: "가위컷", prices: ["110000", "120000", "130000", "140000"], durations: ["190", "210", "230", "250"] },
    ],
  }),
];

function cloneDefaultSections() {
  return defaultGuideSections.map((section) => ({
    ...section,
    weightBands: [...section.weightBands],
    items: section.items.map((item) => ({
      ...item,
      cells: Object.fromEntries(
        Object.entries(item.cells).map(([band, cell]) => [band, { ...cell }]),
      ),
    })),
  }));
}

function cloneDefaultExtraFees() {
  return defaultExtraFees.map((fee) => ({ ...fee }));
}

function normalizeExtraFees(value: unknown): ServicePriceGuideExtraFee[] {
  if (!Array.isArray(value)) return cloneDefaultExtraFees();

  const rows = value
    .map((row, index) => {
      if (!row || typeof row !== "object") return null;
      const source = row as Partial<ServicePriceGuideExtraFee>;
      const fallback = defaultExtraFees[index];
      const label = typeof source.label === "string" ? source.label.trim() : "";
      const price = typeof source.price === "string" ? source.price.trim() : "";

      return {
        id: typeof source.id === "string" && source.id ? source.id : createExtraFeeId(),
        label: label || fallback?.label || `추가 비용 ${index + 1}`,
        price: price || fallback?.price || "",
      };
    })
    .filter((row): row is ServicePriceGuideExtraFee => Boolean(row));

  return rows.length > 0 ? rows : cloneDefaultExtraFees();
}

function legacyItemsFromSections(sections: ServicePriceGuideSection[]) {
  const firstSection = sections[0];
  if (!firstSection) return [];
  return firstSection.items.map((item) => ({
    id: item.id,
    label: item.label,
    durationMinutes: firstSection.weightBands.map((band) => item.cells[band]?.durationMinutes ?? "").find(Boolean) ?? "",
    prices: Object.fromEntries(firstSection.weightBands.map((band) => [band, item.cells[band]?.price ?? ""])),
  }));
}

function normalizeCell(value: unknown): ServicePriceGuideCell {
  if (!value || typeof value !== "object") {
    return { price: "", durationMinutes: "" };
  }
  const source = value as Partial<ServicePriceGuideCell>;
  return {
    price: normalizePriceText(String(source.price ?? "")),
    durationMinutes: normalizeMinutesText(String(source.durationMinutes ?? "")),
  };
}

function normalizeWeightBandLabel(value: string) {
  const label = value.trim();
  const upperBound = label.match(/(?:~|～|~\s*)?(\d+(?:\.\d+)?)\s*kg$/i) ?? label.match(/\d+(?:\.\d+)?\s*~\s*(\d+(?:\.\d+)?)\s*kg/i);
  if (label.endsWith("이하")) return label;
  if (!upperBound) return label;
  return `${upperBound[1]}kg 이하`;
}

function normalizeWeightBands(value: unknown, fallback: string[]) {
  if (!Array.isArray(value) || value.length === 0) return [...fallback];
  const labels = value.filter((band): band is string => typeof band === "string");
  return labels.length > 0 ? labels : [...fallback];
}

function normalizeGuideItems(items: ServicePriceGuideSection["items"]) {
  return items.filter((item) => !removedDefaultItemLabels.has(item.label.trim()));
}

function isLegacyDefaultGuide(value: unknown[]) {
  const legacySectionTitles = new Set(["소형견", "중형견", "특수견/대형견", "고양이 미용"]);
  const legacyItemLabels = new Set(["목욕", "부분미용", "부분+목욕", "썸머컷 추가", "전체 가위컷", "단모 목욕", "단모 미용", "장모 목욕", "장모 미용", "염색"]);
  const hasModernPriceGuideShape = value.some((section) => {
    if (!section || typeof section !== "object") return false;
    const source = section as Partial<ServicePriceGuideSection>;
    return Array.isArray(source.items) && source.items.some((item) => {
      if (!item || typeof item !== "object") return false;
      return "cells" in item;
    });
  });

  if (hasModernPriceGuideShape) return false;

  return value.some((section) => {
    if (!section || typeof section !== "object") return false;
    const source = section as Partial<ServicePriceGuideSection>;
    if (typeof source.title === "string" && legacySectionTitles.has(source.title.trim())) return true;
    return Array.isArray(source.items) && source.items.some((item) => {
      const label = typeof item?.label === "string" ? item.label.trim() : "";
      return legacyItemLabels.has(label);
    });
  });
}

function cloneSectionsSnapshot(source: ServicePriceGuideSection[]) {
  return source.map((section) => ({
    ...section,
    weightBands: [...section.weightBands],
    items: section.items.map((item) => ({
      ...item,
      cells: Object.fromEntries(Object.entries(item.cells).map(([band, cell]) => [band, { ...cell }])),
    })),
  }));
}

function mergeMissingDefaultItems(
  sourceItems: ServicePriceGuideSection["items"],
  fallbackItems: ServicePriceGuideSection["items"],
) {
  const seenKeys = new Set(
    sourceItems.flatMap((item) => [
      item.id.trim(),
      item.label.trim(),
    ]),
  );

  return [
    ...sourceItems,
    ...fallbackItems.filter((item) => !seenKeys.has(item.id.trim()) && !seenKeys.has(item.label.trim())),
  ];
}

function buildEmptySectionCells(weightBands: string[]) {
  return Object.fromEntries(weightBands.map((band) => [band, { price: "", durationMinutes: "" }])) as Record<string, ServicePriceGuideCell>;
}

function createBlankSectionFromTemplate(
  template: ServicePriceGuideSection,
  title: string,
): ServicePriceGuideSection {
  const weightBands = template.weightBands.length > 0 ? [...template.weightBands] : [...basicWeightBands];
  const sourceItems = template.items.length > 0 ? template.items : defaultGuideSections[0].items;

  return {
    id: createGuideSectionId(),
    title,
    note: "",
    weightBands,
    items: sourceItems.map((item) => ({
      id: createGuideItemId(),
      label: item.label.trim() || "새 항목",
      cells: buildEmptySectionCells(weightBands),
    })),
  };
}

function normalizeSections(value: unknown): ServicePriceGuideSection[] {
  if (!Array.isArray(value) || value.length === 0) return cloneDefaultSections();
  if (isLegacyDefaultGuide(value)) return cloneDefaultSections();

  return value.map((section, sectionIndex) => {
    const source = section as Partial<ServicePriceGuideSection>;
    const fallback = defaultGuideSections[sectionIndex] ?? defaultGuideSections[0];
    const sourceWeightBands = Array.isArray(source.weightBands) ? source.weightBands.filter((band): band is string => typeof band === "string") : [];
    const weightBands = normalizeWeightBands(sourceWeightBands, fallback.weightBands);
    const normalizedSourceItems =
      Array.isArray(source.items) && source.items.length > 0
        ? normalizeGuideItems(source.items as ServicePriceGuideSection["items"])
        : fallback.items;
    const shouldMergeDefaultItems = source.id === fallback.id || source.title === fallback.title;
    const sourceItems =
      normalizedSourceItems.length > 0
        ? shouldMergeDefaultItems
          ? mergeMissingDefaultItems(normalizedSourceItems, fallback.items)
          : normalizedSourceItems
        : fallback.items;

    return {
      id: typeof source.id === "string" && source.id ? source.id : createGuideSectionId(),
      title: typeof source.title === "string" ? source.title : fallback.title,
      note: typeof source.note === "string" ? source.note : fallback.note,
      weightBands,
      items: sourceItems.map((item, itemIndex) => {
        const sourceItem = item as Partial<ServicePriceGuideSection["items"][number]>;
        const fallbackItem = fallback.items[itemIndex] ?? fallback.items[0];
        const cells = typeof sourceItem.cells === "object" && sourceItem.cells ? sourceItem.cells : {};
        return {
          id: typeof sourceItem.id === "string" && sourceItem.id ? sourceItem.id : createGuideItemId(),
          label: typeof sourceItem.label === "string" ? sourceItem.label : fallbackItem.label,
          cells: Object.fromEntries(
            weightBands.map((band, bandIndex) => {
              const sourceBand = sourceWeightBands[bandIndex] ?? band;
              return [band, normalizeCell(cells[band] ?? cells[sourceBand] ?? fallbackItem.cells[band])];
            }),
          ) as Record<string, ServicePriceGuideCell>,
        };
      }),
    };
  });
}

export function buildDefaultServicePriceGuide(): ServicePriceGuide {
  const sections = cloneDefaultSections();
  return {
    enabled: false,
    weightBands: [...sections[0].weightBands],
    items: legacyItemsFromSections(sections),
    sections,
    extraNote: defaultExtraNote,
    extraFees: cloneDefaultExtraFees(),
  };
}

export function normalizeServicePriceGuide(value: unknown): ServicePriceGuide {
  const fallback = buildDefaultServicePriceGuide();
  if (!value || typeof value !== "object") return fallback;

  const source = value as Partial<ServicePriceGuide>;
  const sections = normalizeSections(source.sections);
  return {
    enabled: Boolean(source.enabled),
    weightBands: [...(sections[0]?.weightBands ?? fallback.weightBands)],
    items: legacyItemsFromSections(sections),
    sections,
    extraNote:
      typeof source.extraNote === "string" && source.extraNote.trim()
        ? source.extraNote.trim()
        : fallback.extraNote,
    extraFees: normalizeExtraFees(source.extraFees),
  };
}

export function summarizeServicePriceGuide(guide: ServicePriceGuide) {
  if (!guide.enabled) return "";
  const normalized = normalizeServicePriceGuide(guide);
  const sections = normalized.sections ?? [];
  const rowCount = sections.reduce((total, section) => total + section.weightBands.length, 0);
  const itemCount = sections.reduce((total, section) => total + section.items.length, 0);
  return `${sections.length}개 그룹 · ${rowCount}개 무게 · ${itemCount}개 항목`;
}

export function ServicePriceGuideEditor({
  value,
  onChange,
  framed = true,
  showHeader = true,
  showEnabledToggle = true,
}: {
  value: ServicePriceGuide;
  onChange: (value: ServicePriceGuide) => void;
  framed?: boolean;
  showHeader?: boolean;
  showEnabledToggle?: boolean;
}) {
  const guide = normalizeServicePriceGuide(value);
  const sections = guide.sections ?? [];
  const [pendingDelete, setPendingDelete] = useState<DeleteTarget | null>(null);
  const [deleteHistory, setDeleteHistory] = useState<ServicePriceGuideSection[][]>([]);

  function updateSections(nextSections: ServicePriceGuideSection[]) {
    onChange({
      ...guide,
      sections: nextSections,
      weightBands: [...(nextSections[0]?.weightBands ?? [])],
      items: legacyItemsFromSections(nextSections),
    });
  }

  function updateExtraFees(nextExtraFees: ServicePriceGuideExtraFee[]) {
    onChange({ ...guide, extraFees: nextExtraFees });
  }

  function updateExtraFee(rowId: string, patch: Partial<ServicePriceGuideExtraFee>) {
    updateExtraFees(guide.extraFees.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  }

  function addExtraFee() {
    updateExtraFees([...guide.extraFees, { id: createExtraFeeId(), label: "", price: "" }]);
  }

  function removeExtraFee(rowId: string) {
    updateExtraFees(guide.extraFees.filter((row) => row.id !== rowId));
  }

  function commitDelete(nextSections: ServicePriceGuideSection[]) {
    setDeleteHistory((history) => [cloneSectionsSnapshot(sections), ...history].slice(0, 3));
    updateSections(nextSections);
    setPendingDelete(null);
  }

  function restoreLastDelete() {
    const [snapshot, ...rest] = deleteHistory;
    if (!snapshot) return;
    setDeleteHistory(rest);
    updateSections(cloneSectionsSnapshot(snapshot));
  }

  function confirmPendingDelete() {
    if (!pendingDelete) return;

    if (pendingDelete.kind === "section") {
      if (sections.length <= 1) return setPendingDelete(null);
      commitDelete(sections.filter((section) => section.id !== pendingDelete.sectionId));
      return;
    }

    if (pendingDelete.kind === "item") {
      commitDelete(
        sections.map((section) =>
          section.id === pendingDelete.sectionId && section.items.length > 1
            ? { ...section, items: section.items.filter((item) => item.id !== pendingDelete.itemId) }
            : section,
        ),
      );
      return;
    }

    commitDelete(
      sections.map((section) => {
        if (section.id !== pendingDelete.sectionId || section.weightBands.length <= 1) return section;
        const removedLabel = section.weightBands[pendingDelete.index] ?? "";
        const weightBands = section.weightBands.filter((_, bandIndex) => bandIndex !== pendingDelete.index);
        return {
          ...section,
          weightBands,
          items: section.items.map((item) => {
            const cells = { ...item.cells };
            if (!weightBands.includes(removedLabel)) {
              delete cells[removedLabel];
            }
            return { ...item, cells };
          }),
        };
      }),
    );
  }

  function updateSection(sectionId: string, patch: Partial<ServicePriceGuideSection>) {
    updateSections(sections.map((section) => (section.id === sectionId ? { ...section, ...patch } : section)));
  }

  function updateWeightBand(sectionId: string, index: number, nextLabel: string) {
    updateSections(
      sections.map((section) => {
        if (section.id !== sectionId) return section;
        const previousLabel = section.weightBands[index];
        const label = nextLabel;
        const weightBands = section.weightBands.map((band, bandIndex) => (bandIndex === index ? label : band));
        const items = section.items.map((item) => {
          const cells = { ...item.cells };
          if (previousLabel !== label) {
            cells[label] = cells[previousLabel] ?? { price: "", durationMinutes: "" };
            delete cells[previousLabel];
          }
          return { ...item, cells };
        });
        return { ...section, weightBands, items };
      }),
    );
  }

  function addWeightBand(sectionId: string) {
    updateSections(
      sections.map((section) => {
        if (section.id !== sectionId) return section;
        const nextLabel = `~${section.weightBands.length * 2 + 4}kg`;
        return {
          ...section,
          weightBands: [...section.weightBands, nextLabel],
          items: section.items.map((item) => ({
            ...item,
            cells: { ...item.cells, [nextLabel]: { price: "", durationMinutes: "" } },
          })),
        };
      }),
    );
  }

  function removeWeightBand(sectionId: string, index: number) {
    const section = sections.find((item) => item.id === sectionId);
    if (!section || section.weightBands.length <= 1) return;
    setPendingDelete({ kind: "weight", sectionId, index, title: `${section.title} · ${section.weightBands[index] ?? "무게 구간"}` });
  }

  function updateItemLabel(sectionId: string, itemId: string, label: string) {
    updateSections(
      sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              items: section.items.map((item) => (item.id === itemId ? { ...item, label } : item)),
            }
          : section,
      ),
    );
  }

  function addItem(sectionId: string) {
    updateSections(
      sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              items: [
                ...section.items,
                {
                  id: createGuideItemId(),
                  label: "새 항목",
                  cells: Object.fromEntries(section.weightBands.map((band) => [band, { price: "", durationMinutes: "" }])),
                },
              ],
            }
          : section,
      ),
    );
  }

  function removeItem(sectionId: string, itemId: string) {
    const section = sections.find((item) => item.id === sectionId);
    const targetItem = section?.items.find((item) => item.id === itemId);
    if (!section || !targetItem || section.items.length <= 1) return;
    setPendingDelete({ kind: "item", sectionId, itemId, title: `${section.title} · ${targetItem.label}` });
  }

  function updateCell(sectionId: string, itemId: string, band: string, patch: Partial<ServicePriceGuideCell>) {
    updateSections(
      sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              items: section.items.map((item) =>
                item.id === itemId
                  ? {
                      ...item,
                      cells: {
                        ...item.cells,
                        [band]: {
                          price: patch.price !== undefined ? normalizePriceText(patch.price) : (item.cells[band]?.price ?? ""),
                          durationMinutes:
                            patch.durationMinutes !== undefined
                              ? normalizeMinutesText(patch.durationMinutes)
                              : (item.cells[band]?.durationMinutes ?? ""),
                        },
                      },
                    }
                  : item,
              ),
            }
          : section,
      ),
    );
  }

  function addSection() {
    const template = sections[sections.length - 1] ?? defaultGuideSections[0];
    const newGroupCount = sections.filter((section) => section.title.trim().startsWith("새 그룹")).length + 1;
    const title = newGroupCount === 1 ? "새 그룹" : `새 그룹 ${newGroupCount}`;
    updateSections([...sections, createBlankSectionFromTemplate(template, title)]);
  }

  function removeSection(sectionId: string) {
    if (sections.length <= 1) return;
    const section = sections.find((item) => item.id === sectionId);
    setPendingDelete({ kind: "section", sectionId, title: section?.title ?? "그룹" });
  }

  const content = (
    <>
      {showHeader || showEnabledToggle ? (
        <div className="flex items-start justify-between gap-4">
          {showHeader ? (
            <div>
              <p className="text-[16px] font-normal text-[#111827]">실제 요금표</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <p className="text-[16px] font-normal leading-6 text-[#64748b]">그룹과 무게별로 금액 / 예상시간을 함께 관리합니다.</p>
                {guide.enabled ? (
                  <span className="inline-flex h-7 items-center gap-1 rounded-full border border-[#dbe2ea] bg-white px-2.5 text-[14px] font-normal text-[#607080]">
                    <PencilLine className="h-3.5 w-3.5" strokeWidth={1.8} />
                    입력칸을 클릭해 수정
                  </span>
                ) : null}
              </div>
            </div>
          ) : (
            <span />
          )}
          {showEnabledToggle ? (
            <button
              type="button"
              onClick={() => onChange({ ...guide, enabled: !guide.enabled })}
              className={cn(
                "flex h-8 min-w-[64px] items-center justify-center rounded-[8px] border px-3 text-[16px] font-normal",
                guide.enabled ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[#dbe2ea] bg-[#f8fafc] text-[#64748b]",
              )}
            >
              {guide.enabled ? "사용" : "미사용"}
            </button>
          ) : null}
        </div>
      ) : null}

      {guide.enabled ? (
        <div className={cn("space-y-4", showHeader || showEnabledToggle ? "mt-4" : "")}>
          <div className="space-y-3">
            {sections.map((section) => (
              <section key={section.id} className="overflow-hidden rounded-[8px] border border-[#d1d5db] bg-white">
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#e5e7eb] bg-[#fafafa] px-3 py-2">
                  <div className="min-w-[240px] flex-1">
                    <div className="grid gap-2 sm:grid-cols-[150px_minmax(0,1fr)]">
                      <div className="group relative">
                        <input
                          type="text"
                          value={section.title}
                          onChange={(event) => updateSection(section.id, { title: event.target.value })}
                          aria-label="서비스 그룹명 수정"
                          className="h-9 w-full cursor-text rounded-[8px] border border-[#cbd5e1] bg-white px-3 pr-9 text-[16px] font-normal text-[#111827] outline-none transition hover:border-[#94a3b8] focus:border-[var(--accent)] focus:ring-2 focus:ring-[#e8f0f7]"
                        />
                        <PencilLine className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#94a3b8] transition group-focus-within:text-[var(--accent)]" strokeWidth={1.8} />
                      </div>
                      <div className="group relative">
                        <input
                          type="text"
                          value={section.note}
                          onChange={(event) => updateSection(section.id, { note: event.target.value })}
                          placeholder="예: 말티, 요키, 시츄"
                          aria-label="노출 견종 설명 수정"
                          className="h-9 w-full cursor-text rounded-[8px] border border-[#cbd5e1] bg-white px-3 pr-9 text-[16px] font-normal text-[#334155] outline-none transition placeholder:text-[#94a3b8] hover:border-[#94a3b8] focus:border-[var(--accent)] focus:ring-2 focus:ring-[#e8f0f7]"
                        />
                        <PencilLine className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#94a3b8] transition group-focus-within:text-[var(--accent)]" strokeWidth={1.8} />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => addWeightBand(section.id)} className="inline-flex h-9 min-w-[86px] items-center justify-center gap-1.5 rounded-[8px] bg-[var(--accent)] px-3 text-[16px] font-normal text-white shadow-[0_4px_10px_rgba(47,107,212,0.16)] transition hover:bg-[var(--acc-dk,var(--accent))]">
                      <Plus className="h-4 w-4" strokeWidth={1.9} />
                      무게
                    </button>
                    <button type="button" onClick={() => addItem(section.id)} className="inline-flex h-9 min-w-[86px] items-center justify-center gap-1.5 rounded-[8px] bg-[var(--accent)] px-3 text-[16px] font-normal text-white shadow-[0_4px_10px_rgba(47,107,212,0.16)] transition hover:bg-[var(--acc-dk,var(--accent))]">
                      <Plus className="h-4 w-4" strokeWidth={1.9} />
                      항목
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full table-fixed border-collapse text-[16px]" style={{ minWidth: 104 + 116 + section.items.length * 196 + 34 }}>
                    <colgroup>
                      <col className="w-[104px]" />
                      <col className="w-[116px]" />
                      {section.items.map((item) => (
                        <col key={item.id} className="w-[196px]" />
                      ))}
                      <col className="w-[34px]" />
                    </colgroup>
                    <thead>
                      <tr className="bg-[var(--accent)] text-white">
                        <th className="whitespace-nowrap border-b border-r border-[var(--acc-dk,var(--accent))] px-3 py-2 text-center font-normal">그룹</th>
                        <th className="whitespace-nowrap border-b border-r border-[var(--acc-dk,var(--accent))] px-3 py-2 text-center font-normal">무게</th>
                        {section.items.map((item) => (
                          <th key={item.id} className="border-b border-r border-[var(--acc-dk,var(--accent))] px-2 py-2 text-center last:border-r-0">
                            <div className="group flex items-center justify-center gap-1.5">
                              <input
                                type="text"
                                value={item.label}
                                onChange={(event) => updateItemLabel(section.id, item.id, event.target.value)}
                                aria-label={`${item.label} 항목명 수정`}
                                title="클릭해서 항목명 수정"
                                className="h-7 min-w-0 flex-1 cursor-text rounded-[7px] border border-white/20 bg-white/10 px-2 text-center text-[16px] font-normal text-white outline-none transition placeholder:text-white/50 hover:border-white/45 hover:bg-white/15 focus:border-[#d1d5db] focus:bg-white focus:text-[#111827]"
                              />
                              <button
                                type="button"
                                onClick={() => removeItem(section.id, item.id)}
                                disabled={section.items.length <= 1}
                                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] text-white/65 hover:bg-white/10 hover:text-white disabled:opacity-35"
                                aria-label="요금 항목 삭제"
                              >
                                <BasilIcon name="trash" className="h-5 w-5" />
                              </button>
                            </div>
                          </th>
                        ))}
                        <th className="sticky right-0 z-20 w-[34px] border-b border-l border-[var(--acc-dk,var(--accent))] bg-[var(--accent)] shadow-[-6px_0_10px_rgba(15,23,42,0.08)]" />
                      </tr>
                    </thead>
                    <tbody>
                      {section.weightBands.map((band, bandIndex) => (
                        <tr key={`${section.id}-weight-${bandIndex}`}>
                          {bandIndex === 0 ? (
                            <td rowSpan={section.weightBands.length} className="whitespace-nowrap border-r border-t border-[#edf2f7] bg-white px-3 py-2 text-center align-middle text-[16px] font-normal text-[#111827]">
                              {section.title}
                            </td>
                          ) : null}
                          <td className="border-r border-t border-[#edf2f7] px-2 py-2">
                            <div className="group relative">
                              <input
                                type="text"
                                value={band}
                                onChange={(event) => updateWeightBand(section.id, bandIndex, event.target.value)}
                                aria-label={`${band} 무게 구간 수정`}
                                title="클릭해서 무게 구간 수정"
                                className="h-8 w-full cursor-text rounded-[8px] border border-[#dbe2ea] bg-[#fbfdff] px-2 pr-7 text-center text-[16px] font-normal text-[#111827] outline-none transition hover:border-[#94a3b8] focus:border-[var(--accent)] focus:bg-white focus:ring-2 focus:ring-[#e8f0f7]"
                              />
                              <PencilLine className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#94a3b8] opacity-80 transition group-focus-within:text-[var(--accent)]" strokeWidth={1.8} />
                            </div>
                          </td>
                          {section.items.map((item) => {
                            const cell = item.cells[band] ?? { price: "", durationMinutes: "" };
                            return (
                              <td key={item.id} className="border-r border-t border-[#edf2f7] px-2 py-2 last:border-r-0">
                                <div className="group flex h-9 min-w-0 items-center justify-center gap-0.5 whitespace-nowrap rounded-[8px] border border-transparent px-1.5 transition hover:border-[#dbe2ea] hover:bg-[#f8fafc] focus-within:border-[var(--accent)] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#e8f0f7]" title="클릭해서 가격과 시간을 수정">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={formatPriceInput(cell.price)}
                                    onChange={(event) => updateCell(section.id, item.id, band, { price: event.target.value })}
                                    placeholder="-"
                                    aria-label={`${item.label} ${band} 가격 수정`}
                                    className="h-7 w-[64px] shrink-0 cursor-text bg-transparent text-right text-[16px] font-normal tabular-nums text-[#111827] outline-none placeholder:text-[#a3afbd]"
                                  />
                                  <span className="shrink-0 text-[16px] font-normal text-[#94a3b8]">/</span>
                                  <div className="flex w-[76px] shrink-0 items-center gap-0.5">
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      value={cell.durationMinutes}
                                      onChange={(event) => updateCell(section.id, item.id, band, { durationMinutes: event.target.value })}
                                      placeholder="-"
                                      aria-label={`${item.label} ${band} 예상 시간 수정`}
                                      className="h-7 w-[34px] shrink-0 cursor-text bg-transparent text-right text-[16px] font-normal tabular-nums text-[#111827] outline-none placeholder:text-[#a3afbd]"
                                    />
                                    <span className="shrink-0 text-[16px] font-normal text-[#64748b]">분 예상</span>
                                  </div>
                                </div>
                              </td>
                            );
                          })}
                          <td className="sticky right-0 z-10 border-l border-t border-[#d5dde7] bg-white px-0 py-2 text-center shadow-[-6px_0_10px_rgba(15,23,42,0.035)]">
                            <button
                              type="button"
                              onClick={() => removeWeightBand(section.id, bandIndex)}
                              disabled={section.weightBands.length <= 1}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-[7px] text-[#64748b] transition hover:bg-[#f3f4f6] hover:text-[#111827] disabled:opacity-40"
                              aria-label="무게 구간 삭제"
                            >
                              <BasilIcon name="trash" className="h-5 w-5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={addSection} className="inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-[var(--accent)] px-3 text-[16px] font-normal text-white shadow-[0_4px_10px_rgba(47,107,212,0.16)] transition hover:bg-[var(--acc-dk,var(--accent))]">
              <Plus className="h-3.5 w-3.5" strokeWidth={1.9} />
              그룹 추가
            </button>
            {deleteHistory.length > 0 ? (
              <button
                type="button"
                onClick={restoreLastDelete}
                className="inline-flex h-9 items-center rounded-[8px] border border-[#d1d5db] bg-white px-3 text-[16px] font-normal text-[#111827] transition hover:bg-[#f9fafb]"
              >
                삭제 복구 {deleteHistory.length}
              </button>
            ) : null}
          </div>

          <label className="block">
            <span className="text-[16px] font-normal text-[#334155]">추가 요금 안내</span>
            <textarea
              value={guide.extraNote}
              onChange={(event) => onChange({ ...guide, extraNote: event.target.value })}
              rows={4}
              className="mt-2 w-full resize-none rounded-[8px] border border-[#d1d5db] bg-white px-3 py-2.5 text-[16px] font-normal leading-6 text-[#111827] outline-none focus:border-[var(--accent)]"
            />
          </label>

          <section className="overflow-hidden rounded-[8px] border border-[#d1d5db] bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-[#e5e7eb] bg-[#fafafa] px-3 py-2">
              <p className="text-[16px] font-normal text-[#334155]">추가 비용</p>
              <button
                type="button"
                onClick={addExtraFee}
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-[8px] bg-[var(--accent)] px-3 text-[16px] font-normal text-white shadow-[0_4px_10px_rgba(47,107,212,0.16)] transition hover:bg-[var(--acc-dk,var(--accent))]"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={1.9} />
                항목 추가
              </button>
            </div>
            <div className="space-y-2 p-3">
              {guide.extraFees.length > 0 ? (
                guide.extraFees.map((row) => (
                  <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_160px_32px] items-center gap-2">
                    <input
                      type="text"
                      value={row.label}
                      onChange={(event) => updateExtraFee(row.id, { label: event.target.value })}
                      placeholder="예: 털엉킴"
                      className="h-10 min-w-0 rounded-[8px] border border-[#e5e7eb] bg-[#fafafa] px-3 text-[16px] font-normal text-[#111827] outline-none placeholder:text-[#94a3b8] focus:border-[var(--accent)] focus:bg-white"
                    />
                    <input
                      type="text"
                      value={row.price}
                      onChange={(event) => updateExtraFee(row.id, { price: event.target.value })}
                      placeholder="예: 5,000~"
                      className="h-10 min-w-0 rounded-[8px] border border-[#e5e7eb] bg-[#fafafa] px-3 text-right text-[16px] font-normal text-[#111827] outline-none placeholder:text-[#94a3b8] focus:border-[var(--accent)] focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => removeExtraFee(row.id)}
                      className="inline-flex h-10 w-8 items-center justify-center rounded-[8px] text-[#94a3b8] transition hover:bg-[#f1f5f9] hover:text-[#334155]"
                      aria-label="추가 비용 삭제"
                    >
                      <BasilIcon name="trash" className="h-5 w-5" />
                    </button>
                  </div>
                ))
              ) : (
                <button
                  type="button"
                  onClick={addExtraFee}
                  className="flex h-11 w-full items-center justify-center rounded-[8px] border border-dashed border-[#dbe2ea] text-[16px] font-normal text-[#64748b] transition hover:bg-[#f8fafc]"
                >
                  추가 비용 항목을 입력해 주세요.
                </button>
              )}
            </div>
          </section>
        </div>
      ) : null}

      {pendingDelete ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#0f172a]/30 px-4">
          <div className="w-full max-w-[360px] rounded-[10px] border border-[#dbe2ea] bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.18)]">
            <p className="text-[17px] font-semibold tracking-[-0.02em] text-[#111827]">정말 삭제하시겠습니까?</p>
            <p className="mt-2 text-[14px] leading-6 text-[#64748b]">
              {pendingDelete.title} 항목이 삭제됩니다. 최근 삭제 3건까지는 복구할 수 있어요.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="h-11 rounded-[8px] border border-[#dbe2ea] bg-white text-[15px] font-semibold text-[#334155] transition hover:bg-[#f8fafc]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={confirmPendingDelete}
                className="h-11 rounded-[8px] bg-[#8f2438] text-[15px] font-semibold text-white transition hover:bg-[#7b1f31]"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );

  if (!framed) return <div>{content}</div>;

  return <section className="rounded-[10px] border border-[#dbe2ea] bg-white p-4">{content}</section>;
}
