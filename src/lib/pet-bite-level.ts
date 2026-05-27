import type { PetBiteLevel } from "@/types/domain";

export const petBiteLevelOptions: Array<{ value: PetBiteLevel; label: string; description: string }> = [
  { value: "none", label: "없음", description: "평소 입질이 거의 없어요." },
  { value: "watch", label: "주의", description: "특정 부위나 상황에서 주의가 필요해요." },
  { value: "bite", label: "입질 있음", description: "미용 중 입질 가능성이 있어요." },
  { value: "strong", label: "강한 입질", description: "반드시 사전 공유가 필요해요." },
];

const petBiteLevelSet = new Set<PetBiteLevel>(petBiteLevelOptions.map((option) => option.value));

export function normalizePetBiteLevel(value: unknown): PetBiteLevel {
  return typeof value === "string" && petBiteLevelSet.has(value as PetBiteLevel) ? (value as PetBiteLevel) : "none";
}

export function getPetBiteLevelLabel(value: unknown) {
  const level = normalizePetBiteLevel(value);
  return petBiteLevelOptions.find((option) => option.value === level)?.label ?? "없음";
}

export function getPetBiteLevelBadgeClass(value: unknown) {
  const level = normalizePetBiteLevel(value);
  if (level === "strong") return "border-[#e0b5bd] bg-[#fff7f8] text-[#a04455]";
  if (level === "bite") return "border-[#ead1a3] bg-[#fffaf0] text-[#8a5b11]";
  if (level === "watch") return "border-[#eadfd3] bg-[#fffaf5] text-[#8a5b11]";
  return "border-[#dbe2ea] bg-white text-[#64748b]";
}
