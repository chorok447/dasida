import { test, expect } from "@playwright/test";

/** 모바일 viewport에서 하단 탭 내비가 핵심 페이지로 이동하는지 확인한다. */
test("모바일 하단 탭으로 피드와 캠페인에 이동할 수 있다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await page.getByRole("navigation", { name: "주요 메뉴" }).getByRole("link", { name: "피드" }).click();
  await page.waitForURL("**/feed");
  await expect(page).toHaveURL(/\/feed/);

  await page.getByRole("navigation", { name: "주요 메뉴" }).getByRole("link", { name: "캠페인" }).click();
  await page.waitForURL("**/campaigns");
  await expect(page).toHaveURL(/\/campaigns/);
});
