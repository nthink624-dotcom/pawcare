import type {
  MobilePriceGuideRow,
  MobilePriceGuideTableGroup,
  MobilePriceGuideV2,
  MobilePriceGuideWeightBand,
} from "./mobile-price-photo-adapter";

export const MOBILE_PRICE_GUIDE_INITIAL_CUTOFFS_KG = [2] as const;
const STARTER_GROUPS = ["소형견", "중형견", "대형견"] as const;
const MOBILE_PRICE_GUIDE_WEIGHT_INCREMENT_KG = 2;
export const MOBILE_DEFAULT_PRICE_GUIDE_SERVICES = ["목욕", "부분미용", "전체미용", "스포팅"] as const;
const MAX_GROUPS = 40;
const MAX_BANDS = 40;
const MAX_ROWS = 200;

export type MobilePriceGuideMatrixGroup = MobilePriceGuideTableGroup & {
  cells: MobilePriceGuideRow[][];
};

function nullableText(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizedKey(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, "").trim().toLocaleLowerCase("ko-KR");
}

function uniqueServiceNames(values: Array<string | null | undefined>, keepOneBlank = false) {
  const seen = new Set<string>();
  let keptBlank = false;
  return values.flatMap((value) => {
    const name = value?.trim() ?? "";
    const key = normalizedKey(name);
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

function mappedMobilePriceGuideRowIndexes(document: MobilePriceGuideV2, groups: MobilePriceGuideMatrixGroup[]) {
  const cells = groups.flatMap((group, groupIndex) => group.weightBands.flatMap((band, weightIndex) => (
    group.serviceNames.map((serviceName, serviceIndex) => ({
      cell: group.cells[weightIndex]?.[serviceIndex],
      group,
      groupIndex,
      band,
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
    const rowServiceKey = normalizedKey(row.serviceName);
    const coordinateCell = matchingCell ?? cells.find(({ group, groupIndex, band, weightIndex, serviceName, serviceIndex }) => {
      const slot = `${groupIndex}:${weightIndex}:${serviceIndex}`;
      return !claimedCells.has(slot)
        && Boolean(rowServiceKey)
        && rowServiceKey === normalizedKey(serviceName)
        && row.species === group.species
        && (row.breedGroup?.trim() || "요금표") === (group.sourceLabel.trim() || "요금표")
        && isSameWeightCoordinate(row, band);
    });
    if (!coordinateCell) return;
    claimedCells.add(`${coordinateCell.groupIndex}:${coordinateCell.weightIndex}:${coordinateCell.serviceIndex}`);
    mappedRows.add(rowIndex);
  });
  return mappedRows;
}

export function readPreservedMobilePriceGuideRows(document: MobilePriceGuideV2) {
  const mappedRows = mappedMobilePriceGuideRowIndexes(document, readMobilePriceGuideMatrix(document));
  return document.rows.filter((_, rowIndex) => !mappedRows.has(rowIndex));
}

function createSourceItemId() {
  return `pgi_client_${crypto.randomUUID()}`;
}

function weightLabel(row: Pick<MobilePriceGuideRow, "weightBandLabel" | "minKg" | "maxKg" | "sizeClass">) {
  if (row.weightBandLabel?.trim()) return row.weightBandLabel.trim();
  if (row.minKg !== null && row.maxKg !== null) return `${row.minKg}~${row.maxKg}kg`;
  if (row.maxKg !== null) return `${row.maxKg}kg 이하`;
  if (row.minKg !== null) return `${row.minKg}kg 이상`;
  return row.sizeClass === "all" ? "전체 체급" : "";
}

function upperBoundOnlyKg(label: string) {
  const match = /^~\s*(\d+(?:\.\d+)?)\s*kg$/i.exec(label.trim());
  return match ? Number(match[1]) : null;
}

function isSameWeightCoordinate(
  row: Pick<MobilePriceGuideRow, "weightBandLabel" | "minKg" | "maxKg" | "sizeClass">,
  band: MobilePriceGuideWeightBand,
) {
  if (weightLabel(row) === band.label || (row.minKg === band.minKg && row.maxKg === band.maxKg)) return true;

  // Earlier photo imports expressed every band as an upper bound such as "~ 3kg".
  // Match that legacy coordinate while upgrading it to an actual continuous range.
  const legacyMaxKg = upperBoundOnlyKg(weightLabel(row));
  return legacyMaxKg !== null && row.minKg === null && band.maxKg === legacyMaxKg;
}

function normalizeUpperBoundOnlyWeightBands(weightBands: MobilePriceGuideWeightBand[]) {
  const parsed = weightBands.map((band) => ({ ...band, parsedMaxKg: upperBoundOnlyKg(band.label) }));
  if (!parsed.length || !parsed.every((band) => band.minKg === null && band.parsedMaxKg !== null && band.parsedMaxKg === band.maxKg)) {
    return weightBands.map((band) => ({ ...band }));
  }
  if (parsed.some((band, index) => index > 0 && (band.parsedMaxKg ?? 0) <= (parsed[index - 1].parsedMaxKg ?? 0))) {
    return weightBands.map((band) => ({ ...band }));
  }

  return parsed.map(({ parsedMaxKg, ...band }, index) => {
    const maxKg = parsedMaxKg!;
    const minKg = index === 0 ? null : parsed[index - 1].parsedMaxKg!;
    return {
      ...band,
      label: minKg === null ? `${maxKg}kg 이하` : `${minKg}~${maxKg}kg`,
      minKg,
      maxKg,
    };
  });
}

function createWeightBand(maxKg: number | null = null, minKg: number | null = null): MobilePriceGuideWeightBand {
  return {
    label: maxKg === null ? "" : minKg === null ? `${maxKg}kg 이하` : `${minKg}~${maxKg}kg`,
    minKg,
    maxKg,
    note: null,
  };
}

function createGroup(sourceLabel = "", serviceNames: string[] = ["기본 미용"]): MobilePriceGuideTableGroup {
  return {
    sourceLabel,
    species: "dog",
    breedNames: [],
    sizeClass: "all",
    weightBands: MOBILE_PRICE_GUIDE_INITIAL_CUTOFFS_KG.map((maxKg) => createWeightBand(maxKg)),
    serviceNames,
    note: null,
  };
}

function createCell(
  group: MobilePriceGuideTableGroup,
  band: MobilePriceGuideWeightBand,
  serviceName: string,
): MobilePriceGuideRow {
  return {
    sourceItemId: createSourceItemId(),
    serviceName: nullableText(serviceName),
    species: group.species,
    breedNames: [...group.breedNames],
    breedGroup: nullableText(group.sourceLabel),
    sizeClass: group.sizeClass,
    minKg: band.minKg,
    maxKg: band.maxKg,
    weightBandLabel: nullableText(band.label),
    priceKind: "fixed",
    priceMinKrw: null,
    priceMaxKrw: null,
    durationMinutes: null,
    note: null,
  };
}

function createMatrixGroup(sourceLabel = "", serviceNames: string[] = ["기본 미용"]): MobilePriceGuideMatrixGroup {
  const group = createGroup(sourceLabel, serviceNames);
  return {
    ...group,
    cells: group.weightBands.map((band) => group.serviceNames.map((service) => createCell(group, band, service))),
  };
}

export function createMobilePriceGuideSkeleton(): MobilePriceGuideV2 {
  const groups = [createMatrixGroup(STARTER_GROUPS[0])];
  return writeMobilePriceGuideMatrix({
    schemaVersion: 2,
    source: "manual",
    overallNote: null,
    rows: [],
    tableGroups: [],
    surcharges: [],
    aiReview: [],
  }, groups);
}

function derivedGroups(document: MobilePriceGuideV2): MobilePriceGuideTableGroup[] {
  const groups = new Map<string, MobilePriceGuideTableGroup>();
  for (const row of document.rows) {
    const sourceLabel = row.breedGroup?.trim() || "요금표";
    const key = `${row.species}\u0000${sourceLabel}`;
    const current = groups.get(key) ?? {
      sourceLabel,
      species: row.species,
      breedNames: [],
      sizeClass: row.sizeClass,
      weightBands: [],
      serviceNames: [],
      note: null,
    };
    current.breedNames = [...new Set([...current.breedNames, ...row.breedNames])];
    const label = weightLabel(row);
    if (!current.weightBands.some((band) => band.label === label && band.minKg === row.minKg && band.maxKg === row.maxKg)) {
      current.weightBands.push({ label, minKg: row.minKg, maxKg: row.maxKg, note: null });
    }
    const service = row.serviceName?.trim() ?? "";
    if (!current.serviceNames.includes(service)) current.serviceNames.push(service);
    groups.set(key, current);
  }
  return [...groups.values()];
}

export function readMobilePriceGuideMatrix(document: MobilePriceGuideV2): MobilePriceGuideMatrixGroup[] {
  const groups = document.tableGroups?.length ? document.tableGroups : derivedGroups(document);
  return groups.map((group) => {
    const sourceWeightBands = group.weightBands.map((band) => ({ ...band }));
    const weightBands = normalizeUpperBoundOnlyWeightBands(sourceWeightBands);
    const groupRows = document.rows.filter((row) => (
      (row.breedGroup?.trim() || "요금표") === (group.sourceLabel.trim() || "요금표")
      && row.species === group.species
    ));
    const serviceNames = uniqueServiceNames(group.serviceNames, true);
    return {
      ...group,
      breedNames: [...group.breedNames],
      weightBands,
      serviceNames,
      cells: weightBands.map((band, weightIndex) => serviceNames.map((serviceName) => {
        const sourceBand = sourceWeightBands[weightIndex];
        const existing = groupRows.find((row) => (
          normalizedKey(row.serviceName) === normalizedKey(serviceName)
          && (isSameWeightCoordinate(row, sourceBand) || isSameWeightCoordinate(row, band))
        ));
        return existing ? { ...existing, breedNames: [...existing.breedNames] } : createCell(group, band, serviceName);
      })),
    };
  });
}

export function writeMobilePriceGuideMatrix(
  document: MobilePriceGuideV2,
  groups: MobilePriceGuideMatrixGroup[],
  options: { discardOriginalRowIndexes?: ReadonlySet<number> } = {},
): MobilePriceGuideV2 {
  const tableGroups = groups.map(({ cells: _cells, ...group }) => ({
    ...group,
    breedNames: [...group.breedNames],
    weightBands: group.weightBands.map((band) => ({ ...band })),
    serviceNames: [...group.serviceNames],
  }));
  const matrixRows = groups.flatMap((group) => group.weightBands.flatMap((band, weightIndex) => (
    group.serviceNames.map((serviceName, serviceIndex) => ({
      ...(group.cells[weightIndex]?.[serviceIndex] ?? createCell(group, band, serviceName)),
      serviceName: nullableText(serviceName),
      species: group.species,
      breedNames: [...group.breedNames],
      breedGroup: nullableText(group.sourceLabel),
      sizeClass: group.sizeClass,
      minKg: band.minKg,
      maxKg: band.maxKg,
      weightBandLabel: nullableText(band.label),
    }))
  )));
  const fixedRows = document.source === "manual"
    ? matrixRows
    : matrixRows.filter((row) => (
      row.priceMinKrw !== null
      || row.priceMaxKrw !== null
      || row.durationMinutes !== null
      || row.note !== null
    ));
  const mappedRows = mappedMobilePriceGuideRowIndexes(document, groups);
  const preservedRows = document.rows
    .filter((_, rowIndex) => (
      !mappedRows.has(rowIndex)
      && !options.discardOriginalRowIndexes?.has(rowIndex)
    ))
    .map((row) => ({ ...row, breedNames: [...row.breedNames] }));
  const rows = [...fixedRows, ...preservedRows];
  const aiReview = document.aiReview.flatMap((review) => {
    const rowTarget = /^rows:(\d+)$/.exec(review.targetId);
    if (!rowTarget) return [review];
    const previousRow = document.rows[Number(rowTarget[1])];
    if (!previousRow) return [];
    const previousServiceKey = normalizedKey(previousRow.serviceName);
    const nextRowIndex = rows.findIndex((row) => (
      (previousRow.sourceItemId && row.sourceItemId
        ? previousRow.sourceItemId === row.sourceItemId
        : Boolean(previousServiceKey)
          && normalizedKey(row.serviceName) === previousServiceKey
          && row.species === previousRow.species
          && (row.breedGroup?.trim() || "요금표") === (previousRow.breedGroup?.trim() || "요금표")
          && isSameWeightCoordinate(row, {
            label: weightLabel(previousRow),
            minKg: previousRow.minKg,
            maxKg: previousRow.maxKg,
            note: null,
          }))
    ));
    return nextRowIndex < 0 ? [] : [{ ...review, targetId: `rows:${nextRowIndex}` }];
  });
  return { ...document, tableGroups, rows, aiReview };
}

function updateGroups(
  document: MobilePriceGuideV2,
  mutate: (groups: MobilePriceGuideMatrixGroup[]) => void,
  options: { discardRemovedMatrixRows?: boolean } = {},
) {
  const groups = readMobilePriceGuideMatrix(document);
  const mappedBefore = options.discardRemovedMatrixRows
    ? mappedMobilePriceGuideRowIndexes(document, groups)
    : null;
  mutate(groups);
  const mappedAfter = mappedBefore ? mappedMobilePriceGuideRowIndexes(document, groups) : null;
  const discardOriginalRowIndexes = mappedBefore && mappedAfter
    ? new Set([...mappedBefore].filter((rowIndex) => !mappedAfter.has(rowIndex)))
    : undefined;
  return writeMobilePriceGuideMatrix(document, groups, { discardOriginalRowIndexes });
}

function rowCount(groups: MobilePriceGuideMatrixGroup[]) {
  return groups.reduce((sum, group) => sum + group.weightBands.length * group.serviceNames.length, 0);
}

export function updateMobilePriceGuideGroup(
  document: MobilePriceGuideV2,
  groupIndex: number,
  patch: Partial<Pick<MobilePriceGuideTableGroup, "sourceLabel" | "breedNames">>,
) {
  return updateGroups(document, (groups) => {
    const nextPatch = { ...patch };
    if (patch.breedNames) {
      const unavailable = new Set(groups.flatMap((group, index) => (
        index === groupIndex ? [] : group.breedNames.map(normalizedKey)
      )));
      const seen = new Set<string>();
      nextPatch.breedNames = patch.breedNames.filter((breed) => {
        const key = normalizedKey(breed);
        if (!key || unavailable.has(key) || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    groups[groupIndex] = { ...groups[groupIndex], ...nextPatch };
  });
}

export function updateMobilePriceGuideWeightBand(document: MobilePriceGuideV2, groupIndex: number, weightIndex: number, label: string) {
  return updateGroups(document, (groups) => {
    groups[groupIndex].weightBands[weightIndex] = {
      ...groups[groupIndex].weightBands[weightIndex],
      label,
      minKg: null,
      maxKg: null,
    };
  });
}

export function updateMobilePriceGuideCell(
  document: MobilePriceGuideV2,
  groupIndex: number,
  weightIndex: number,
  serviceIndex: number,
  patch: Partial<Pick<MobilePriceGuideRow, "priceKind" | "priceMinKrw" | "priceMaxKrw" | "durationMinutes" | "note">>,
) {
  return updateGroups(document, (groups) => {
    groups[groupIndex].cells[weightIndex][serviceIndex] = {
      ...groups[groupIndex].cells[weightIndex][serviceIndex],
      ...patch,
    };
  });
}

export function updateMobilePriceGuideService(
  document: MobilePriceGuideV2,
  groupIndex: number,
  serviceIndex: number,
  serviceName: string,
) {
  return updateGroups(document, (groups) => {
    const group = groups[groupIndex];
    const nextKey = normalizedKey(serviceName);
    const duplicate = nextKey && group.serviceNames.some((candidate, index) => (
      index !== serviceIndex && normalizedKey(candidate) === nextKey
    ));
    if (duplicate) return;
    group.serviceNames[serviceIndex] = serviceName;
  });
}

export function addMobilePriceGuideService(document: MobilePriceGuideV2, groupIndex: number) {
  return updateGroups(document, (groups) => {
    const group = groups[groupIndex];
    if (group.serviceNames.length >= 40 || rowCount(groups) + group.weightBands.length > MAX_ROWS) return;
    group.serviceNames.push("");
    group.cells.forEach((row, weightIndex) => {
      row.push(createCell(group, group.weightBands[weightIndex], ""));
    });
  });
}

export function removeMobilePriceGuideService(document: MobilePriceGuideV2, groupIndex: number, serviceIndex: number) {
  return updateGroups(document, (groups) => {
    const group = groups[groupIndex];
    if (group.serviceNames.length <= 1) return;
    group.serviceNames.splice(serviceIndex, 1);
    group.cells.forEach((row) => row.splice(serviceIndex, 1));
  }, { discardRemovedMatrixRows: true });
}

export function addMobilePriceGuideWeightBand(document: MobilePriceGuideV2, groupIndex: number) {
  return updateGroups(document, (groups) => {
    const group = groups[groupIndex];
    if (group.weightBands.length >= MAX_BANDS || rowCount(groups) + group.serviceNames.length > MAX_ROWS) return;
    const previousBand = group.weightBands[group.weightBands.length - 1];
    const previousMaxKg = previousBand.maxKg;
    const band = previousMaxKg === null
      ? createWeightBand()
      : createWeightBand(previousMaxKg + MOBILE_PRICE_GUIDE_WEIGHT_INCREMENT_KG, previousMaxKg);
    group.weightBands.push(band);
    group.cells.push(group.serviceNames.map((service) => createCell(group, band, service)));
  });
}

export function removeMobilePriceGuideWeightBand(document: MobilePriceGuideV2, groupIndex: number, weightIndex: number) {
  return updateGroups(document, (groups) => {
    const group = groups[groupIndex];
    if (group.weightBands.length <= 1) return;
    group.weightBands.splice(weightIndex, 1);
    group.cells.splice(weightIndex, 1);
  }, { discardRemovedMatrixRows: true });
}

export function addMobilePriceGuideGroup(document: MobilePriceGuideV2) {
  return updateGroups(document, (groups) => {
    if (groups.length >= MAX_GROUPS || rowCount(groups) + MOBILE_PRICE_GUIDE_INITIAL_CUTOFFS_KG.length > MAX_ROWS) return;
    groups.push(createMatrixGroup(STARTER_GROUPS[groups.length] ?? ""));
  });
}

export function removeMobilePriceGuideGroup(document: MobilePriceGuideV2, groupIndex: number) {
  return updateGroups(document, (groups) => {
    if (groups.length <= 1) return;
    groups.splice(groupIndex, 1);
  }, { discardRemovedMatrixRows: true });
}
