import type {
  MobilePriceGuideRow,
  MobilePriceGuideTableGroup,
  MobilePriceGuideV2,
  MobilePriceGuideWeightBand,
} from "./mobile-price-photo-adapter";

export const MOBILE_PRICE_GUIDE_INITIAL_CUTOFFS_KG = [2, 4, 6, 8] as const;
const STARTER_GROUPS = ["베이직", "플러스", "프리미엄"] as const;
const STARTER_SERVICES = ["목욕", "전체 미용", "부분 미용", "스포팅"] as const;
const MAX_GROUPS = 40;
const MAX_BANDS = 40;
const MAX_SERVICES = 40;
const MAX_ROWS = 200;

export type MobilePriceGuideMatrixGroup = MobilePriceGuideTableGroup & {
  cells: MobilePriceGuideRow[][];
};

function nullableText(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
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

function createWeightBand(maxKg: number | null = null): MobilePriceGuideWeightBand {
  return { label: maxKg === null ? "" : `${maxKg}kg 이하`, minKg: null, maxKg, note: null };
}

function createGroup(sourceLabel = "", serviceNames: string[] = [""]): MobilePriceGuideTableGroup {
  return {
    sourceLabel,
    species: "dog",
    breedNames: [],
    sizeClass: "all",
    weightBands: MOBILE_PRICE_GUIDE_INITIAL_CUTOFFS_KG.map(createWeightBand),
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

function createMatrixGroup(sourceLabel = "", serviceNames: string[] = [""]): MobilePriceGuideMatrixGroup {
  const group = createGroup(sourceLabel, serviceNames);
  return {
    ...group,
    cells: group.weightBands.map((band) => group.serviceNames.map((service) => createCell(group, band, service))),
  };
}

export function createMobilePriceGuideSkeleton(): MobilePriceGuideV2 {
  const groups = STARTER_GROUPS.map((label) => createMatrixGroup(label, [...STARTER_SERVICES]));
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
    const weightBands = group.weightBands.map((band) => ({ ...band }));
    const serviceNames = [...group.serviceNames];
    const groupRows = document.rows.filter((row) => (
      (row.breedGroup?.trim() || "요금표") === group.sourceLabel.trim()
      && row.species === group.species
    ));
    return {
      ...group,
      breedNames: [...group.breedNames],
      weightBands,
      serviceNames,
      cells: weightBands.map((band) => serviceNames.map((serviceName) => {
        const existing = groupRows.find((row) => (
          (row.serviceName?.trim() ?? "") === serviceName.trim()
          && (weightLabel(row) === band.label || (row.minKg === band.minKg && row.maxKg === band.maxKg))
        ));
        return existing ? { ...existing, breedNames: [...existing.breedNames] } : createCell(group, band, serviceName);
      })),
    };
  });
}

export function writeMobilePriceGuideMatrix(
  document: MobilePriceGuideV2,
  groups: MobilePriceGuideMatrixGroup[],
): MobilePriceGuideV2 {
  const tableGroups = groups.map(({ cells: _cells, ...group }) => ({
    ...group,
    breedNames: [...group.breedNames],
    weightBands: group.weightBands.map((band) => ({ ...band })),
    serviceNames: [...group.serviceNames],
  }));
  const rows = groups.flatMap((group) => group.weightBands.flatMap((band, weightIndex) => (
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
  return { ...document, tableGroups, rows };
}

function updateGroups(document: MobilePriceGuideV2, mutate: (groups: MobilePriceGuideMatrixGroup[]) => void) {
  const groups = readMobilePriceGuideMatrix(document);
  mutate(groups);
  return writeMobilePriceGuideMatrix(document, groups);
}

function rowCount(groups: MobilePriceGuideMatrixGroup[]) {
  return groups.reduce((sum, group) => sum + group.weightBands.length * group.serviceNames.length, 0);
}

export function updateMobilePriceGuideGroup(
  document: MobilePriceGuideV2,
  groupIndex: number,
  patch: Partial<Pick<MobilePriceGuideTableGroup, "sourceLabel" | "breedNames">>,
) {
  return updateGroups(document, (groups) => { groups[groupIndex] = { ...groups[groupIndex], ...patch }; });
}

export function updateMobilePriceGuideService(document: MobilePriceGuideV2, groupIndex: number, serviceIndex: number, name: string) {
  return updateGroups(document, (groups) => { groups[groupIndex].serviceNames[serviceIndex] = name; });
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

export function addMobilePriceGuideService(document: MobilePriceGuideV2, groupIndex: number) {
  return updateGroups(document, (groups) => {
    const group = groups[groupIndex];
    if (group.serviceNames.length >= MAX_SERVICES || rowCount(groups) + group.weightBands.length > MAX_ROWS) return;
    group.serviceNames.push("");
    group.cells.forEach((cells, index) => cells.push(createCell(group, group.weightBands[index], "")));
  });
}

export function removeMobilePriceGuideService(document: MobilePriceGuideV2, groupIndex: number, serviceIndex: number) {
  return updateGroups(document, (groups) => {
    const group = groups[groupIndex];
    if (group.serviceNames.length <= 1) return;
    group.serviceNames.splice(serviceIndex, 1);
    group.cells.forEach((cells) => cells.splice(serviceIndex, 1));
  });
}

export function addMobilePriceGuideWeightBand(document: MobilePriceGuideV2, groupIndex: number) {
  return updateGroups(document, (groups) => {
    const group = groups[groupIndex];
    if (group.weightBands.length >= MAX_BANDS || rowCount(groups) + group.serviceNames.length > MAX_ROWS) return;
    const band = createWeightBand();
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
  });
}

export function addMobilePriceGuideGroup(document: MobilePriceGuideV2) {
  return updateGroups(document, (groups) => {
    if (groups.length >= MAX_GROUPS || rowCount(groups) + MOBILE_PRICE_GUIDE_INITIAL_CUTOFFS_KG.length > MAX_ROWS) return;
    groups.push(createMatrixGroup());
  });
}

export function removeMobilePriceGuideGroup(document: MobilePriceGuideV2, groupIndex: number) {
  return updateGroups(document, (groups) => {
    if (groups.length <= 1) return;
    groups.splice(groupIndex, 1);
  });
}
