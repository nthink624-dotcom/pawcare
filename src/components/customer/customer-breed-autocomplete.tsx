"use client";

import { forwardRef, useMemo } from "react";

import { matchesKoreanSearch } from "@/lib/korean-text-search";

export const CUSTOMER_BREED_OPTIONS = [
  "말티즈", "믹스", "말티푸", "푸들", "포메라니안", "비숑", "시츄", "치와와",
  "요크셔테리어", "스피츠", "슈나우저", "코카스파니엘", "닥스훈트", "웰시코기",
  "골든리트리버", "래브라도리트리버", "프렌치불독", "불독", "보더콜리", "진돗개",
  "사모예드", "시바견", "페키니즈", "미니어처핀셔", "파피용", "비글", "보스턴테리어",
  "잭러셀테리어", "이탈리안그레이하운드", "베들링턴테리어", "차우차우", "셰틀랜드쉽독",
  "코리안숏헤어", "브리티시숏헤어", "러시안블루", "스코티시폴드", "먼치킨", "페르시안",
  "랙돌", "메인쿤", "샴", "아비시니안",
] as const;

const INITIAL_SUGGESTION_COUNT = 14;
const SEARCH_SUGGESTION_COUNT = 10;

const CustomerBreedAutocomplete = forwardRef<HTMLInputElement, {
  value: string;
  onChange: (value: string) => void;
}>(function CustomerBreedAutocomplete({ value, onChange }, ref) {
  const trimmedQuery = value.trim();
  const suggestions = useMemo(
    () =>
      (trimmedQuery
        ? CUSTOMER_BREED_OPTIONS.filter((breed) => matchesKoreanSearch(breed, trimmedQuery)).slice(0, SEARCH_SUGGESTION_COUNT)
        : CUSTOMER_BREED_OPTIONS.slice(0, INITIAL_SUGGESTION_COUNT)),
    [trimmedQuery],
  );

  return (
    <div className="field breed-search">
      <label htmlFor="customer-pet-breed">품종</label>
      <input
        ref={ref}
        id="customer-pet-breed"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="품종을 입력해 주세요"
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-controls="customer-breed-suggestions"
        aria-expanded={suggestions.length > 0}
      />
      {suggestions.length > 0 ? (
        <div id="customer-breed-suggestions" className="chips breed-suggestions" role="listbox" aria-label="추천 품종">
          {suggestions.map((breed) => {
            const selected = trimmedQuery === breed;
            return (
              <button
                key={breed}
                className={`breedchip${selected ? " sel" : ""}`}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => onChange(breed)}
              >
                {breed}
              </button>
            );
          })}
        </div>
      ) : trimmedQuery ? (
        <p className="breed-direct-note">검색 결과가 없어도 입력한 품종으로 예약할 수 있어요.</p>
      ) : null}
    </div>
  );
});

export default CustomerBreedAutocomplete;
