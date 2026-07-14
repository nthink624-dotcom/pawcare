import type { Service } from "@/types/domain";

export type CustomerBreedPricingGroup = {
  key: string;
  title: string;
  matchedBreed: string;
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function normalizeMatchText(value: unknown) {
  return normalizeText(value).replace(/[()\[\]{}.,/\\-]/g, "").toLocaleLowerCase("ko-KR");
}

export function buildCustomerPriceGuideGroupKey(species: unknown, title: unknown) {
  const normalizedTitle = normalizeMatchText(title);
  if (!normalizedTitle) return "";
  const normalizedSpecies = normalizeMatchText(species) || "unknown";
  return `${normalizedSpecies}:${normalizedTitle}`;
}

function getBreedAliases(note: unknown) {
  if (typeof note !== "string") return [];

  return note
    .split(/[,\n\r，、]/)
    .map((item) => item.replace(/^(?:대표\s*품종|품종)\s*[:：]\s*/i, "").trim())
    .filter((item) => normalizeMatchText(item).length >= 2);
}

export function findCustomerBreedPricingGroup(services: Service[], breed: string): CustomerBreedPricingGroup | null {
  const normalizedBreed = normalizeMatchText(breed);
  if (normalizedBreed.length < 2) return null;

  const matches: Array<CustomerBreedPricingGroup & { aliasLength: number; exact: boolean }> = [];

  for (const service of services) {
    if (!service.is_active || !service.price_guide || typeof service.price_guide !== "object") continue;
    const sections = (service.price_guide as { sections?: unknown }).sections;
    if (!Array.isArray(sections)) continue;

    for (const section of sections) {
      if (!section || typeof section !== "object") continue;
      const source = section as { species?: unknown; title?: unknown; note?: unknown };
      const title = normalizeText(source.title);
      const key = buildCustomerPriceGuideGroupKey(source.species, title);
      if (!title || !key) continue;

      for (const alias of getBreedAliases(source.note)) {
        const normalizedAlias = normalizeMatchText(alias);
        if (!normalizedAlias || (!normalizedBreed.includes(normalizedAlias) && !normalizedAlias.includes(normalizedBreed))) continue;
        matches.push({ key, title, matchedBreed: alias, aliasLength: normalizedAlias.length, exact: normalizedBreed === normalizedAlias });
      }
    }
  }

  matches.sort((left, right) => Number(right.exact) - Number(left.exact) || right.aliasLength - left.aliasLength || left.title.localeCompare(right.title, "ko"));
  const match = matches[0];
  return match ? { key: match.key, title: match.title, matchedBreed: match.matchedBreed } : null;
}
