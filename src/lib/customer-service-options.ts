import type { Service } from "@/types/domain";

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
  sourceName: string;
  category: string;
  description: string;
  durationMinutes: number;
  price: number;
  priceType: "fixed" | "starting";
  order: number;
  linkedOptionId?: string;
  aliasIds?: string[];
};

function getPriceGuideSections(guide: unknown, options: { includeDisabled?: boolean } = {}) {
  if (!guide || typeof guide !== "object") return [];
  const source = guide as { enabled?: unknown; sections?: unknown };
  if (!options.includeDisabled && source.enabled === false) return [];
  return Array.isArray(source.sections) ? source.sections : [];
}

function numberFromText(value: unknown) {
  const numberText = String(value ?? "").replace(/[^0-9]/g, "");
  const numberValue = Number(numberText);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null;
}

function limitText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function isPlaceholderPriceGuideItem(label: string) {
  return /^(?:\uC0C8\s*\uD56D\uBAA9|\uC2E0\uADDC\s*\uD56D\uBAA9|new\s*item)$/i.test(label.trim());
}

function normalizeOptionLabelKey(label: string) {
  return label.replace(/\s+/g, " ").trim().toLocaleLowerCase("ko-KR");
}

function createMenuOptionId(label: string) {
  return `menu:${normalizeOptionLabelKey(label)}`;
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

function getCustomerServiceOptionDisplayKey(option: CustomerServiceSourceOption) {
  return [
    option.category,
    option.sourceName,
    option.durationMinutes,
    option.price,
    option.priceType,
  ].join("|").replace(/\s+/g, " ").trim().toLocaleLowerCase("ko-KR");
}

function uniqueCustomerServiceOptions(options: CustomerServiceSourceOption[]) {
  const seenKeys = new Set<string>();
  return options.filter((option) => {
    const key = getCustomerServiceOptionDisplayKey(option);
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

export function buildCustomerServiceSourceOptions(
  services: Service[],
  options: { includeInactive?: boolean; priceGuideOnly?: boolean } = {},
): CustomerServiceSourceOption[] {
  const result: CustomerServiceSourceOption[] = [];

  for (const service of services) {
    if (!options.includeInactive && !service.is_active) continue;

    const initialResultLength = result.length;
    const priceGuideSections = getPriceGuideSections(service.price_guide, { includeDisabled: options.priceGuideOnly });
    for (const section of priceGuideSections) {
      if (!section || typeof section !== "object") continue;
      const source = section as { id?: unknown; species?: unknown; title?: unknown; weightBands?: unknown; items?: unknown };
      const speciesLabel = getPriceGuideSpeciesLabel(source.species);
      const sectionTitle = limitText(source.title, 60) || service.category || "미용";
      const sectionCategory = `${speciesLabel} / ${sectionTitle}`;
      const sectionId = String(source.id ?? "").trim();
      const stableSectionKey = sectionId || normalizeOptionLabelKey(sectionTitle);
      const weightBands = Array.isArray(source.weightBands)
        ? source.weightBands.filter((band): band is string => typeof band === "string")
        : [];
      const items = Array.isArray(source.items) ? source.items : [];

      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const sourceItem = item as { id?: unknown; label?: unknown; cells?: unknown };
        const label = limitText(sourceItem.label, 80);
        if (!label || isPlaceholderPriceGuideItem(label)) continue;

        const cells =
          sourceItem.cells && typeof sourceItem.cells === "object"
            ? (sourceItem.cells as Record<string, { price?: unknown; durationMinutes?: unknown }>)
            : {};
        const firstCell =
          weightBands.map((band) => cells[band]).find((cell) => numberFromText(cell?.price)) ??
          Object.values(cells).find((cell) => numberFromText(cell?.price));
        const price = numberFromText(firstCell?.price);
        if (!price) continue;

        const itemId = String(sourceItem.id ?? "").trim();
        const itemKey = itemId || normalizeOptionLabelKey(label);
        const durationMinutes = numberFromText(firstCell?.durationMinutes) ?? service.duration_minutes;
        const displayName = buildPriceGuideOptionName(sectionCategory, label);
        const stableOptionId = `${service.id}:price-guide:${stableSectionKey}:${itemKey}`;
        const aliasIds = Array.from(
          new Set([
            `${service.id}:price-guide:${sectionTitle}:${itemKey}`,
            `${service.id}:price-guide:${sectionCategory}:${itemKey}`,
          ]),
        ).filter((aliasId) => aliasId !== stableOptionId);
        result.push({
          id: stableOptionId,
          serviceId: service.id,
          name: displayName,
          sourceName: displayName,
          category: sectionCategory,
          description: "",
          durationMinutes,
          price,
          priceType: service.price_type ?? "starting",
          order: result.length + 1,
          aliasIds,
        });
      }

    }

    if (priceGuideSections.length > 0 && result.length > initialResultLength) continue;
    if (options.priceGuideOnly && result.length > initialResultLength) continue;
    if (options.priceGuideOnly) continue;

    result.push({
      id: service.id,
      serviceId: service.id,
      name: service.name,
      sourceName: service.name,
      category: service.category || "미용",
      description: service.description || "",
      durationMinutes: service.duration_minutes,
      price: service.price,
      priceType: service.price_type ?? "starting",
      order: result.length + 1,
    });
  }

  return result;
}

function buildDefaultCustomerServiceMenuOptions(options: CustomerServiceSourceOption[]) {
  const firstCategory = options[0]?.category;
  const defaultOptions = firstCategory ? options.filter((option) => option.category === firstCategory) : [];

  return uniqueCustomerServiceOptions(defaultOptions).map((option, index) => ({
    ...option,
    id: createMenuOptionId(option.sourceName),
    name: option.sourceName,
    sourceName: option.sourceName,
    category: option.category,
    order: index + 1,
    linkedOptionId: option.id,
  }));
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
    rows.push({
      ...linkedOption,
      id: defaultRow.id,
      name: linkedOption.sourceName,
      sourceName: linkedOption.sourceName,
      description: linkedOption.description,
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
  const normalizedOverrides = normalizeCustomerServiceOverrides(overrides);
  const optionById = buildOptionLookup(options);
  const defaultRows = buildDefaultCustomerServiceMenuOptions(options);
  const defaultRowById = new Map(defaultRows.map((option) => [option.id, option]));

  return uniqueCustomerServiceOptions(Object.entries(normalizedOverrides)
    .flatMap(([rowId, override]) => {
      if (override.visible === false) return [];

      const defaultRow = defaultRowById.get(rowId);
      const linkedOption =
        optionById.get(override.linkedOptionId ?? "") ??
        optionById.get(defaultRow?.linkedOptionId ?? "") ??
        optionById.get(rowId);

      if (!linkedOption) return [];

      return [
        {
          ...linkedOption,
          id: rowId,
          name: linkedOption.sourceName,
          sourceName: linkedOption.sourceName,
          description: linkedOption.description,
          order: override.order ?? defaultRow?.order ?? linkedOption.order,
          linkedOptionId: linkedOption.id,
        },
      ];
    })
    .sort((left, right) => left.order - right.order || left.name.localeCompare(right.name, "ko")));
}
