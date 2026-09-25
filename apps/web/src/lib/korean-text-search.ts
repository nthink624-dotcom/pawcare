const HANGUL_BASE = 0xac00;
const HANGUL_END = 0xd7a3;
const JUNGSEONG_COUNT = 21;
const JONGSEONG_COUNT = 28;

const CHOSEONG = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
const JUNGSEONG = ["ㅏ", "ㅐ", "ㅑ", "ㅒ", "ㅓ", "ㅔ", "ㅕ", "ㅖ", "ㅗ", "ㅘ", "ㅙ", "ㅚ", "ㅛ", "ㅜ", "ㅝ", "ㅞ", "ㅟ", "ㅠ", "ㅡ", "ㅢ", "ㅣ"];
const JONGSEONG = ["", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];

function normalizeSearchText(value: string) {
  return value.normalize("NFC").replace(/\s+/g, "").toLocaleLowerCase("ko-KR");
}

export function decomposeHangulForSearch(value: string) {
  return Array.from(normalizeSearchText(value), (character) => {
    const code = character.charCodeAt(0);
    if (code < HANGUL_BASE || code > HANGUL_END) return character;

    const offset = code - HANGUL_BASE;
    const choseongIndex = Math.floor(offset / (JUNGSEONG_COUNT * JONGSEONG_COUNT));
    const jungseongIndex = Math.floor((offset % (JUNGSEONG_COUNT * JONGSEONG_COUNT)) / JONGSEONG_COUNT);
    const jongseongIndex = offset % JONGSEONG_COUNT;
    return `${CHOSEONG[choseongIndex]}${JUNGSEONG[jungseongIndex]}${JONGSEONG[jongseongIndex]}`;
  }).join("");
}

export function getHangulInitials(value: string) {
  return Array.from(normalizeSearchText(value), (character) => {
    const code = character.charCodeAt(0);
    if (code < HANGUL_BASE || code > HANGUL_END) return character;
    return CHOSEONG[Math.floor((code - HANGUL_BASE) / (JUNGSEONG_COUNT * JONGSEONG_COUNT))];
  }).join("");
}

export function matchesKoreanSearch(candidate: string, query: string) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  const normalizedCandidate = normalizeSearchText(candidate);
  if (normalizedCandidate.startsWith(normalizedQuery)) return true;
  if (/^[ㄱ-ㅎ]+$/.test(normalizedQuery)) {
    return getHangulInitials(candidate).startsWith(normalizedQuery);
  }
  if (decomposeHangulForSearch(candidate).startsWith(decomposeHangulForSearch(query))) return true;
  return false;
}
