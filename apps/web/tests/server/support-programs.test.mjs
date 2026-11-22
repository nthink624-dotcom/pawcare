import assert from "node:assert/strict";
import test from "node:test";
import { readSupportProgramPage } from "../../src/server/support-programs.ts";
import { supportProgramsForShop } from "@petmanager/shared/lib/support-program-coverage";

const officialNotice = "https://www.bizinfo.go.kr/web/lay1/bbs/S1T122C128/AS/74/view.do?pblancId=PBLN_0001";

function row(overrides = {}) {
  return { pblancId: "PBLN_0001", pblancUrl: officialNotice, pblancNm: "소상공인 경영 지원", jrsdInsttNm: "중소벤처기업부", ...overrides };
}

function page(items, totalCount = items.length) {
  return { response: { header: { resultCode: "00" }, body: { items, totalCount } } };
}

test("지원사업의 공식 이름과 신청기간을 보존하고 정확한 마감일을 읽는다", () => {
  const applicationPeriod = "2026-11-19 ~ 2026-12-11";
  const { programs } = readSupportProgramPage(page([row({
    reqstBeginEndDe: applicationPeriod, creatPnttm: "2026-11-20 10:08:39", hashtags: "소상공인, 경북,소상공인",
  })], "1"));
  assert.deepEqual(programs[0], {
    id: "PBLN_0001", title: "소상공인 경영 지원", agency: "중소벤처기업부", sourceUrl: officialNotice, applicationPeriod,
    opensOn: "2026-11-19", closesOn: "2026-12-11", publishedAt: "2026-11-20T01:08:39.000Z", tags: ["소상공인", "경북"],
    calendarCoverage: { included: [{ region: "경북" }], excluded: [] },
  });
});

test("잘못된 공고 등록일은 정렬에 사용할 날짜로 변환하지 않는다", () => {
  for (const creatPnttm of ["2026-02-30 10:08:39", "2026-11-20 24:00:00", null]) {
    assert.equal(readSupportProgramPage(page([row({ creatPnttm })])).programs[0].publishedAt, null);
  }
});

test("예산 소진, 불명확한 기간, 잘못된 날짜는 공식 문구만 표시한다", () => {
  const periods = ["예산 소진시까지", "2026-12-11", "2026-02-30 ~ 2026-03-11", "2026-12-11 ~ 2026-11-19"];
  for (const applicationPeriod of periods) {
    const { programs } = readSupportProgramPage(page([row({ reqstBeginEndDe: applicationPeriod })]));
    assert.equal(programs[0].applicationPeriod, applicationPeriod);
    assert.equal(programs[0].closesOn, null);
  }
});

test("공식 페이지 링크만 허용하고 응답 누락을 정상 빈 목록으로 처리하지 않는다", () => {
  const currentNotice = "https://www.bizinfo.go.kr/sii/siia/selectSIIA200Detail.do?pblancId=PBLN_0001";
  const { programs } = readSupportProgramPage(page([
    row({ pblancUrl: currentNotice }),
    row({ pblancUrl: "javascript:void(0)" }),
    row({ pblancUrl: "https://bizinfo.go.kr.untrusted.invalid/web/a" }),
    row({ pblancUrl: "https://external.invalid@www.bizinfo.go.kr/web/a" }),
  ]));
  assert.deepEqual(programs.map(program => program.sourceUrl), [currentNotice]);
  assert.deepEqual(readSupportProgramPage(page([], 0)).programs, []);
  assert.throws(() => readSupportProgramPage(page([row({ pblancUrl: "https://example.invalid/" })])));
  assert.throws(() => readSupportProgramPage(page([], null)));
  assert.throws(() => readSupportProgramPage(page(undefined, 2)));
});

test("천안 매장에는 천안·충남·광역 공동·전국만 들어오고 동해·예산은 빠진다", () => {
  const inputs = [
    ["[강원] 동해시 카드수수료 지원", "강원,동해시", ""],
    ["[충남] 예산군 이차보전금 지원", "충남,예산군", ""],
    ["[충남] 천안시 소상공인 특례보증", "충남,천안시", ""],
    ["[충남] 소상공인 지원", "충남", "지원대상: 충청남도에 소재한 소상공인"],
    ["충청권 공동 지원", "충남,세종", ""],
    ["[전국] 소상공인 지원", "소상공인", ""],
    ["신청 지역을 알 수 없는 지원", "금융,소상공인", ""],
    ["[충남] 시군 대상 사업", "충남,아산시", ""],
  ];
  const { programs } = readSupportProgramPage(page(inputs.map(([pblancNm, hashtags, bsnsSumryCn], i) =>
    row({ pblancId: "PBLN_100"+i, pblancNm, hashtags, bsnsSumryCn }))));
  const match = address => supportProgramsForShop(programs, address).map(p => p.id);
  assert.deepEqual(match("충청남도 천안시 서북구 테스트로 1"), ["PBLN_1002", "PBLN_1003", "PBLN_1004", "PBLN_1005"]);
  assert.deepEqual(match("강원특별자치도 동해시 테스트로 1"), ["PBLN_1000", "PBLN_1005"]);
  assert.deepEqual(match(""), ["PBLN_1005"]);
});

test("대상 본문의 구 단위 제한과 제외 지역을 반영한다", () => {
  const { programs } = readSupportProgramPage(page([
    row({ pblancId: "PBLN_201", pblancNm: "[충남] 소상공인 지원", hashtags: "충남",
      bsnsSumryCn: "<p>지원 대상: 천안시 서북구에 소재한 소상공인</p>" }),
    row({ pblancId: "PBLN_202", pblancNm: "[전국] 모집 공고", hashtags: "소상공인",
      bsnsSumryCn: "신청 대상: 전국 소상공인 (제주 제외)" }),
  ]));
  const match = address => supportProgramsForShop(programs,address).map(p => p.id);
  assert.deepEqual(match("충남 천안시 서북구 테스트로 1"), ["PBLN_201","PBLN_202"]);
  assert.deepEqual(match("충남 천안시 동남구 테스트로 1"), ["PBLN_202"]);
  assert.deepEqual(match("제주특별자치도 서귀포시 테스트로 1"), []);
});

test("기업마당 전체 지역 해시태그와 기관 소재지를 구분하고 예전 공고 응답과 호환한다", () => {
  const common = "서울,부산,대구,인천,전남광주,대전,울산,세종,경기,강원,충북,충남,전북,경북,경남,제주";
  const { programs } = readSupportProgramPage(page([
    row({ pblancId: "PBLN_301", pblancNm: "대한상공회의소 무료 경영상담 지원", hashtags: common, jrsdInsttNm: "서울특별시" }),
    row({ pblancId: "PBLN_302", pblancNm: "[충남] 천안시 지원", hashtags: common }),
    row({ pblancId: "PBLN_303", pblancNm: "[전남광주] 순천시 지원", hashtags: "전남광주" }),
  ]));
  const previous = programs.map(({ calendarCoverage, ...program }) => program);
  for (const list of [programs, previous]) {
    assert.deepEqual(supportProgramsForShop(list,"(우편번호 31111) 충남 천안시 테스트로 1").map(p=>p.id), ["PBLN_301","PBLN_302"]);
    assert.deepEqual(supportProgramsForShop(list,"전남광주통합특별시 순천시 테스트로 1").map(p=>p.id), ["PBLN_301","PBLN_303"]);
    assert.deepEqual(supportProgramsForShop(list,"전남광주통합특별시 광산구 테스트로 1").map(p=>p.id), ["PBLN_301"]);
  }
});


test("비수도권 공고와 둘 이상의 명시 제외 지역을 주소에 대조한다", () => {
  const { programs } = readSupportProgramPage(page([
    row({ pblancId: "PBLN_401", pblancNm: "지방 소상공인 사업", bsnsSumryCn: "지원대상: 비수도권 소상공인" }),
    row({ pblancId: "PBLN_402", pblancNm: "[전국] 신청 공고", bsnsSumryCn: "모집대상: 전국 소상공인 (서울·경기를 제외)" }),
  ]));
  const match = address => supportProgramsForShop(programs, address).map(p => p.id);
  assert.deepEqual(match("서울특별시 서초구 테스트로 1"), []);
  assert.deepEqual(match("경기도 성남시 분당구 테스트로 1"), []);
  assert.deepEqual(match("인천광역시 영종구 테스트로 1"), ["PBLN_402"]);
  assert.deepEqual(match("충남 천안시 테스트로 1"), ["PBLN_401", "PBLN_402"]);
});
