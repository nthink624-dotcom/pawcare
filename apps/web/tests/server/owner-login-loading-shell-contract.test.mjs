import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const ownerPage = fs.readFileSync(path.join(process.cwd(), "src/app/owner/page.tsx"), "utf8");

test("owner login loading shell uses one accessible content plane without changing session flow", () => {
  assert.match(ownerPage, /const \[loadError, setLoadError\] = useState<string \| null>\(null\)/);
  assert.match(ownerPage, /const \[showSlowLoadHint, setShowSlowLoadHint\] = useState\(false\)/);
  assert.match(ownerPage, /window\.setTimeout\([\s\S]{0,100}setShowSlowLoadHint\(true\)[\s\S]{0,100}OWNER_SESSION_SLOW_NOTICE_MS/);
  assert.match(ownerPage, /오너 화면을 불러오는 중입니다\./);
  assert.match(ownerPage, /로그인 상태와 매장 정보를 확인하고 있습니다\./);
  assert.match(ownerPage, /<main className="pt-7" aria-busy=\{loadError === null\}/);
  assert.match(ownerPage, /role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(ownerPage, /role="alert"/);
  assert.match(ownerPage, /서비스 설정을 확인하지 못했습니다\. 운영자에게 문의해 주세요\./);
  assert.match(ownerPage, /연결된 매장 정보를 찾을 수 없습니다\. 고객센터로 문의해 주세요\./);
  assert.match(ownerPage, /이 계정은 운영자에 의해 일시 정지되었습니다\. 운영자에게 문의해 주세요\./);
  assert.match(ownerPage, /motion-reduce:animate-none/);
  assert.match(ownerPage, /accessToken \? \([\s\S]{0,700}data-testid="owner-authenticated-shell-control"/);
  assert.match(ownerPage, /min-h-11[\s\S]{0,320}focus-visible:outline/);
  assert.doesNotMatch(ownerPage, /max-w-\[430px\] bg-\[#faf7f2\]/);
});
