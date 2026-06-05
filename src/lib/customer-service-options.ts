import type { Service } from "@/types/domain";

export type CustomerServiceDisplayOverride = {
  visible?: boolean;
  order?: number;
  displayName?: string;
  description?: string;
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

const defaultGroomingMenuItems = [
  { id: "default_hygiene_bath", label: "위생미용+목욕", durationMinutes: 60, price: 30000 },
  { id: "default_clipping", label: "클리핑", durationMinutes: 90, price: 45000 },
  { id: "default_spotting", label: "스포팅", durationMinutes: 120, price: 70000 },
  { id: "default_scissor", label: "가위컷", durationMinutes: 150, price: 90000 },
] as const;

function shouldBackfillDefaultGroomingMenuItems(labels: Set<string>) {
  return defaultGroomingMenuItems.some((item) => labels.has(normalizeOptionLabelKey(item.label)));
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

      const displayName = limitText(source.displayName, 80);
      if (displayName) override.displayName = displayName;

      const description = limitText(source.description, 120);
      if (description) override.description = description;

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

    const priceGuideSections = getPriceGuideSections(service.price_guide, { includeDisabled: options.priceGuideOnly });
    for (const section of priceGuideSections) {
      if (!section || typeof section !== "object") continue;
      const source = section as { title?: unknown; weightBands?: unknown; items?: unknown };
      const sectionTitle = limitText(source.title, 60) || service.category || "미용";
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
        const durationMinutes = numberFromText(firstCell?.durationMinutes) ?? service.duration_minutes;
        result.push({
          id: `${service.id}:price-guide:${sectionTitle}:${itemId || normalizeOptionLabelKey(label)}`,
          serviceId: service.id,
          name: label,
          sourceName: label,
          category: sectionTitle,
          description: "",
          durationMinutes,
          price,
          priceType: service.price_type ?? "starting",
          order: result.length + 1,
        });
      }

      if (options.priceGuideOnly) {
        const existingLabels = new Set(
          result
            .filter((option) => option.serviceId === service.id && option.category === sectionTitle)
            .map((option) => normalizeOptionLabelKey(option.sourceName)),
        );
        if (shouldBackfillDefaultGroomingMenuItems(existingLabels)) {
          for (const item of defaultGroomingMenuItems) {
            const labelKey = normalizeOptionLabelKey(item.label);
            if (existingLabels.has(labelKey)) continue;
            result.push({
              id: `${service.id}:price-guide:${sectionTitle}:${item.id}`,
              serviceId: service.id,
              name: item.label,
              sourceName: item.label,
              category: sectionTitle,
              description: "",
              durationMinutes: item.durationMinutes,
              price: item.price,
              priceType: service.price_type ?? "starting",
              order: result.length + 1,
            });
            existingLabels.add(labelKey);
          }
        }
      }
    }

    if (priceGuideSections.length > 0 || options.priceGuideOnly) continue;

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
  const groupedOptions = new Map<string, CustomerServiceSourceOption>();

  for (const option of options) {
    const key = normalizeOptionLabelKey(option.sourceName);
    const existing = groupedOptions.get(key);
    if (!existing || option.price < existing.price || (option.price === existing.price && option.durationMinutes < existing.durationMinutes)) {
      groupedOptions.set(key, option);
    }
  }

  return Array.from(groupedOptions.values()).map((option, index) => ({
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
  const optionById = new Map(options.map((option) => [option.id, option]));
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

    const linkedOption = optionById.get(override?.linkedOptionId ?? defaultRow.linkedOptionId ?? "") ?? optionById.get(defaultRow.linkedOptionId ?? "") ?? defaultRow;
    rows.push({
      ...linkedOption,
      id: defaultRow.id,
      name: override?.displayName || defaultRow.sourceName,
      sourceName: override?.displayName || defaultRow.sourceName,
      description: override?.description ?? defaultRow.description,
      order: override?.order ?? defaultRow.order,
      linkedOptionId: linkedOption.id,
    });
  }

  for (const [rowId, override] of Object.entries(normalizedOverrides)) {
    if (consumedOverrideIds.has(rowId) || override.visible === false) continue;

    const linkedOption = optionById.get(override.linkedOptionId ?? rowId) ?? optionById.get(rowId) ?? options[0];
    if (!linkedOption) continue;

    if (!rowId.startsWith("menu-custom-") && defaultRowByLabelKey.has(normalizeOptionLabelKey(linkedOption.sourceName))) {
      continue;
    }

    rows.push({
      ...linkedOption,
      id: rowId,
      name: override.displayName || linkedOption.sourceName,
      sourceName: override.displayName || linkedOption.sourceName,
      description: override.description ?? linkedOption.description,
      order: override.order ?? linkedOption.order,
      linkedOptionId: linkedOption.id,
    });
  }

  return rows.sort((left, right) => left.order - right.order || left.name.localeCompare(right.name, "ko"));
}
