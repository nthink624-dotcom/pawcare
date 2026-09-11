import { expect, test } from "@playwright/test";
import axe from "axe-core";

test.use({ viewport: { width: 1440, height: 1000 } });

test("예약 상세는 포커스 수명주기와 44px·대비 기준을 지킨다", async ({ page }) => {
  const ownerDebugMessages: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("[OWNER DEBUG]")) ownerDebugMessages.push(message.text());
  });

  await page.goto("/demo/owner-web", { waitUntil: "networkidle" });
  const trigger = page.locator('[data-booking-id="a-6"]');
  await expect(trigger).toBeVisible();
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: "예약 상세" });
  const closeButton = page.getByRole("button", { name: "예약 상세 닫기" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveJSProperty("tagName", "DIV");
  await expect(closeButton).toBeFocused();

  const smallTargets = await dialog
    .locator('a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])')
    .evaluateAll((elements) =>
      elements.flatMap((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        if (rect.width === 0 || rect.height === 0 || style.display === "none" || style.visibility === "hidden") return [];
        if (rect.width >= 44 && rect.height >= 44) return [];
        return [{
          label: element.getAttribute("aria-label") || element.textContent?.trim() || element.tagName,
          width: rect.width,
          height: rect.height,
        }];
      }),
    );
  expect(smallTargets).toEqual([]);

  await expect(page.getByText("고객 요청사항이 없습니다.", { exact: true })).toHaveCSS("color", "rgb(100, 116, 139)");
  await expect(page.getByText("공유 코멘트가 없습니다.", { exact: true })).toHaveCSS("color", "rgb(100, 116, 139)");
  await expect(page.getByRole("button", { name: "미용 시작하기" })).toHaveCSS("background-color", "rgb(14, 101, 216)");

  await page.addScriptTag({ content: axe.source });
  const axeViolations = await dialog.evaluate(async (element) => {
    const axeInstance = (window as typeof window & { axe: typeof axe }).axe;
    const results = await axeInstance.run(element);
    return results.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      targets: violation.nodes.flatMap((node) => node.target),
    }));
  });
  expect(axeViolations).toEqual([]);

  await page.mouse.click(500, 500);
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();

  await trigger.click();
  await expect(dialog).toBeVisible();
  await expect(closeButton).toBeFocused();

  await closeButton.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "예약 취소" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(closeButton).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-booking-id="a-6"]')).toBeVisible();
  expect(ownerDebugMessages).toEqual([]);
});

test("1024px overlay 배경 pointer 닫기는 예약 trigger로 포커스를 복귀시킨다", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/demo/owner-web", { waitUntil: "networkidle" });

  const trigger = page.locator('[data-booking-id="a-6"]');
  await expect(trigger).toBeVisible();
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: "예약 상세" });
  await expect(dialog).toBeVisible();
  await page.mouse.click(24, 450);

  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
