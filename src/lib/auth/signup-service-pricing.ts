import { z } from "zod";

export const signupPriceGuideReviewCopy = {
  label: "AI가 읽은 임시 목록",
  supporting: "틀린 내용을 고친 뒤 저장하세요. 저장 전에는 공개되지 않습니다.",
} as const;

export const signupServicePriceSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().trim().min(1).max(80),
  detailName: z.string().trim().max(120).default(""),
  price: z.coerce.number().int().min(0).max(100_000_000),
  durationMinutes: z.coerce.number().int().min(5).max(1_440),
  species: z.enum(["dog", "cat", "all"]),
  breedGroup: z.string().trim().max(120).default(""),
  weightBand: z.string().trim().max(80).default(""),
});

export const signupServicePricesSchema = z.array(signupServicePriceSchema).min(1).max(80);

export type SignupServicePrice = z.infer<typeof signupServicePriceSchema>;

export function normalizeSignupServicePrices(input: unknown) {
  const normalized = signupServicePricesSchema.parse(input).map((service) => ({
    ...service,
    name: service.name.trim(),
    detailName: service.detailName.trim(),
    breedGroup: service.breedGroup.trim(),
    weightBand: service.weightBand.trim(),
  }));
  const seen = new Set<string>();
  return normalized.filter((service) => {
    const key = [service.name, service.detailName, service.species, service.breedGroup, service.weightBand, service.price, service.durationMinutes]
      .join("|")
      .toLocaleLowerCase("ko-KR");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildSignupServicePriceGuide(service: SignupServicePrice) {
  return {
    enabled: true,
    signupSource: "owner_confirmed",
    detailName: service.detailName,
    species: service.species,
    breedGroup: service.breedGroup,
    weightBand: service.weightBand,
  };
}
