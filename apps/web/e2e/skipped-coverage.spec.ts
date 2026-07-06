import { test, expect } from "@playwright/test";
import { signup } from "./helpers/account";
import { dateAfter, TINY_PNG } from "./helpers/dates";
import { fillPostContent } from "./helpers/post-content";

// signup·업로드가 연속이라 파일 내 serial (로컬 multi-worker 시)
test.describe.configure({ mode: "serial" });

test("캠페인 썸네일을 파일로 업로드해 등록할 수 있다", async ({ page }) => {
  await signup(page, "e2e-camp-thumb");
  const title = `썸네일업로드 ${Date.now()}`;

  await page.goto("/campaigns/new");
  await page.getByLabel("제목").fill(title);
  await page.getByLabel("모집 시작일").fill(dateAfter(0));
  await page.getByLabel("모집 종료일").fill(dateAfter(7));
  await page.getByLabel("진행 시작일").fill(dateAfter(8));
  await page.getByLabel("진행 종료일").fill(dateAfter(14));
  await page.getByLabel("모집 인원").fill("10");

  await page.locator('input[type="file"]').first().setInputFiles(TINY_PNG);
  await expect(page.getByLabel("추가된 썸네일 목록")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "캠페인 등록" }).click();
  await page.waitForURL("**/campaigns/c-*");
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
});

test("프로필 이미지를 파일로 업로드해 저장할 수 있다", async ({ page }) => {
  const account = await signup(page, "e2e-prof-upload");

  await page.goto("/profile/edit");
  await page.getByRole("button", { name: "파일 업로드" }).click();
  await page.locator('input[type="file"]').last().setInputFiles(TINY_PNG);
  await expect(page.getByAltText(`${account.nickname} 프로필 이미지 미리보기`)).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "저장하기" }).click();
  await page.waitForURL("**/mypage");
  await expect(page.locator(`img[alt="${account.nickname} 프로필 이미지"]`).first()).toBeVisible();
});

test("피드 작성자 링크로 공개 프로필을 볼 수 있다", async ({ page }) => {
  const account = await signup(page, "e2e-public");
  const text = `공개프로필 ${Date.now()}`;

  await page.goto("/posts/new");
  await fillPostContent(page, text);
  await page.getByRole("button", { name: "게시하기" }).click();
  await page.waitForURL("**/feed");

  await page.getByRole("link", { name: account.nickname }).first().click();
  await page.waitForURL("**/users/*");
  await expect(page.getByRole("heading", { name: account.nickname })).toBeVisible();
  await expect(page.getByText("작성한 게시글")).toBeVisible();
  await expect(page.getByText(text).first()).toBeVisible();
});

test("리치 에디터 굵게·미리보기가 동작한다", async ({ page }) => {
  await signup(page, "e2e-rich");
  const word = `굵게${Date.now() % 100000}`;

  await page.goto("/posts/new");
  const editor = page.locator(".tiptap-editor").first();
  await editor.click();
  await page.getByRole("button", { name: "굵게" }).click();
  await page.keyboard.type(word);
  await page.getByRole("tab", { name: "미리보기" }).click();
  await expect(page.locator("strong", { hasText: word })).toBeVisible();
});

test("시드 캠페인 상세에 본문 이미지 그리드가 보인다", async ({ page }) => {
  await page.goto("/campaigns/c1");
  await expect(page.getByRole("heading", { name: "강아지를 위한 업사이클링 댕교복" })).toBeVisible();
  await expect(page.getByAltText("캠페인 상세 이미지 1")).toBeVisible();
});
