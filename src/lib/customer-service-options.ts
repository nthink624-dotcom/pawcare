import type { Service } from "@/types/domain";

export type CustomerServiceDisplayOverride = {
  visible?: boolean;
  order?: number;
  displayName?: string;
  description?: string;
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
};

function getPriceGuideSections(guide: unknown) {
  if (!guide || typeof guide !== "object") return [];
  const source = guide as { enabled?: unknown; sections?: unknown };
  if (source.enabled === false) return [];
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

      return Object.keys(override).length > 0 ? [[normalizedKey, override]] : [];
    }),
  );
}

export function buildCustomerServiceSourceOptions(
  services: Service[],
  options: { includeInactive?: boolean } = {},
): CustomerServiceSourceOption[] {
  const result: CustomerServiceSourceOption[] = [];
  const seen = new Set<string>();

  for (const service of services) {
    if (!options.includeInactive && !service.is_active) continue;

    for (const section of getPriceGuideSections(service.price_guide)) {
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
        if (!label) continue;

        const dedupeKey = `${service.id}:${label}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        const cells =
          sourceItem.cells && typeof sourceItem.cells === "object"
            ? (sourceItem.cells as Record<string, { price?: unknown; durationMinutes?: unknown }>)
            : {};
        const firstCell =
          weightBands.map((band) => cells[band]).find((cell) => numberFromText(cell?.price) || numberFromText(cell?.durationMinutes)) ??
          Object.values(cells).find((cell) => numberFromText(cell?.price) || numberFromText(cell?.durationMinutes));

        result.push({
          id: `${service.id}:${String(sourceItem.id ?? label)}`,
          serviceId: service.id,
          name: label,
          sourceName: label,
          category: sectionTitle,
          description: "",
          durationMinutes: numberFromText(firstCell?.durationMinutes) ?? service.duration_minutes,
          price: numberFromText(firstCell?.price) ?? service.price,
          priceType: service.price_type ?? "starting",
          order: result.length + 1,
        });
      }
    }

    if (result.some((option) => option.serviceId === service.id)) continue;

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

export function applyCustomerServiceOverrides(
  options: CustomerServiceSourceOption[],
  overrides: unknown,
): CustomerServiceSourceOption[] {
  const normalizedOverrides = normalizeCustomerServiceOverrides(overrides);

  return options
    .map((option) => {
      const override = normalizedOverrides[option.id];
      return {
        ...option,
        name: override?.displayName || option.sourceName,
        description: override?.description ?? option.description,
        order: override?.order ?? option.order,
        visible: override?.visible ?? true,
      };
    })
    .filter((option) => option.visible)
    .sort((left, right) => left.order - right.order || left.name.localeCompare(right.name, "ko"));
}
