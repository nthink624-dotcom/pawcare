import type { Service } from "@/types/domain";
import { readCanonicalPriceGuide } from "@/lib/price-guide-core";

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

export function findCustomerBreedPricingGroup(services: Service[], breed: string): CustomerBreedPricingGroup | null {
  const normalizedBreed = normalizeMatchText(breed);
  if (normalizedBreed.length < 2) return null;

  const matches: Array<CustomerBreedPricingGroup & { aliasLength: number; exact: boolean }> = [];

  for (const service of services) {
    if (!service.is_active || !service.price_guide || typeof service.price_guide !== "object") continue;
    const document = readCanonicalPriceGuide(service.price_guide);
    if (!document) continue;

    for (const row of document.rows) {
      const title = normalizeText(row.breedGroup);
      const key = buildCustomerPriceGuideGroupKey(row.species, title);
      if (!title || !key) continue;

      for (const alias of row.breedNames) {
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
