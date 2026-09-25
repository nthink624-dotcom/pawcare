import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readText = (relativePath) => readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
const customerScreen = readText("src/components/owner-web/customer-management-screen.tsx");
const ownerPreview = readText("src/components/owner-web/owner-web-preview.tsx");

test("customer bootstrap emission follows data changes rather than parent callback identity", () => {
  assert.match(customerScreen, /const onDataChangeRef = useRef\(onDataChange\);/);
  assert.match(
    customerScreen,
    /useEffect\(\(\) => \{\s*onDataChangeRef\.current = onDataChange;\s*\}, \[onDataChange\]\);/,
  );
  assert.match(
    customerScreen,
    /useEffect\(\(\) => \{\s*if \(!skippedInitialBootstrapSyncRef\.current\)[\s\S]*?onDataChangeRef\.current\?\.\(bootstrapData\);\s*\}, \[bootstrapData\]\);/,
  );
  assert.doesNotMatch(customerScreen, /\}, \[bootstrapData, onDataChange\]\);/);
});

test("external bootstrap refresh replaces local state before effects can echo stale data", () => {
  assert.match(
    customerScreen,
    /const \[receivedInitialData, setReceivedInitialData\] = useState\(initialData\);/,
  );
  assert.match(
    customerScreen,
    /if \(receivedInitialData !== initialData\) \{\s*setReceivedInitialData\(initialData\);\s*setBootstrapData\(initialData\);\s*\}/,
  );
  assert.doesNotMatch(
    customerScreen,
    /useEffect\(\(\) => \{\s*setBootstrapData\(initialData\);\s*\}, \[initialData\]\);/,
  );
});

test("owner preview keeps SSR initial screen deterministic and applies the URL request after hydration", () => {
  const initialStart = ownerPreview.indexOf("function getInitialOwnerWebScreen");
  const requestedStart = ownerPreview.indexOf("function getRequestedOwnerWebScreen");
  const screenMapStart = ownerPreview.indexOf("const screenBySettingsTab", requestedStart);
  assert.ok(initialStart >= 0 && requestedStart > initialStart && screenMapStart > requestedStart);

  const initialResolver = ownerPreview.slice(initialStart, requestedStart);
  const requestedResolver = ownerPreview.slice(requestedStart, screenMapStart);
  assert.doesNotMatch(initialResolver, /window|URLSearchParams/);
  assert.match(initialResolver, /shouldStartWithPriceGuideSetup\(data\) \? "services" : "schedule"/);
  assert.match(requestedResolver, /new URLSearchParams\(window\.location\.search\)/);
  assert.match(ownerPreview, /useState<OwnerWebScreenKey>\(\(\) => getInitialOwnerWebScreen\(initialData\)\)/);
  assert.match(ownerPreview, /setActiveScreen\(getRequestedOwnerWebScreen\(ownerData\)\);/);
});

const livePreviewUrl = process.env.PETMANAGER_CUSTOMER_RENDER_LOOP_URL;

test(
  "live customer screen tolerates changing parent callbacks and an external data identity refresh",
  { skip: !livePreviewUrl, timeout: 20_000 },
  async () => {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });

    try {
      const page = await browser.newPage({ viewport: { width: 1_024, height: 900 } });
      const runtimeErrors = [];
      page.on("pageerror", (error) => runtimeErrors.push(`pageerror: ${error.message}`));
      page.on("console", (message) => {
        if (message.type() === "error") runtimeErrors.push(`console: ${message.text()}`);
      });

      await page.addInitScript(({ key, staff }) => {
        window.localStorage.setItem(key, JSON.stringify(staff));
      }, {
        key: "petmanager.demo.ownerWeb.staffMembers",
        staff: [{
          id: "render-loop-regression-staff",
          name: "동기화 테스트",
          displayName: "동기화 테스트",
          phone: "010-0000-0000",
          role: "디자이너",
          position: "디자이너",
          defaultDays: ["mon", "tue", "wed", "thu", "fri"],
          startTime: "10:00",
          endTime: "19:00",
          regularOff: "토, 일",
          annualRemain: 0,
          todayBookings: 0,
          weekBookings: 0,
        }],
      });

      await page.goto(livePreviewUrl, { waitUntil: "domcontentloaded" });
      const screenRoot = page.locator('[data-owner-screen-root="customers"]');
      await screenRoot.waitFor();

      const accountMenu = page.getByRole("button", { name: /운영 계정/ });
      for (let index = 0; index < 12; index += 1) {
        await accountMenu.click();
      }

      await page.getByRole("button", { name: /김민지/ }).first().click();
      await page.getByRole("heading", { name: /김민지 · 몽이/ }).waitFor();
      await page.getByRole("button", { name: "닫기" }).click();
      await page.waitForTimeout(500);

      assert.equal(await screenRoot.getAttribute("data-owner-screen-root"), "customers");
      assert.deepEqual(runtimeErrors, []);
    } finally {
      await browser.close();
    }
  },
);
