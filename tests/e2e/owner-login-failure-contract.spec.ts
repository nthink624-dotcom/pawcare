import { expect, test } from "@playwright/test";

const genericCredentialsMessage = "아이디 또는 비밀번호를 확인해 주세요.";

test("unknown owner credentials render one generic, recoverable failure", async ({ page }) => {
  let loginRequestCount = 0;

  await page.route("**/api/auth/login", async (route) => {
    loginRequestCount += 1;
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ reason: "invalid_credentials", message: genericCredentialsMessage }),
    });
  });

  await page.goto("/login");
  await page.getByTestId("owner-login-email").fill("owner-login-fixture@example.invalid");
  await page.getByTestId("owner-login-password").fill("invalid-password");
  await page.getByTestId("owner-login-submit").click();

  const loginError = page.getByText(genericCredentialsMessage, { exact: true });
  await expect(loginError).toHaveAttribute("role", "alert");
  await expect(page.getByText("등록되지 않은 이메일", { exact: false })).toHaveCount(0);
  await expect(page.getByTestId("owner-login-submit")).toBeEnabled();
  expect(loginRequestCount).toBe(1);
});

test("delayed owner auth response keeps one request and restores retry controls at the timeout", async ({ page }) => {
  let loginRequestCount = 0;

  await page.route("**/api/auth/login", async (route) => {
    loginRequestCount += 1;
    await new Promise((resolve) => setTimeout(resolve, 11_000));
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "ignored after client timeout" }),
    }).catch(() => undefined);
  });

  await page.goto("/login");
  await page.getByTestId("owner-login-email").fill("owner-login-delay-fixture@example.invalid");
  await page.getByTestId("owner-login-password").fill("invalid-password");
  await page.getByTestId("owner-login-submit").click();

  await expect(page.getByTestId("owner-login-submit")).toHaveText("로그인 중...");
  await expect(page.getByText("로그인 서버 응답이 늦어 요청을 중단했어요. 잠시 후 다시 시도해 주세요.")).toBeVisible({ timeout: 12_000 });
  await expect(page.getByTestId("owner-login-submit")).toBeEnabled();
  expect(loginRequestCount).toBe(1);
});

test("password recovery bounds its email check and does not let a late response replace the retry state", async ({ page }) => {
  let emailCheckRequestCount = 0;

  await page.route("**/api/auth/check-email?*", async (route) => {
    emailCheckRequestCount += 1;
    await new Promise((resolve) => setTimeout(resolve, 11_000));
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "ignored after client timeout" }),
    }).catch(() => undefined);
  });

  await page.goto("/login/reset");
  await page.getByLabel("이메일").fill("reset-delay-fixture@example.invalid");
  await page.getByRole("button", { name: "다음" }).dblclick();

  await expect(page.getByRole("button", { name: "확인 중..." })).toBeVisible();
  const timeoutMessage = "본인인증 확인 시간이 길어 요청을 중단했어요. 다시 시도해 주세요.";
  await expect(page.getByText(timeoutMessage)).toBeVisible({ timeout: 12_000 });
  await expect(page.getByRole("button", { name: "다음" })).toBeEnabled();
  await page.waitForTimeout(1_250);
  await expect(page.getByText(timeoutMessage)).toBeVisible();
  expect(emailCheckRequestCount).toBe(1);
});

test("owner login keeps its sole action visible at supported widths", async ({ browser }) => {
  for (const width of [1440, 1024, 430, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    let loginRequestCount = 0;
    await page.route("**/api/auth/login", async (route) => {
      loginRequestCount += 1;
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ reason: "invalid_credentials", message: genericCredentialsMessage }),
      });
    });
    await page.goto("/login");
    await page.getByTestId("owner-login-email").fill("owner-login-width-fixture@example.invalid");
    await page.getByTestId("owner-login-password").fill("invalid-password");
    await page.getByTestId("owner-login-submit").click();

    const loginError = page.getByText(genericCredentialsMessage, { exact: true });
    await expect(loginError).toHaveAttribute("role", "alert");
    await expect(page.getByTestId("owner-login-submit")).toBeEnabled();
    await expect(page.getByTestId("owner-login-email")).not.toHaveValue("");
    await expect(page.getByTestId("owner-login-password")).not.toHaveValue("");

    const actionBox = await page.getByTestId("owner-login-submit").boundingBox();
    const layout = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
    }));

    expect(actionBox?.height).toBeGreaterThanOrEqual(44);
    expect(loginRequestCount).toBe(1);
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.bodyWidth).toBeLessThanOrEqual(layout.viewportWidth);
    await context.close();
  }
});
