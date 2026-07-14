import type { Service } from "@/types/domain";

export type PetGroupOption = {
  value: string;
  label: string;
};

const speciesLabelByValue: Record<string, string> = {
  dog: "강아지",
  cat: "고양이",
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

export function buildPetGroupOptions(services: Service[], currentValue?: string | null): PetGroupOption[] {
  const groups: PetGroupOption[] = [];
  const seen = new Set<string>();

  for (const service of services) {
    if (!service.price_guide || typeof service.price_guide !== "object") continue;
    const sections = (service.price_guide as { sections?: unknown }).sections;
    if (!Array.isArray(sections)) continue;

    for (const section of sections) {
      if (!section || typeof section !== "object") continue;
      const source = section as { title?: unknown; species?: unknown };
      const title = normalizeText(source.title);
      if (!title) continue;

      const species = normalizeText(source.species);
      const labelPrefix = speciesLabelByValue[species];
      const label = labelPrefix && !title.includes(labelPrefix) ? `${labelPrefix} / ${title}` : title;
      const key = label.toLocaleLowerCase("ko-KR");
      if (seen.has(key)) continue;
      seen.add(key);
      groups.push({ value: label, label });
    }
  }

  const current = normalizeText(currentValue);
  if (current && !seen.has(current.toLocaleLowerCase("ko-KR"))) {
    groups.unshift({ value: current, label: current });
  }

  if (groups.length === 0) {
    groups.push({ value: "미입력", label: "미입력" });
  }

  return groups;
}
