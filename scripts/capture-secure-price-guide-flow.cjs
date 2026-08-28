const { chromium } = require("playwright");
const path = require("node:path");

const baseUrl = "http://127.0.0.1:3107/dev/secure-ai-price-guide-preview";
const artifactDir = path.resolve("artifacts/secure-ai-price-guide-import-v0.1");
const fixturePath = path.join(artifactDir, "korean-price-guide-fixture.png");

async function uploadAndWait(page) {
  await page.locator('input[type="file"]').first().setInputFiles(fixturePath);
  await page.getByRole("textbox", { name: "서비스명" }).first().waitFor({ state: "visible" });
  await page.getByText("Development fixture · 외부 Vision 호출 없음", { exact: false }).waitFor();
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    await mobile.goto(baseUrl, { waitUntil: "networkidle" });
    await uploadAndWait(mobile);

    const detailInputs = mobile.getByRole("textbox", { name: "상세 항목" });
    const priceInputs = mobile.getByRole("textbox", { name: "기본 가격" });
    await detailInputs.first().fill("시그니처 컷");
    await priceInputs.first().fill("85000");
    await mobile.getByRole("button", { name: "서비스 3 삭제" }).click();
    await mobile.getByRole("button", { name: "서비스 추가" }).click();
    const serviceInputs = mobile.getByRole("textbox", { name: "서비스명" });
    await serviceInputs.last().fill("스파 케어");
    await mobile.getByRole("textbox", { name: "상세 항목" }).last().fill("보습 팩");
    await mobile.getByRole("textbox", { name: "기본 가격" }).last().fill("25000");
    await mobile.getByRole("textbox", { name: "예상 시간(분)" }).last().fill("30");
    await mobile.screenshot({ path: path.join(artifactDir, "02-mobile-edited.png"), fullPage: true });

    await mobile.getByRole("button", { name: "이 내용으로 등록" }).click();
    await mobile.getByRole("button", { name: "가입 정보 입력" }).waitFor();
    await mobile.screenshot({ path: path.join(artifactDir, "03-mobile-confirmed.png"), fullPage: true });
    await mobile.getByRole("button", { name: "가입 정보 입력" }).click();
    await mobile.getByText("FIXTURE FLOW COMPLETE").waitFor();
    await mobile.screenshot({ path: path.join(artifactDir, "04-mobile-next-step.png"), fullPage: true });
    await mobile.close();

    const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    await desktop.goto(baseUrl, { waitUntil: "networkidle" });
    await uploadAndWait(desktop);
    await desktop.screenshot({ path: path.join(artifactDir, "05-pc-fixture-analyzed.png"), fullPage: true });
    await desktop.close();
  } finally {
    await browser.close();
  }
})();
