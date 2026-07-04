import { test, expect } from "@playwright/test";

/** 피드 URL canonical 정규화 — useCanonicalUrl + buildFeedHref 회귀 가드. */
test("피드 진입 시 URL이 canonical 형태로 정규화된다", async ({ page }) => {
  await page.goto("/feed");
  await page.waitForURL(/\/feed\?sort=latest&page=0$/);
});

test("잘못된 page 파라미터를 canonical URL로 교정한다", async ({ page }) => {
  await page.goto("/feed?page=-1&sort=popular");
  await page.waitForURL(/\/feed\?sort=popular&page=0$/);
});

/** 공개 상세 페이지 스모크 — PageShell 마이그레이션 후 렌더 회귀 가드. */
test("시드 게시글 상세를 열 수 있다", async ({ page }) => {
  await page.goto("/posts/p1");

  await expect(page.getByRole("button", { name: "피드로 돌아가기" })).toBeVisible();
  await expect(page.getByText("낡은 청바지 두 벌로 토트백 한 개").first()).toBeVisible();
});

test("시드 캠페인 상세를 열 수 있다", async ({ page }) => {
  await page.goto("/campaigns/c1");

  await expect(page.getByRole("heading", { name: "강아지를 위한 업사이클링 댕교복" })).toBeVisible();
  await expect(page.getByRole("button", { name: "캠페인 목록" })).toBeVisible();
});
