import { test, expect } from "@playwright/test";

/** 통합 검색 페이지 스모크: 진입, 검색어 입력, URL·제목 반영. */
test("검색 페이지에서 검색어를 입력하면 결과 화면으로 전환된다", async ({ page }) => {
  await page.goto("/search");

  await expect(page.getByRole("heading", { name: "전체 탐색" })).toBeVisible();

  const searchInput = page.getByRole("textbox", { name: "통합 검색" });
  await expect(searchInput).toBeVisible();

  const query = "업사이클";
  await searchInput.fill(query);
  await searchInput.press("Enter");

  await page.waitForURL(`**/search?q=${encodeURIComponent(query)}**`);
  await expect(page.getByRole("heading", { name: new RegExp(`${query}.*검색 결과`) })).toBeVisible();
  await expect(page.getByText(/검색 결과/)).toBeVisible();
});
