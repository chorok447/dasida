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
});

test("캠페인 탭과 정렬이 URL에 반영된다", async ({ page }) => {
  await page.goto("/search");

  await page.getByRole("button", { name: "캠페인", exact: true }).click();
  await page.waitForURL(/type=campaigns/);

  await page.locator("select").first().selectOption("popular");
  await page.waitForURL(/sort=popular/);
});

test("게시글 탭 검색 URL의 page가 canonical 형태로 정규화된다", async ({ page }) => {
  await page.goto("/search?type=posts&page=-1&sort=latest");
  await page.waitForURL(/\/search\?type=posts&sort=latest&page=0$/);
});

test("게시글 탭에서 page 변경이 URL에 반영된다", async ({ page }) => {
  await page.goto("/search?type=posts");
  await page.waitForURL(/type=posts/);

  await page.goto("/search?type=posts&page=1&sort=latest");
  await page.waitForURL(/\/search\?type=posts&sort=latest&page=1$/);
});
