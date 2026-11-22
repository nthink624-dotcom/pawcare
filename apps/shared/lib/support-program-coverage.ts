import type { SupportProgram, SupportProgramArea, SupportProgramCoverage } from "../contracts/support-programs";

// Use the feed's region codes and retain aliases present in saved shop addresses.
const regions = {
  서울: ["서울특별시 서울시", "종로구 중구 용산구 성동구 광진구 동대문구 중랑구 성북구 강북구 도봉구 노원구 은평구 서대문구 마포구 양천구 강서구 구로구 금천구 영등포구 동작구 관악구 서초구 강남구 송파구 강동구"],
  부산: ["부산광역시 부산시", "중구 서구 동구 영도구 부산진구 동래구 남구 북구 해운대구 사하구 금정구 강서구 연제구 수영구 사상구 기장군"],
  대구: ["대구광역시 대구시", "중구 동구 서구 남구 북구 수성구 달서구 달성군 군위군"],
  인천: ["인천광역시 인천시", "중구 동구 미추홀구 연수구 남동구 부평구 계양구 서구 강화군 옹진군 제물포구 영종구 검단구"],
  광주: ["광주광역시", "동구 서구 남구 북구 광산구"],
  대전: ["대전광역시 대전시", "동구 중구 서구 유성구 대덕구"],
  울산: ["울산광역시 울산시", "중구 남구 동구 북구 울주군"],
  세종: ["세종특별자치시 세종시", ""],
  경기: ["경기도", "수원시 성남시 의정부시 안양시 부천시 광명시 평택시 동두천시 안산시 고양시 과천시 구리시 남양주시 오산시 시흥시 군포시 의왕시 하남시 용인시 파주시 이천시 안성시 김포시 화성시 광주시 양주시 포천시 여주시 연천군 가평군 양평군"],
  강원: ["강원도 강원특별자치도", "춘천시 원주시 강릉시 동해시 태백시 속초시 삼척시 홍천군 횡성군 영월군 평창군 정선군 철원군 화천군 양구군 인제군 고성군 양양군"],
  충북: ["충청북도", "청주시 충주시 제천시 보은군 옥천군 영동군 증평군 진천군 괴산군 음성군 단양군"],
  충남: ["충청남도", "천안시 공주시 보령시 아산시 서산시 논산시 계룡시 당진시 금산군 부여군 서천군 청양군 홍성군 예산군 태안군"],
  전북: ["전라북도 전북특별자치도", "전주시 군산시 익산시 정읍시 남원시 김제시 완주군 진안군 무주군 장수군 임실군 순창군 고창군 부안군"],
  전남: ["전라남도", "목포시 여수시 순천시 나주시 광양시 담양군 곡성군 구례군 고흥군 보성군 화순군 장흥군 강진군 해남군 영암군 무안군 함평군 영광군 장성군 완도군 진도군 신안군"],
  경북: ["경상북도", "포항시 경주시 김천시 안동시 구미시 영주시 영천시 상주시 문경시 경산시 의성군 청송군 영양군 영덕군 청도군 고령군 성주군 칠곡군 예천군 봉화군 울진군 울릉군"],
  경남: ["경상남도", "창원시 진주시 통영시 사천시 김해시 밀양시 거제시 양산시 의령군 함안군 창녕군 고성군 남해군 하동군 산청군 함양군 거창군 합천군"],
  제주: ["제주도 제주특별자치도", "제주시 서귀포시"],
} as const;

const cityDistricts: Record<string, string> = {
  수원시: "장안구 권선구 팔달구 영통구", 성남시: "수정구 중원구 분당구",
  안양시: "만안구 동안구", 부천시: "원미구 소사구 오정구", 안산시: "상록구 단원구",
  고양시: "덕양구 일산동구 일산서구", 용인시: "처인구 기흥구 수지구",
  화성시: "만세구 효행구 병점구 동탄구",
  청주시: "상당구 서원구 흥덕구 청원구", 천안시: "동남구 서북구",
  전주시: "완산구 덕진구", 포항시: "남구 북구",
  창원시: "의창구 성산구 마산합포구 마산회원구 진해구",
};

const regionNames = Object.keys(regions);
const regionAliases = new Map<string, readonly string[]>(
  Object.entries(regions).flatMap(([region, [aliases]]) => [region, ...aliases.split(" ")].map(name => [name, [region]] as const)),
);
const mergedRegionNames = ["전남광주", "광주전남", "전남광주통합특별시", "전남광주특별시"];
for (const alias of mergedRegionNames) regionAliases.set(alias, ["전남", "광주"]);
regionAliases.set("수도권", ["서울", "경기", "인천"]);
regionAliases.set("충청권", ["충남", "충북", "대전", "세종"]);

const areas: SupportProgramArea[] = Object.entries(regions).flatMap(([region, [, names]]) =>
  names.split(" ").filter(Boolean).flatMap(municipality => [
    { region, municipality },
    ...(cityDistricts[municipality] ?? "").split(" ").filter(Boolean).map(district => ({ region, municipality, district })),
  ]),
);

function words(value: string): string[] {
  return value.normalize("NFC").match(/[가-힣]+/gu) ?? [];
}

function provinces(names: string[]) {
  return [...new Set(names.flatMap(name => regionAliases.get(name) ?? []))];
}

function regionScope(names: string[], local: SupportProgramArea[]) {
  const named = provinces(names);
  if (!local.length) return named;
  const independentlyNamed = provinces(names.filter(name => !mergedRegionNames.includes(name)));
  return named.filter(region => independentlyNamed.includes(region) || local.some(area => area.region === region));
}

function areaKey({ region, municipality, district }: SupportProgramArea) {
  return [region, municipality, district].join("/");
}

function namedAreas(names: string[], preferred: string[], allowShort: boolean) {
  const result = new Map<string, SupportProgramArea>();
  for (const name of names) {
    const alias = regionAliases.get(name);
    if (alias && (!preferred.length || alias.some(region => preferred.includes(region)))) continue;
    const matches = areas.filter(area => {
      const full = area.district ?? area.municipality ?? "";
      return full === name || (allowShort && name.length > 1 && full.slice(0, -1) === name);
    });
    const city = names.find(part => matches.some(area => area.district && area.municipality === part));
    const qualified = matches.filter(area => (!preferred.length || preferred.includes(area.region)) && (!city || area.municipality === city));
    if (qualified.length === 1) result.set(areaKey(qualified[0]), qualified[0]);
  }
  return [...result.values()];
}

function moreSpecific(places: SupportProgramArea[]) {
  return places.filter(place => !places.some(other => other !== place && other.region === place.region
    && (!place.municipality || place.municipality === other.municipality)
    && (other.municipality && !place.municipality || other.district && !place.district)));
}

function byRegion(regionList: string[], specific: SupportProgramArea[]) {
  return moreSpecific([
    ...regionList.map(region => ({ region })),
    ...specific,
  ]);
}

function isNationwide(value: string) {
  return /(?:^|[^가-힣])전국(?:[\s·ㆍ,()\[\]]|$|단위|소재|대상)/u.test(value);
}

function readEligibility(summary: string) {
  const text = summary
    .replace(/<\/(?:div|p|li|tr)\s*>|<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]*>|&(?:nbsp|#160);/gi, " ");
  return text.split(/[\r\n;]|\.(?=\s|$)/u).filter(line =>
    /(?:신청|지원|모집|참여)\s*(?:대상|자격|요건)|(?:소재|관내).{0,32}(?:기업|소상공인|사업장|사업자)|(?:사업장|본사|본점).{0,32}(?:소재|관내)/u.test(line));
}

function eligibilityWords(value: string) {
  return words(value).flatMap(word => [
    word, word.replace(/(?:에서|에는|으로|에|의|내|는|은|을|를)$/u, ""),
  ]);
}

export function getSupportProgramCoverage({title, tags}: Pick<SupportProgram, "title" | "tags">, summary = ""): SupportProgramCoverage | null {
  const prefix = title.match(/^(?:\s*\[[^\]]+\])+/u)?.[0] ?? "";
  const prefixNames = words(prefix);
  const advertisedRegions = provinces(prefixNames);
  const taggedRegions = provinces(tags);
  const allRegionsTagged = regionNames.every(region => taggedRegions.includes(region));
  const context = advertisedRegions.length ? advertisedRegions : allRegionsTagged ? [] : taggedRegions;

  const eligible = readEligibility(summary);
  // Negative eligibility and venue descriptions are not evidence that a shop qualifies.
  const exclusionPattern = /([가-힣]+(?:(?:\s*[,·ㆍ\/]\s*|\s+및\s+)[가-힣]+)*)\s*제외/gu;
  const excluded = eligible.flatMap(line => [...line.matchAll(exclusionPattern)]
    .flatMap(match => {
      const names = eligibilityWords(match[1]);
      return byRegion(provinces(names), namedAreas(names, context, false));
    }));
  const positive = eligible.map(line => line.replace(exclusionPattern, ""));
  const outsideCapital = positive.some(line => words(line).includes("비수도권"));
  if (outsideCapital) {
    excluded.push(...provinces(["수도권"]).map(region => ({ region })));
  }
  const eligibleNames = positive.flatMap(eligibilityWords);
  const eligibleRegions = provinces(eligibleNames);
  const eligibleAreas = namedAreas(eligibleNames, eligibleRegions.length ? eligibleRegions : context, true);

  const declaredNames = words(title.slice(prefix.length));
  const titleCandidates = advertisedRegions.length ? declaredNames : declaredNames.slice(0, 1);
  const titleAreas = namedAreas([...prefixNames, ...titleCandidates], context, false);
  const leadingAreas = namedAreas(declaredNames.slice(0, 1), context, true);
  const tagAreas = allRegionsTagged ? [] : namedAreas(tags, context, true);
  const specificTitleAreas = titleAreas.length ? titleAreas : leadingAreas;
  const titleCoverage = byRegion(regionScope(prefixNames, specificTitleAreas.length ? specificTitleAreas : tagAreas),
    specificTitleAreas.length ? specificTitleAreas : advertisedRegions.length ? tagAreas : []);

  const explicitNationwide = positive.some(isNationwide) || isNationwide(prefix) || /^전국(?:[\s(]|단위|소재|$)/u.test(title) || tags.some(tag => /^#?전국(?:\s*단위)?$/u.test(tag));
  if (eligibleAreas.length) return { included: byRegion(regionScope(eligibleNames, eligibleAreas), eligibleAreas), excluded };
  if (explicitNationwide) return { included: "nationwide", excluded };
  // A province named in eligibility can confirm, but should not widen, a more precise title.
  if (titleCoverage.length) return { included: titleCoverage, excluded };
  if (eligibleRegions.length) return { included: byRegion(eligibleRegions, []), excluded };
  if (allRegionsTagged || outsideCapital) {
    return { included: "nationwide", excluded };
  }
  if (taggedRegions.length || tagAreas.length) return { included: byRegion(regionScope(tags, tagAreas), tagAreas), excluded };
  return null;
}

function getShopArea(shopAddress: string) {
  const address = words(shopAddress).filter(word => !["대한민국", "우편번호", "우"].includes(word));
  const [regionName, ...localNames] = address;
  const known = provinces([regionName]);
  const names = known.length ? localNames.slice(0, 2) : address.slice(0, 2);
  const places = moreSpecific(namedAreas(names, known, true));
  if (places.length === 1) return places[0];
  return known.length === 1 ? { region: known[0] } : null;
}

function includesShop(area: SupportProgramArea, shop: SupportProgramArea | null) {
  return shop?.region === area.region
    && (!area.municipality || shop.municipality === area.municipality)
    && (!area.district || shop.district === area.district);
}

export function supportProgramsForShop(programs: SupportProgram[], shopAddress: string) {
  const shop = getShopArea(shopAddress);
  return programs.filter(program => {
    const scope = program.calendarCoverage === undefined ? getSupportProgramCoverage(program) : program.calendarCoverage;
    if (!scope || scope.excluded.some(area => includesShop(area, shop)
      || !shop || (area.region === shop.region && area.municipality && !shop.municipality)
      || (area.region === shop.region && area.municipality === shop.municipality && area.district && !shop.district))) return false;
    return scope.included === "nationwide" || scope.included.some(area => includesShop(area, shop));
  });
}
