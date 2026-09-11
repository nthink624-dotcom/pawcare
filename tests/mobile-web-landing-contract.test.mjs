import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8");
const landing = await readFile(new URL("../src/components/landing/mobile-web-landing.tsx", import.meta.url), "utf8");

test("public root renders the static mobile landing instead of redirecting to owner mobile", () => {
  assert.match(page, /import MobileWebLanding from "@\/components\/landing\/mobile-web-landing"/);
  assert.match(page, /return <MobileWebLanding \/>;/);
  assert.doesNotMatch(page, /redirect\(/);
  assert.doesNotMatch(landing, /owner-landing-embed|OwnerApp|MobileAiPriceGuideFixture/);
});

test("landing reuses verified brand copy and routes each public CTA without auth or API work", () => {
  assert.match(landing, /ServiceBrand/);
  assert.match(landing, /PETMANAGER_SERVICE_DESCRIPTION/);
  assert.match(landing, /반려동물 미용샵의 예약과 고객 관리/);
  assert.match(landing, /href="\/login\?next=\/owner\/mobile"/);
  assert.match(landing, /href="\/signup\?next=\/owner\/mobile"/);
  assert.doesNotMatch(landing, /fetch\(|getServerSessionUser|useEffect|useState|redirect\(/);
});

test("landing keeps the requested operational content, legal paths, and accessible control sizes", () => {
  for (const benefit of ["예약 관리", "고객 관리", "서비스·요금 관리"]) {
    assert.match(landing, new RegExp(benefit));
  }
  for (const step of ["무료체험 시작하기", "가입 정보 입력", "로그인 후 관리 시작"]) {
    assert.match(landing, new RegExp(step));
  }
  for (const href of ["/terms", "/privacy", "/business"]) {
    assert.match(landing, new RegExp(`href="${href}"`));
  }
  assert.match(landing, /min-h-11/);
  assert.match(landing, /min-h-14/);
  assert.match(landing, /focus-visible:outline-2/);
  assert.match(landing, /max-w-\[720px\]/);
  assert.match(landing, /grooming-salon-hero\.png/);
});

test("landing header preserves the normal row while reflowing the login target at the 200 percent equivalent", () => {
  assert.match(landing, /flex-wrap/);
  assert.match(landing, /justify-between/);
  assert.match(landing, /max-\[220px\]:-mx-3/);
  assert.match(landing, /max-\[220px\]:w-full/);
  assert.match(landing, /max-\[220px\]:basis-full/);
  assert.match(landing, /href="\/login\?next=\/owner\/mobile"/);
  assert.match(landing, /min-h-11/);
});
