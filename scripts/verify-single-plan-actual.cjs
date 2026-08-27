const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("@playwright/test");

const baseUrl = "http://127.0.0.1:3000";
const outputDir = path.join(process.cwd(), "artifacts", "screenshots", "single-plan-p0");
const forbiddenCopy = [
  "19,000",
  "79,000",
  "500건",
  "1,500건",
  "5,000건",
  "11원",
  "추가 이용권 구매",
  "추가 발송 이용권 구매",
  "직원 무제한",
  "다매장 포함",
  "1매장 제한",
];

const canonicalPlan = {
  code: "quarterly",
  name: "펫매니저 단일 요금제",
  title: "펫매니저 단일 요금제",
  shortTitle: "펫매니저 단일 요금제",
  months: 1,
  price: 29000,
  totalPrice: 29000,
  monthlyPrice: 29000,
  monthlyEquivalent: 29000,
  billingType: "subscription",
  billingLabel: "월 정기결제",
  totalLabel: "월 29,000원",
  description: "펫매니저 핵심 운영 기능과 알림톡이 포함됩니다. 별도 충전이나 건별 추가 결제는 없습니다.",
  discountPercent: 0,
  staffLimitLabel: "핵심 운영 기능 포함",
  alimtalkIncludedLabel: "알림톡 포함 · 별도 충전 없음",
  excessAlimtalkLabel: "기존 계약 기준",
  targetLabel: "카드 없이 14일 체험",
  highlights: ["카드 없이 14일 체험", "핵심 운영 기능 포함", "알림톡 포함 · 별도 충전 없음"],
};

const trialPlan = {
  ...canonicalPlan,
  code: "free",
  name: "체험 플랜",
  title: "체험 플랜",
  shortTitle: "체험 플랜",
  months: 0,
  price: 0,
  totalPrice: 0,
  monthlyPrice: 0,
  monthlyEquivalent: 0,
  billingType: "one_time",
  billingLabel: "관리자 배정 체험 플랜",
};

const summary = {
  userId: "fixture-owner-ref",
  shopId: "fixture-shop-ref",
  status: "trialing",
  currentPlanCode: "free",
  currentPlan: trialPlan,
  billingCycle: "0m",
  trialStartedAt: "2026-08-20T00:00:00.000Z",
  trialEndsAt: "2026-09-03T00:00:00.000Z",
  nextBillingAt: null,
  paymentMethodExists: false,
  paymentMethodLabel: null,
  paymentMethodResetRequired: false,
  paymentMethodProblemCode: null,
  autoRenewEnabled: false,
  autoRenewPlanCode: "quarterly",
  autoRenewPlan: canonicalPlan,
  featuredPlanCode: "quarterly",
  noticeLevel: "none",
  daysUntilTrialEnds: 7,
  cancelAtPeriodEnd: false,
  lastPaymentStatus: "none",
  lastPaymentAt: null,
  lastPaymentFailedAt: null,
  lastPaymentId: null,
  currentPeriodStartedAt: null,
  currentPeriodEndsAt: null,
  ownerName: null,
  ownerPhoneNumber: null,
  ownerEmail: null,
  billingAmount: {
    planCode: "quarterly",
    planName: "펫매니저 단일 요금제",
    baseMonthlyAmount: 29000,
    monthlyTotalAmount: 29000,
    multiShopDiscount: {
      totalShopCount: 1,
      perShopListMonthlyPrice: 29000,
      discountRate: 0,
      discountPercent: 0,
      subtotalBeforeDiscount: 29000,
      discountAmount: 0,
      finalMonthlyAmount: 29000,
      policyLabel: "매장 수 과금 정책 미확정",
      appliedLabel: "단일 요금제 월 금액만 적용",
    },
  },
};

function fakeJwt() {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
  return `fixture.${payload}.signature`;
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];

  try {
    for (const viewport of [
      { name: "1440", width: 1440, height: 900 },
      { name: "1024", width: 1024, height: 768 },
      { name: "390", width: 390, height: 844 },
    ]) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const consoleErrors = [];
      const pageErrors = [];
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });
      page.on("pageerror", (error) => pageErrors.push(error.message));

      await page.addInitScript(({ token, fixture }) => {
        const expiresAt = Date.now() + 60 * 60 * 1000;
        window.localStorage.setItem(
          "petmanager.ownerAuthTokenCache",
          JSON.stringify({ accessToken: token, refreshToken: "fixture-refresh", expiresAt }),
        );
        window.sessionStorage.setItem(
          "owner-billing:summary-cache",
          JSON.stringify({ cachedAt: Date.now(), summary: fixture }),
        );
      }, { token: fakeJwt(), fixture: summary });

      await page.route("**/api/subscription", async (route) => {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(summary) });
      });

      const url = `${baseUrl}/owner/billing?compare=1&plan=quarterly`;
      await page.goto(url, { waitUntil: "networkidle" });
      await page.getByRole("heading", { name: "펫매니저 단일 요금제" }).first().waitFor();
      const text = await page.locator("body").innerText();
      const cardCount = await page.locator("article").filter({ hasText: "펫매니저 단일 요금제" }).count();
      const dimensions = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollHeight: document.documentElement.scrollHeight,
        clientHeight: document.documentElement.clientHeight,
      }));
      const screenshot = path.join(outputDir, `owner-billing-${viewport.name}.png`);
      await page.screenshot({ path: screenshot, fullPage: false });

      results.push({
        viewport,
        url,
        source: "local_fixture",
        screenshot,
        billablePlanVisibleCount: cardCount,
        monthlyPriceVisible: text.includes("29,000"),
        includedCopyVisible: text.includes("별도 충전이나 건별 추가 결제는 없습니다"),
        limitationCopyVisible: text.includes("비정상·오남용 발송에는 제한될 수 있습니다"),
        forbiddenCopy: forbiddenCopy.filter((value) => text.includes(value)),
        dimensions,
        horizontalOverflow: Math.max(0, dimensions.scrollWidth - dimensions.clientWidth),
        consoleErrors,
        pageErrors,
      });

      await context.close();
    }
  } finally {
    await browser.close();
  }

  const reportPath = path.join(outputDir, "report.json");
  fs.writeFileSync(reportPath, JSON.stringify({ capturedAt: new Date().toISOString(), results }, null, 2));

  for (const result of results) {
    if (
      result.billablePlanVisibleCount !== 1 ||
      !result.monthlyPriceVisible ||
      !result.includedCopyVisible ||
      !result.limitationCopyVisible ||
      result.forbiddenCopy.length > 0 ||
      result.horizontalOverflow !== 0 ||
      result.consoleErrors.length > 0 ||
      result.pageErrors.length > 0
    ) {
      throw new Error(`actual verification failed: ${JSON.stringify(result)}`);
    }
  }

  process.stdout.write(`${reportPath}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
