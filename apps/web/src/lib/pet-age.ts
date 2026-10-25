export type PetAgeSource = {
  birthday: string | null;
  birthday_precision?: "day" | "month" | null;
  age: number | null;
  age_reference_year?: number | null;
  created_at?: string;
};

function dateParts(value: string) {
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3] ?? 1);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function ageFromBirthday(birthday: string, precision: "day" | "month", now: Date) {
  const birth = dateParts(birthday);
  if (!birth) return null;
  let months = (now.getFullYear() - birth.year) * 12 + now.getMonth() + 1 - birth.month;
  if (precision === "day" && now.getDate() < birth.day) months -= 1;
  if (months < 0) return null;
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (years === 0) return `${remainingMonths}개월`;
  return remainingMonths === 0 ? `${years}살` : `${years}살 ${remainingMonths}개월`;
}

export function getPetAgeLabel(pet: PetAgeSource, now = new Date()) {
  if (pet.birthday) {
    return ageFromBirthday(pet.birthday, pet.birthday_precision === "month" ? "month" : "day", now) ?? "미등록";
  }
  if (typeof pet.age !== "number" || !Number.isFinite(pet.age)) return "미등록";
  const referenceYear = pet.age_reference_year ?? Number(pet.created_at?.slice(0, 4));
  const years = Number.isFinite(referenceYear) ? pet.age + now.getFullYear() - referenceYear : pet.age;
  return years >= 0 ? `${years}살` : "미등록";
}

export function getPetBirthLabel(pet: PetAgeSource) {
  if (!pet.birthday) return "생일 미상";
  const parts = dateParts(pet.birthday);
  if (!parts) return "생일 미등록";
  if (pet.birthday_precision === "month") return `${parts.year}년 ${parts.month}월`;
  return `${parts.year}년 ${parts.month}월 ${parts.day}일`;
}
