import type { CustomerServiceSourceOption } from "@/lib/customer-service-options";

export type DiscountServiceScopeOption = CustomerServiceSourceOption & {
  linkedOptionIds: string[];
};

function getServiceScopeLabel(option: CustomerServiceSourceOption) {
  const group = option.category.replace(/^(?:강아지|고양이)(?:\s*\/\s*|$)/, "").trim();
  const service = option.displayName.trim();
  return [group, service].filter(Boolean).join(" / ");
}

export function buildDiscountServiceScopeOptions(
  options: CustomerServiceSourceOption[],
): DiscountServiceScopeOption[] {
  const optionByDisplayKey = new Map<string, DiscountServiceScopeOption>();

  for (const option of options) {
    const sourceName = getServiceScopeLabel(option);
    const displayKey = sourceName.normalize("NFKC").replace(/\s+/g, "").toLocaleLowerCase("ko-KR");
    const linkedOptionIds = Array.from(new Set([option.linkedOptionId ?? option.id, ...(option.aliasIds ?? [])]));
    const existing = optionByDisplayKey.get(displayKey);
    if (existing) {
      existing.linkedOptionIds = Array.from(new Set([...existing.linkedOptionIds, ...linkedOptionIds]));
      continue;
    }

    optionByDisplayKey.set(displayKey, { ...option, sourceName, linkedOptionIds });
  }

  return Array.from(optionByDisplayKey.values());
}
