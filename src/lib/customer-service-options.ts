import type { Service } from "@/types/domain";
import { buildCustomerPriceGuideGroupKey } from "@/lib/customer-breed-pricing-group";
import { resolvePriceGuideOrderedWeightBands } from "@/lib/price-guide-structured-table";
import {
  ensurePriceGuideV2SourceItemIds,
  priceGuideV2Schema,
  type PriceGuideV2,
  type PriceGuideV2Row,
} from "@/types/price-guide-photo-import";
import { isConfirmedPriceGuideDuration } from "@/lib/price-guide-duration-confirmation";

export type CustomerServiceDisplayOverride = {
  visible?: boolean;
  order?: number;
  linkedOptionId?: string;
};

export type CustomerServiceDisplayOverrides = Record<string, CustomerServiceDisplayOverride>;

export type CustomerServiceSourceOption = {
  id: string;
  serviceId: string;
  name: string;
  displayName: string;
  sourceName: string;
  category: string;
  description: string;
  durationMinutes: number;
  durationMinutesMax?: number;
  price: number;
  priceType: "fixed" | "starting";
  weightBand?: string;
  order: number;
  linkedOptionId?: string;
  aliasIds?: string[];
  priceGuideSpecies?: "dog" | "cat";
};

type PriceGuideWeightRange = {
  minimum: number | null;
  maximum: number | null;
  minimumInclusive: boolean | null;
  maximumInclusive: boolean | null;
};

function readCanonicalPriceGuideV2(guide: unknown): PriceGuideV2 | null {
  const rootDocument = priceGuideV2Schema.safeParse(guide);
  if (rootDocument.success) return ensurePriceGuideV2SourceItemIds(rootDocument.data);
  if (!guide || typeof guide !== "object" || Array.isArray(guide)) return null;
  const nestedDocument = priceGuideV2Schema.safeParse((guide as { canonicalV2?: unknown }).canonicalV2);
  return nestedDocument.success ? ensurePriceGuideV2SourceItemIds(nestedDocument.data) : null;
}

const priceGuideV2SizeLabels: Record<PriceGuideV2Row["sizeClass"], string> = {
  small: "소형견",
  medium: "중형견",
  large: "대형견",
  "extra-large": "초대형견",
  all: "전체 크기",
  unknown: "",
};

function formatPriceGuideV2WeightBand(row: PriceGuideV2Row) {
  const sourceLabel = row.weightBandLabel?.trim();
  if (sourceLabel) return sourceLabel;
  if (row.minKg !== null && row.maxKg !== null) return `${row.minKg}~${row.maxKg}kg`;
  if (row.maxKg !== null) return `${row.maxKg}kg 이하`;
  if (row.minKg !== null) return `${row.minKg}kg 이상`;
  return priceGuideV2SizeLabels[row.sizeClass];
}

function getPriceGuideV2ServiceRow(document: PriceGuideV2, service: Service) {
  const indexedRow = document.rows[Math.max(0, (service.sort_order ?? 1) - 1)];
  if (
    indexedRow &&
    indexedRow.serviceName === service.name &&
    indexedRow.priceMinKrw === service.price &&
    indexedRow.durationMinutes === service.duration_minutes
  ) {
    return { row: indexedRow, index: Math.max(0, (service.sort_order ?? 1) - 1) };
  }

  const matches = document.rows.flatMap((row, index) =>
    row.serviceName === service.name &&
    row.priceMinKrw === service.price &&
    row.durationMinutes === service.duration_minutes
      ? [{ row, index }]
      : [],
  );
  if (matches.length === 1) return matches[0];
  const serviceDescription = service.description ?? "";
  const contextualMatches = matches.filter(({ row }) => {
    const contextParts = [row.note, row.breedGroup, formatPriceGuideV2WeightBand(row)].filter(
      (value): value is string => Boolean(value),
    );
    return contextParts.length > 0 && contextParts.every((value) => serviceDescription.includes(value));
  });
  if (contextualMatches.length === 1) return contextualMatches[0];
  if (document.rows.length === 1) return { row: document.rows[0], index: 0 };
  return null;
}

function getPriceGuideV2SpeciesVariants(species: PriceGuideV2Row["species"]): Array<"dog" | "cat"> {
  if (species === "dog" || species === "cat") return [species];
  if (species === "all") return ["dog", "cat"];
  return [];
}

function weightMatchesRange(weightKg: number, range: PriceGuideWeightRange) {
  const aboveMinimum =
    range.minimum === null ||
    weightKg > range.minimum ||
    (weightKg === range.minimum && range.minimumInclusive === true);
  const belowMaximum =
    range.maximum === null ||
    weightKg < range.maximum ||
    (weightKg === range.maximum && range.maximumInclusive === true);
  return aboveMinimum && belowMaximum;
}

export function resolveCustomerPriceGuideWeightBand(weightBands: string[], weightKg: number | null | undefined) {
  if (typeof weightKg !== "number" || !Number.isFinite(weightKg) || weightKg <= 0) return null;

  const resolved = resolvePriceGuideOrderedWeightBands(
    weightBands.map((label) => ({ label, minKg: null, maxKg: null })),
  );
  if (resolved.some((range) => range.contradictsAxis)) return null;
  const matches = resolved.flatMap((range, index) => (
    weightMatchesRange(weightKg, range) ? [weightBands[index]] : []
  ));
  return matches.length === 1 ? matches[0] : null;
}

function limitText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeOptionLabelKey(label: string) {
  return label.replace(/\s+/g, " ").trim().toLocaleLowerCase("ko-KR");
}

function createMenuOptionId(label: string) {
  return `menu:${normalizeOptionLabelKey(label)}`;
}

export function formatCustomerServiceDuration(option: Pick<CustomerServiceSourceOption, "durationMinutes" | "durationMinutesMax">) {
  const minimum = option.durationMinutes;
  const maximum = option.durationMinutesMax;
  if (!Number.isFinite(minimum) || minimum <= 0) return "상담 후 안내";
  if (typeof maximum === "number" && Number.isFinite(maximum) && maximum > minimum) {
    return `${minimum}~${maximum}분`;
  }
  return `${minimum}분`;
}

function buildPriceGuideOptionName(sectionTitle: string, itemLabel: string) {
  const title = sectionTitle.trim();
  const label = itemLabel.trim();
  if (!title) return label;
  if (!label) return title;
  return label.startsWith(`${title} /`) ? label : `${title} / ${label}`;
}

function getPriceGuideSpeciesLabel(value: unknown) {
  return value === "cat" ? "고양이" : "강아지";
}

function uniqueCustomerServiceOptions(options: CustomerServiceSourceOption[]) {
  const seenKeys = new Set<string>();
  return options.filter((option) => {
    const key = option.linkedOptionId ?? option.id;
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  });
}

function buildOptionLookup(options: CustomerServiceSourceOption[]) {
  const optionById = new Map<string, CustomerServiceSourceOption>();

  for (const option of options) {
    optionById.set(option.id, option);
    for (const aliasId of option.aliasIds ?? []) {
      optionById.set(aliasId, option);
    }
  }

  return optionById;
}

function normalizeOrder(value: unknown) {
  const order = Number(value);
  if (!Number.isFinite(order)) return undefined;
  return Math.max(1, Math.min(500, Math.round(order)));
}

export function normalizeCustomerServiceOverrides(value: unknown): CustomerServiceDisplayOverrides {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).flatMap(([key, rawOverride]) => {
      const normalizedKey = key.trim().slice(0, 160);
      if (!normalizedKey || !rawOverride || typeof rawOverride !== "object" || Array.isArray(rawOverride)) {
        return [];
      }

      const source = rawOverride as Record<string, unknown>;
      const override: CustomerServiceDisplayOverride = {};
      if (typeof source.visible === "boolean") override.visible = source.visible;

      const order = normalizeOrder(source.order);
      if (order !== undefined) override.order = order;

      const linkedOptionId = limitText(source.linkedOptionId, 180);
      if (linkedOptionId) override.linkedOptionId = linkedOptionId;

      return Object.keys(override).length > 0 ? [[normalizedKey, override]] : [];
    }),
  );
}

function selectPriceGuideV2RowIndexesForWeight(rows: PriceGuideV2Row[], weightKg: number | null | undefined) {
  if (typeof weightKg !== "number" || !Number.isFinite(weightKg) || weightKg <= 0) {
    return new Set(rows.map((_, index) => index));
  }

  const groups = new Map<string, Array<{ index: number; row: PriceGuideV2Row }>>();
  rows.forEach((row, index) => {
    const key = [row.species, row.breedGroup ?? "", row.serviceName ?? ""].join("\u0000");
    groups.set(key, [...(groups.get(key) ?? []), { index, row }]);
  });

  const selected = new Set<number>();
  groups.forEach((entries) => {
    const ranges = resolvePriceGuideOrderedWeightBands(entries.map(({ row }) => ({
      label: formatPriceGuideV2WeightBand(row),
      minKg: row.minKg,
      maxKg: row.maxKg,
    })));
    if (ranges.some((range) => range.contradictsAxis)) return;
    const matches = ranges.flatMap((range, rangeIndex) => (
      weightMatchesRange(weightKg, range) ? [entries[rangeIndex].index] : []
    ));
    if (matches.length === 1) selected.add(matches[0]);
  });
  return selected;
}

/**
 * Keeps only presentation settings that resolve to a currently saved canonical
 * price-guide source item. Display values are never accepted or copied here.
 */
export function sanitizeCustomerServiceOverridesForSourceOptions(
  value: unknown,
  sourceOptions: CustomerServiceSourceOption[],
): CustomerServiceDisplayOverrides {
  const normalizedOverrides = normalizeCustomerServiceOverrides(value);
  const optionById = buildOptionLookup(sourceOptions);
  const defaultRowById = new Map(
    buildDefaultCustomerServiceMenuOptions(sourceOptions).map((option) => [option.id, option]),
  );
  const seenSourceIds = new Set<string>();

  return Object.fromEntries(
    Object.entries(normalizedOverrides).flatMap(([rowId, override]) => {
      const defaultRow = defaultRowById.get(rowId);
      const sourceOption =
        optionById.get(override.linkedOptionId ?? "") ??
        optionById.get(defaultRow?.linkedOptionId ?? "") ??
        optionById.get(rowId);
      if (!sourceOption || seenSourceIds.has(sourceOption.id)) return [];
      seenSourceIds.add(sourceOption.id);

      return [[
        sourceOption.id,
        {
          ...(override.visible !== undefined ? { visible: override.visible } : {}),
          ...(override.order !== undefined ? { order: override.order } : {}),
          linkedOptionId: sourceOption.id,
        },
      ]];
    }),
  );
}

export function buildCustomerServiceSourceOptions(
  services: Service[],
  options: { includeInactive?: boolean; priceGuideOnly?: boolean; priceGuideGroupKey?: string; weightKg?: number | null } = {},
): CustomerServiceSourceOption[] {
  const result: CustomerServiceSourceOption[] = [];

  const canonicalGroups = new Map<string, { document: PriceGuideV2; services: Service[] }>();
  for (const service of services) {
    if (!options.includeInactive && !service.is_active) continue;
    const document = readCanonicalPriceGuideV2(service.price_guide);
    if (!document) continue;
    const documentKey = JSON.stringify(document);
    const group = canonicalGroups.get(documentKey);
    if (group) group.services.push(service);
    else canonicalGroups.set(documentKey, { document, services: [service] });
  }

  for (const { document, services: sourceServices } of canonicalGroups.values()) {
    const serviceByRowIndex = new Map<number, Service>();
    for (const service of sourceServices) {
      const matched = getPriceGuideV2ServiceRow(document, service);
      if (matched && !serviceByRowIndex.has(matched.index)) {
        serviceByRowIndex.set(matched.index, service);
      }
    }

    const fallbackCarrier = sourceServices[0];
    const selectedRowIndexes = selectPriceGuideV2RowIndexesForWeight(document.rows, options.weightKg);
    document.rows.forEach((row, rowIndex) => {
      if (!fallbackCarrier || !selectedRowIndexes.has(rowIndex)) return;
      const serviceName = limitText(row.serviceName, 80);
      const completePrice = row.priceKind !== "unknown" && row.priceMinKrw !== null;
      const completeDuration = isConfirmedPriceGuideDuration(row.durationMinutes);
      if (!serviceName || !completePrice || !completeDuration) return;

      const carrier = serviceByRowIndex.get(rowIndex) ?? fallbackCarrier;
      for (const species of getPriceGuideV2SpeciesVariants(row.species)) {
        const speciesLabel = getPriceGuideSpeciesLabel(species);
        const sectionTitle = row.breedGroup ?? priceGuideV2SizeLabels[row.sizeClass];
        const priceGuideGroupKey = buildCustomerPriceGuideGroupKey(species, sectionTitle);
        const sourceSpeciesGroupKey = buildCustomerPriceGuideGroupKey(row.species, sectionTitle);
        if (
          options.priceGuideGroupKey
          && priceGuideGroupKey !== options.priceGuideGroupKey
          && sourceSpeciesGroupKey !== options.priceGuideGroupKey
        ) continue;

        const sectionCategory = sectionTitle ? `${speciesLabel} / ${sectionTitle}` : speciesLabel;
        const displayName = buildPriceGuideOptionName(sectionCategory, serviceName);
        const stableOptionId = `${carrier.id}:price-guide-v2:${row.sourceItemId}:${species}`;
        const weightBand = formatPriceGuideV2WeightBand(row);
        result.push({
          id: stableOptionId,
          serviceId: carrier.id,
          name: displayName,
          displayName: serviceName,
          sourceName: displayName,
          category: sectionCategory,
          description: [row.breedNames.join(", "), row.note].filter(Boolean).join(" · "),
          durationMinutes: row.durationMinutes!,
          price: row.priceMinKrw!,
          priceType: row.priceKind === "fixed" ? "fixed" : "starting",
          weightBand: weightBand || undefined,
          order: result.length + 1,
          aliasIds: [],
          priceGuideSpecies: species,
        });
      }
    });
  }

  return result;
}

function buildDefaultCustomerServiceMenuOptions(options: CustomerServiceSourceOption[]) {
  const uniqueOptions = uniqueCustomerServiceOptions(options);
  const priceGuideGroups = new Map<string, CustomerServiceSourceOption[]>();
  const menuRows: CustomerServiceSourceOption[] = [];

  for (const option of uniqueOptions) {
    if (!option.priceGuideSpecies) {
      menuRows.push({
        ...option,
        id: createMenuOptionId(option.sourceName),
        name: option.sourceName,
        sourceName: option.sourceName,
        linkedOptionId: option.id,
      });
      continue;
    }

    const groupKey = [option.serviceId, option.priceGuideSpecies, normalizeOptionLabelKey(option.displayName)].join(":");
    priceGuideGroups.set(groupKey, [...(priceGuideGroups.get(groupKey) ?? []), option]);
  }

  const speciesByLabel = new Map<string, Set<"dog" | "cat">>();
  for (const group of priceGuideGroups.values()) {
    const representative = group[0];
    const labelKey = normalizeOptionLabelKey(representative.displayName);
    speciesByLabel.set(labelKey, new Set([...(speciesByLabel.get(labelKey) ?? []), representative.priceGuideSpecies!]));
  }

  for (const [groupKey, group] of priceGuideGroups) {
    const representative = group
      .slice()
      .sort((left, right) => left.price - right.price || left.order - right.order)[0];
    const prices = group.map((option) => option.price);
    const durations = group.flatMap((option) => [option.durationMinutes, option.durationMinutesMax ?? option.durationMinutes]);
    const minimumPrice = Math.min(...prices);
    const minimumDuration = Math.min(...durations);
    const maximumDuration = Math.max(...durations);
    const labelKey = normalizeOptionLabelKey(representative.displayName);
    const needsSpeciesLabel = (speciesByLabel.get(labelKey)?.size ?? 0) > 1;
    const cleanName = needsSpeciesLabel
      ? `${getPriceGuideSpeciesLabel(representative.priceGuideSpecies)} ${representative.displayName}`
      : representative.displayName;

    menuRows.push({
      ...representative,
      id: createMenuOptionId(groupKey),
      name: cleanName,
      displayName: cleanName,
      sourceName: cleanName,
      category: getPriceGuideSpeciesLabel(representative.priceGuideSpecies),
      durationMinutes: minimumDuration,
      durationMinutesMax: maximumDuration > minimumDuration ? maximumDuration : undefined,
      price: minimumPrice,
      priceType: prices.some((price) => price !== minimumPrice) ? "starting" : representative.priceType,
      order: Math.min(...group.map((option) => option.order)),
      linkedOptionId: representative.id,
      aliasIds: group.flatMap((option) => [option.id, ...(option.aliasIds ?? [])]),
    });
  }

  return menuRows
    .sort((left, right) => left.order - right.order || left.name.localeCompare(right.name, "ko"))
    .map((option, index) => ({ ...option, order: index + 1 }));
}

export function buildCustomerServiceMenuConnectionOptions(options: CustomerServiceSourceOption[]) {
  return [...options].sort(
    (left, right) =>
      left.category.localeCompare(right.category, "ko") ||
      left.sourceName.localeCompare(right.sourceName, "ko") ||
      left.durationMinutes - right.durationMinutes ||
      left.price - right.price,
  );
}

export function applyCustomerServiceOverrides(
  options: CustomerServiceSourceOption[],
  overrides: unknown,
): CustomerServiceSourceOption[] {
  const normalizedOverrides = normalizeCustomerServiceOverrides(overrides);
  const optionById = buildOptionLookup(options);
  const defaultRows = buildDefaultCustomerServiceMenuOptions(options);
  const defaultRowByLabelKey = new Map(defaultRows.map((option) => [normalizeOptionLabelKey(option.sourceName), option]));

  if (Object.keys(normalizedOverrides).length === 0) {
    return defaultRows;
  }

  const rows: CustomerServiceSourceOption[] = [];
  const consumedOverrideIds = new Set<string>();

  for (const defaultRow of defaultRows) {
    const override = normalizedOverrides[defaultRow.id];
    consumedOverrideIds.add(defaultRow.id);
    if (override?.visible === false) continue;

    const linkedOption = optionById.get(override?.linkedOptionId ?? defaultRow.linkedOptionId ?? "") ?? optionById.get(defaultRow.linkedOptionId ?? "");
    if (!linkedOption) continue;
    const useDefaultProjection =
      defaultRow.linkedOptionId === linkedOption.id || defaultRow.aliasIds?.includes(linkedOption.id);
    const projectedOption = useDefaultProjection ? defaultRow : linkedOption;
    rows.push({
      ...projectedOption,
      id: defaultRow.id,
      order: override?.order ?? defaultRow.order,
      linkedOptionId: linkedOption.id,
    });
  }

  for (const [rowId, override] of Object.entries(normalizedOverrides)) {
    if (consumedOverrideIds.has(rowId) || override.visible === false) continue;

    const linkedOption = optionById.get(override.linkedOptionId ?? rowId) ?? optionById.get(rowId);
    if (!linkedOption) continue;

    if (!rowId.startsWith("menu-custom-") && defaultRowByLabelKey.has(normalizeOptionLabelKey(linkedOption.sourceName))) {
      continue;
    }

    rows.push({
      ...linkedOption,
      id: rowId,
      name: linkedOption.sourceName,
      sourceName: linkedOption.sourceName,
      description: linkedOption.description,
      order: override.order ?? linkedOption.order,
      linkedOptionId: linkedOption.id,
    });
  }

  return uniqueCustomerServiceOptions(rows.sort((left, right) => left.order - right.order || left.name.localeCompare(right.name, "ko")));
}

export function applyConfiguredCustomerServiceOverrides(
  options: CustomerServiceSourceOption[],
  overrides: unknown,
): CustomerServiceSourceOption[] {
  const requestedOverrides = normalizeCustomerServiceOverrides(overrides);
  const normalizedOverrides = sanitizeCustomerServiceOverridesForSourceOptions(requestedOverrides, options);
  const optionById = buildOptionLookup(options);
  const defaultRows = buildDefaultCustomerServiceMenuOptions(options);
  const defaultRowById = new Map(defaultRows.map((option) => [option.id, option]));

  if (Object.keys(requestedOverrides).length === 0) {
    return defaultRows;
  }

  // Existing settings that no longer resolve to a saved source item must not
  // cause default or compatibility prices to reappear.
  if (Object.keys(normalizedOverrides).length === 0) return [];

  return uniqueCustomerServiceOptions(Object.entries(normalizedOverrides)
    .flatMap(([rowId, override]) => {
      if (override.visible === false) return [];

      const defaultRow = defaultRowById.get(rowId);
      const linkedOption =
        optionById.get(override.linkedOptionId ?? "") ??
        optionById.get(defaultRow?.linkedOptionId ?? "") ??
        optionById.get(rowId);

      if (!linkedOption) return [];

      const useDefaultProjection = Boolean(
        defaultRow &&
        (defaultRow.linkedOptionId === linkedOption.id || defaultRow.aliasIds?.includes(linkedOption.id)),
      );
      const projectedOption = useDefaultProjection ? defaultRow! : linkedOption;

      return [
        {
          ...projectedOption,
          id: rowId,
          order: override.order ?? defaultRow?.order ?? linkedOption.order,
          linkedOptionId: linkedOption.id,
        },
      ];
    })
    .sort((left, right) => left.order - right.order || left.name.localeCompare(right.name, "ko")));
}
