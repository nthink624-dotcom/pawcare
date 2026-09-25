import type {
  PriceGuideV2,
  PriceGuideV2Row,
  PriceGuideV2TableGroup,
  PriceGuideV2WeightBand,
} from "@/types/price-guide-photo-import";
import {
  buildPriceGuideStructuredProjection,
  parsePriceGuideGroupHeading,
  priceGuideWeightBandLabel,
} from "@/lib/price-guide-structured-table";

export const DIRECT_MATRIX_INITIAL_CUTOFFS_KG = [2, 4, 6, 8] as const;
const DIRECT_MATRIX_STARTER_GROUPS = ["소형견", "중형견", "대형견"] as const;
export const DEFAULT_PRICE_GUIDE_SERVICE_NAMES = ["목욕", "부분미용", "전체미용", "스포팅"] as const;
const MAX_GROUPS = 40;
const MAX_WEIGHT_BANDS = 40;
const MAX_ROWS = 200;

export type DirectPriceGuideMatrixGroup = PriceGuideV2TableGroup & {
  cells: PriceGuideV2Row[][];
};

function nullableText(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizedServiceKey(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, "").trim().toLocaleLowerCase("ko-KR");
}

function normalizedBreedKey(value: string) {
  return value.replace(/\s+/g, "").trim().toLocaleLowerCase("ko-KR");
}

export function canonicalPriceGuideServiceName(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || null;
}

function uniqueServiceNames(values: Array<string | null | undefined>, keepOneBlank = false) {
  const seen = new Set<string>();
  let keptBlank = false;
  return values.flatMap((value) => {
    const name = canonicalPriceGuideServiceName(value);
    const key = normalizedServiceKey(name);
    if (!name || !key) {
      if (!keepOneBlank || keptBlank) return [];
      keptBlank = true;
      return [""];
    }
    if (seen.has(key)) return [];
    seen.add(key);
    return [name];
  });
}

function mappedPriceGuideRowIndexes(document: PriceGuideV2, groups: DirectPriceGuideMatrixGroup[]) {
  const cells = groups.flatMap((group, groupIndex) => group.weightBands.flatMap((weightBand, weightIndex) => (
    group.serviceNames.map((serviceName, serviceIndex) => ({
      cell: group.cells[weightIndex]?.[serviceIndex],
      group,
      groupIndex,
      weightBand,
      weightIndex,
      serviceName,
      serviceIndex,
    }))
  )));
  const claimedCells = new Set<string>();
  const mappedRows = new Set<number>();

  document.rows.forEach((row, rowIndex) => {
    const matchingCell = cells.find(({ cell, groupIndex, weightIndex, serviceIndex }) => {
      const slot = `${groupIndex}:${weightIndex}:${serviceIndex}`;
      if (!cell || claimedCells.has(slot)) return false;
      if (row.sourceItemId && cell.sourceItemId) return row.sourceItemId === cell.sourceItemId;
      return JSON.stringify(row) === JSON.stringify(cell);
    });
    const rowServiceKey = normalizedServiceKey(row.serviceName);
    const coordinateCell = matchingCell ?? cells.find(({ group, groupIndex, weightBand, weightIndex, serviceName, serviceIndex }) => {
      const slot = `${groupIndex}:${weightIndex}:${serviceIndex}`;
      return !claimedCells.has(slot)
        && Boolean(rowServiceKey)
        && rowServiceKey === normalizedServiceKey(serviceName)
        && row.species === group.species
        && parsePriceGuideGroupHeading(row.breedGroup).sourceLabel === parsePriceGuideGroupHeading(group.sourceLabel).sourceLabel
        && (
          priceGuideWeightBandLabel(row) === weightBand.label
          || (row.minKg === weightBand.minKg && row.maxKg === weightBand.maxKg)
        );
    });
    if (!coordinateCell) return;
    claimedCells.add(`${coordinateCell.groupIndex}:${coordinateCell.weightIndex}:${coordinateCell.serviceIndex}`);
    mappedRows.add(rowIndex);
  });
  return mappedRows;
}

export function readPreservedPriceGuideRows(document: PriceGuideV2) {
  const mappedRows = mappedPriceGuideRowIndexes(document, readDirectPriceGuideMatrix(document));
  return document.rows.filter((_, rowIndex) => !mappedRows.has(rowIndex));
}

export function directPriceGuideWeightLabel(minKg: number | null, maxKg: number | null) {
  if (minKg !== null && maxKg !== null) return `${minKg}~${maxKg}kg`;
  if (maxKg !== null) return `${maxKg}kg 이하`;
  if (minKg !== null) return `${minKg}kg 이상`;
  return "";
}

function createWeightBand(maxKg: number | null = null): PriceGuideV2WeightBand {
  return {
    label: maxKg === null ? "" : `${maxKg}kg`,
    minKg: null,
    maxKg,
    note: null,
  };
}

function createTableGroup({
  sourceLabel = "",
  serviceNames = [...DEFAULT_PRICE_GUIDE_SERVICE_NAMES],
}: {
  sourceLabel?: string;
  serviceNames?: string[];
} = {}): PriceGuideV2TableGroup {
  return {
    sourceLabel,
    species: "dog",
    breedNames: [],
    sizeClass: "all",
    weightBands: DIRECT_MATRIX_INITIAL_CUTOFFS_KG.map((cutoff) => createWeightBand(cutoff)),
    serviceNames,
    note: null,
  };
}

function createCell(
  group: PriceGuideV2TableGroup,
  weightBand: PriceGuideV2WeightBand,
  serviceName: string,
): PriceGuideV2Row {
  return {
    serviceName: nullableText(serviceName),
    species: group.species,
    breedNames: [...group.breedNames],
    breedGroup: nullableText(group.sourceLabel),
    sizeClass: group.sizeClass,
    minKg: weightBand.minKg,
    maxKg: weightBand.maxKg,
    weightBandLabel: nullableText(weightBand.label),
    priceKind: "fixed",
    priceMinKrw: null,
    priceMaxKrw: null,
    durationMinutes: null,
    note: null,
  };
}

function createMatrixGroup(options?: Parameters<typeof createTableGroup>[0]): DirectPriceGuideMatrixGroup {
  const group = createTableGroup(options);
  return {
    ...group,
    weightBands: group.weightBands.map((band) => ({ ...band })),
    serviceNames: [...group.serviceNames],
    cells: group.weightBands.map((band) => group.serviceNames.map((service) => createCell(group, band, service))),
  };
}

export function createDirectPriceGuideSkeleton(): PriceGuideV2 {
  const groups = DIRECT_MATRIX_STARTER_GROUPS.map((sourceLabel) => createMatrixGroup({
    sourceLabel,
    serviceNames: [...DEFAULT_PRICE_GUIDE_SERVICE_NAMES],
  }));
  return writeDirectPriceGuideMatrix({
    schemaVersion: 2,
    source: "manual",
    overallNote: null,
    rows: [],
    tableGroups: [],
    surcharges: [],
    aiReview: [],
  }, groups);
}

export function readDirectPriceGuideMatrix(document: PriceGuideV2): DirectPriceGuideMatrixGroup[] {
  if (!document.tableGroups?.length) {
    return buildPriceGuideStructuredProjection(document).groups.map((projectionGroup) => {
      const representative = projectionGroup.rows[0];
      const serviceNames = uniqueServiceNames(projectionGroup.rows.map((row) => row.serviceName));
      const weightBands = projectionGroup.weights.map((label) => {
        const row = projectionGroup.rows.find((candidate) => priceGuideWeightBandLabel(candidate) === label);
        return {
          label,
          minKg: row?.minKg ?? null,
          maxKg: row?.maxKg ?? null,
          note: projectionGroup.weightNotes[label] ?? null,
        };
      });
      const group: PriceGuideV2TableGroup = {
        sourceLabel: projectionGroup.sourceLabel,
        species: representative?.species ?? "unknown",
        breedNames: [...projectionGroup.breeds],
        sizeClass: representative?.sizeClass ?? "unknown",
        weightBands,
        serviceNames,
        note: null,
      };
      return {
        ...group,
        cells: weightBands.map((weightBand) => serviceNames.map((serviceName) => {
          const existing = projectionGroup.rows.find((candidate) => (
            priceGuideWeightBandLabel(candidate) === weightBand.label
            && normalizedServiceKey(candidate.serviceName) === normalizedServiceKey(serviceName)
          ));
          return existing
            ? { ...existing, breedNames: [...existing.breedNames] }
            : createCell(group, weightBand, serviceName);
        })),
      };
    });
  }
  let rowIndex = 0;
  return (document.tableGroups ?? []).map((group) => {
    const weightBands = group.weightBands.map((band) => ({ ...band }));
    const sourceLabel = parsePriceGuideGroupHeading(group.sourceLabel).sourceLabel;
    const useExplicitCoordinates = Boolean(
      sourceLabel
      && weightBands.length > 0
      && weightBands.every((weightBand) => weightBand.label.trim()),
    );
    const groupRows = useExplicitCoordinates
      ? document.rows.filter((row) => (
        row.species === group.species
        && parsePriceGuideGroupHeading(row.breedGroup).sourceLabel === sourceLabel
      ))
      : [];
    const serviceNames = uniqueServiceNames(group.serviceNames, true);
    const cells = weightBands.map((weightBand) => serviceNames.map((serviceName) => {
      const sequentialRow = document.rows[rowIndex];
      rowIndex += 1;
      const existing = useExplicitCoordinates
        ? groupRows.find((row) => (
          normalizedServiceKey(row.serviceName) === normalizedServiceKey(serviceName)
          && (
            priceGuideWeightBandLabel(row) === weightBand.label
            || (row.minKg === weightBand.minKg && row.maxKg === weightBand.maxKg)
          )
        ))
        : sequentialRow;
      return existing ? { ...existing, breedNames: [...existing.breedNames] } : createCell(group, weightBand, serviceName);
    }));
    return {
      ...group,
      breedNames: [...group.breedNames],
      weightBands,
      serviceNames,
      cells,
    };
  });
}

export function writeDirectPriceGuideMatrix(
  document: PriceGuideV2,
  groups: DirectPriceGuideMatrixGroup[],
  options: { discardOriginalRowIndexes?: ReadonlySet<number> } = {},
): PriceGuideV2 {
  const tableGroups = groups.map(({ cells: _cells, ...group }) => ({
    ...group,
    breedNames: [...group.breedNames],
    weightBands: group.weightBands.map((band) => ({ ...band })),
    serviceNames: [...group.serviceNames],
  }));
  const matrixRows = groups.flatMap((group) => group.weightBands.flatMap((weightBand, weightIndex) => (
    group.serviceNames.map((serviceName, serviceIndex) => {
      const cell = group.cells[weightIndex]?.[serviceIndex] ?? createCell(group, weightBand, serviceName);
      return {
        ...cell,
        serviceName: nullableText(serviceName),
        species: group.species,
        breedNames: [...group.breedNames],
        breedGroup: nullableText(group.sourceLabel),
        sizeClass: group.sizeClass,
        minKg: weightBand.minKg,
        maxKg: weightBand.maxKg,
        weightBandLabel: nullableText(weightBand.label),
      };
    })
  )));
  const fixedRows = document.source === "manual"
    ? matrixRows
    : matrixRows.filter((row) => (
      row.priceMinKrw !== null
      || row.priceMaxKrw !== null
      || row.durationMinutes !== null
      || row.note !== null
    ));
  const mappedRows = mappedPriceGuideRowIndexes(document, groups);
  const preservedRows = document.rows
    .map((row, previousIndex) => ({ row, previousIndex }))
    .filter(({ previousIndex }) => (
      !mappedRows.has(previousIndex)
      && !options.discardOriginalRowIndexes?.has(previousIndex)
    ));
  const rows = [...fixedRows, ...preservedRows.map(({ row }) => ({ ...row, breedNames: [...row.breedNames] }))];
  const nextPreservedIndexByPreviousIndex = new Map(preservedRows.map(({ previousIndex }, offset) => [
    previousIndex,
    fixedRows.length + offset,
  ]));
  const aiReview = document.aiReview.flatMap((review) => {
    const rowTarget = /^rows:(\d+)$/.exec(review.targetId);
    if (!rowTarget) return [review];
    const previousRow = document.rows[Number(rowTarget[1])];
    if (!previousRow) return [];
    const nextPreservedIndex = nextPreservedIndexByPreviousIndex.get(Number(rowTarget[1]));
    if (nextPreservedIndex !== undefined) return [{ ...review, targetId: `rows:${nextPreservedIndex}` }];
    const previousServiceKey = normalizedServiceKey(previousRow.serviceName);
    if (!previousServiceKey) return [];
    const nextRowIndex = fixedRows.findIndex((row) => (
      (previousRow.sourceItemId && row.sourceItemId
        ? previousRow.sourceItemId === row.sourceItemId
        : normalizedServiceKey(row.serviceName) === previousServiceKey
          && row.species === previousRow.species
          && parsePriceGuideGroupHeading(row.breedGroup).sourceLabel === parsePriceGuideGroupHeading(previousRow.breedGroup).sourceLabel
          && (
            priceGuideWeightBandLabel(row) === priceGuideWeightBandLabel(previousRow)
            || (row.minKg === previousRow.minKg && row.maxKg === previousRow.maxKg)
          ))
    ));
    return nextRowIndex < 0 ? [] : [{ ...review, targetId: `rows:${nextRowIndex}` }];
  });
  return {
    ...document,
    tableGroups,
    rows,
    aiReview,
  };
}

function updateGroups(
  document: PriceGuideV2,
  update: (groups: DirectPriceGuideMatrixGroup[]) => void,
  options: { discardRemovedMatrixRows?: boolean } = {},
) {
  const groups = readDirectPriceGuideMatrix(document);
  const mappedBefore = options.discardRemovedMatrixRows
    ? mappedPriceGuideRowIndexes(document, groups)
    : null;
  update(groups);
  const mappedAfter = mappedBefore ? mappedPriceGuideRowIndexes(document, groups) : null;
  const discardOriginalRowIndexes = mappedBefore && mappedAfter
    ? new Set([...mappedBefore].filter((rowIndex) => !mappedAfter.has(rowIndex)))
    : undefined;
  return writeDirectPriceGuideMatrix(document, groups, { discardOriginalRowIndexes });
}

function rowCount(groups: DirectPriceGuideMatrixGroup[]) {
  return groups.reduce((total, group) => total + group.weightBands.length * group.serviceNames.length, 0);
}

export function directPriceGuideRowIndex(
  groups: DirectPriceGuideMatrixGroup[],
  groupIndex: number,
  weightIndex: number,
  serviceIndex: number,
) {
  const groupOffset = groups.slice(0, groupIndex)
    .reduce((total, group) => total + group.weightBands.length * group.serviceNames.length, 0);
  return groupOffset + weightIndex * groups[groupIndex].serviceNames.length + serviceIndex;
}

export function updateDirectPriceGuideGroup(
  document: PriceGuideV2,
  groupIndex: number,
  patch: Partial<Pick<PriceGuideV2TableGroup, "sourceLabel" | "species" | "breedNames" | "sizeClass">>,
) {
  return updateGroups(document, (groups) => {
    const nextPatch = { ...patch };
    if (patch.breedNames) {
      const unavailable = new Set(groups.flatMap((group, index) => (
        index === groupIndex ? [] : group.breedNames.map(normalizedBreedKey)
      )));
      const seen = new Set<string>();
      nextPatch.breedNames = patch.breedNames.filter((breed) => {
        const key = normalizedBreedKey(breed);
        if (!key || unavailable.has(key) || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    groups[groupIndex] = { ...groups[groupIndex], ...nextPatch };
  });
}

export function updateDirectPriceGuideWeightBand(
  document: PriceGuideV2,
  groupIndex: number,
  weightIndex: number,
  patch: Pick<PriceGuideV2WeightBand, "minKg" | "maxKg">,
) {
  return updateGroups(document, (groups) => {
    const previous = groups[groupIndex].weightBands[weightIndex];
    groups[groupIndex].weightBands[weightIndex] = {
      ...previous,
      ...patch,
      label: directPriceGuideWeightLabel(patch.minKg, patch.maxKg),
    };
  });
}

/** Photo review edits the visible source label without deriving hidden kg bounds. */
export function updateDirectPriceGuideWeightBandLabel(
  document: PriceGuideV2,
  groupIndex: number,
  weightIndex: number,
  label: string,
) {
  return updateGroups(document, (groups) => {
    const previous = groups[groupIndex].weightBands[weightIndex];
    groups[groupIndex].weightBands[weightIndex] = {
      ...previous,
      label,
      minKg: null,
      maxKg: null,
    };
  });
}

export function updateDirectPriceGuideCell(
  document: PriceGuideV2,
  groupIndex: number,
  weightIndex: number,
  serviceIndex: number,
  patch: Partial<Pick<PriceGuideV2Row, "priceKind" | "priceMinKrw" | "priceMaxKrw" | "durationMinutes" | "note">>,
) {
  return updateGroups(document, (groups) => {
    groups[groupIndex].cells[weightIndex][serviceIndex] = {
      ...groups[groupIndex].cells[weightIndex][serviceIndex],
      ...patch,
    };
  });
}

export function updateDirectPriceGuideService(
  document: PriceGuideV2,
  groupIndex: number,
  serviceIndex: number,
  serviceName: string,
) {
  return updateGroups(document, (groups) => {
    const group = groups[groupIndex];
    const nextKey = normalizedServiceKey(serviceName);
    const duplicate = nextKey && group.serviceNames.some((candidate, index) => (
      index !== serviceIndex && normalizedServiceKey(candidate) === nextKey
    ));
    if (duplicate) return;
    group.serviceNames[serviceIndex] = serviceName;
  });
}

export function addDirectPriceGuideService(document: PriceGuideV2, groupIndex: number) {
  return updateGroups(document, (groups) => {
    const group = groups[groupIndex];
    if (group.serviceNames.length >= 40 || rowCount(groups) + group.weightBands.length > MAX_ROWS) return;
    group.serviceNames.push("");
    group.cells.forEach((row, weightIndex) => {
      row.push(createCell(group, group.weightBands[weightIndex], ""));
    });
  });
}

export function removeDirectPriceGuideService(document: PriceGuideV2, groupIndex: number, serviceIndex: number) {
  return updateGroups(document, (groups) => {
    const group = groups[groupIndex];
    if (group.serviceNames.length <= 1) return;
    group.serviceNames.splice(serviceIndex, 1);
    group.cells.forEach((row) => row.splice(serviceIndex, 1));
  }, { discardRemovedMatrixRows: true });
}

export function addDirectPriceGuideWeightBand(document: PriceGuideV2, groupIndex: number) {
  return updateGroups(document, (groups) => {
    const group = groups[groupIndex];
    if (group.weightBands.length >= MAX_WEIGHT_BANDS || rowCount(groups) + group.serviceNames.length > MAX_ROWS) return;
    const weightBand = createWeightBand();
    group.weightBands.push(weightBand);
    group.cells.push(group.serviceNames.map((service) => createCell(group, weightBand, service)));
  });
}

export function removeDirectPriceGuideWeightBand(document: PriceGuideV2, groupIndex: number, weightIndex: number) {
  return updateGroups(document, (groups) => {
    const group = groups[groupIndex];
    if (group.weightBands.length <= 1) return;
    group.weightBands.splice(weightIndex, 1);
    group.cells.splice(weightIndex, 1);
  }, { discardRemovedMatrixRows: true });
}

export function addDirectPriceGuideGroup(document: PriceGuideV2) {
  return updateGroups(document, (groups) => {
    if (groups.length >= MAX_GROUPS || rowCount(groups) + DIRECT_MATRIX_INITIAL_CUTOFFS_KG.length > MAX_ROWS) return;
    groups.push(createMatrixGroup());
  });
}

export function removeDirectPriceGuideGroup(document: PriceGuideV2, groupIndex: number) {
  return updateGroups(document, (groups) => {
    if (groups.length <= 1) return;
    groups.splice(groupIndex, 1);
  }, { discardRemovedMatrixRows: true });
}
