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
  // 좋아요 버튼 접근성 이름 회귀 가드 — 아이콘+숫자만으로 이름이 비지 않게 한다.
  await expect(page.getByRole("button", { name: "게시글 좋아요", exact: true })).toBeVisible();
  // 구조화 데이터(JSON-LD) 회귀 가드
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
});

test("게시글 상세 이미지 클릭 시 라이트박스가 열리고 Escape로 닫힌다", async ({ page }) => {
  await page.goto("/posts/p1");

  await page.getByRole("button", { name: "게시글 이미지 1 크게 보기", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "이미지 크게 보기" });
  await expect(dialog).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});

test("시드 캠페인 상세를 열 수 있다", async ({ page }) => {
  await page.goto("/campaigns/c1");

  await expect(page.getByRole("heading", { name: "강아지를 위한 업사이클링 댕교복" })).toBeVisible();
  await expect(page.getByRole("button", { name: "캠페인 목록" })).toBeVisible();
});

test("캠페인 목록 URL이 canonical 형태로 정규화된다", async ({ page }) => {
  await page.goto("/campaigns?page=-1&sort=popular");
  await page.waitForURL(/\/campaigns\?sort=popular&page=0$/);
});

test("캠페인 목록 정렬이 URL에 반영된다", async ({ page }) => {
  await page.goto("/campaigns");

  await page.locator("select").filter({ has: page.locator('option[value="popular"]') }).selectOption("popular");
  await page.waitForURL(/sort=popular/);
});

test("피드 조회순 정렬이 URL에 반영된다", async ({ page }) => {
  await page.goto("/feed");

  await page.locator("select").filter({ has: page.locator('option[value="views"]') }).selectOption("views");
  await page.waitForURL(/sort=views/);
});
