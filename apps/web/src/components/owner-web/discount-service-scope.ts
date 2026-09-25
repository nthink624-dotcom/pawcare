import type { CustomerServiceSourceOption } from "@/lib/customer-service-options";

export type DiscountServiceScopeOption = CustomerServiceSourceOption & {
  linkedOptionIds: string[];
};

function getLinkedOptionId(option: CustomerServiceSourceOption) {
  return option.linkedOptionId ?? option.id;
}

function getServiceScopeDisplayKey(option: CustomerServiceSourceOption) {
  return [option.category, option.sourceName, option.durationMinutes, option.price, option.priceType]
    .join("|")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("ko-KR");
}

export function buildDiscountServiceScopeOptions(
  options: CustomerServiceSourceOption[],
): DiscountServiceScopeOption[] {
  const optionByDisplayKey = new Map<string, DiscountServiceScopeOption>();

  for (const option of options) {
    const displayKey = getServiceScopeDisplayKey(option);
    const linkedOptionId = getLinkedOptionId(option);
    const existing = optionByDisplayKey.get(displayKey);
    if (existing) {
      if (!existing.linkedOptionIds.includes(linkedOptionId)) existing.linkedOptionIds.push(linkedOptionId);
      continue;
    }

    optionByDisplayKey.set(displayKey, { ...option, linkedOptionIds: [linkedOptionId] });
  }

  return Array.from(optionByDisplayKey.values());
}
