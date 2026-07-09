import { test, expect } from "@playwright/test";
import { signup } from "./helpers/account";
import { fillPostContent } from "./helpers/post-content";

test.describe("비로그인 접근", () => {
  test("글 작성 페이지는 로그인으로 보낸다", async ({ page }) => {
    await page.goto("/posts/new");
    await page.waitForURL(/\/login\?next=.*\/posts\/new/);
  });

  test("캠페인 개설 페이지는 로그인으로 보낸다", async ({ page }) => {
    await page.goto("/campaigns/new");
    // middleware 가 복귀 경로(next)를 보존한 채 로그인으로 보낸다.
    await page.waitForURL(/\/login\?next=.*\/campaigns\/new/);
  });

  test("프로필 편집은 로그인 안내를 보여준다", async ({ page }) => {
    await page.goto("/profile/edit");
    await expect(page.getByText("프로필을 수정하려면 로그인이 필요합니다.")).toBeVisible();
  });
});

test("프로필 표시 이름을 변경하면 마이페이지에 반영된다", async ({ page }) => {
  await signup(page, "e2e-profile");
  const newName = `E2E프로필${Date.now() % 100000}`;

  await page.goto("/profile/edit");
  await expect(page.getByRole("heading", { name: "프로필 편집" })).toBeVisible();

  await page.getByLabel("표시 이름").fill(newName);
  await page.getByRole("button", { name: "저장하기" }).click();
  await page.waitForURL("**/mypage");

  await expect(page.getByText(newName).first()).toBeVisible();
});

test("프로필 이미지를 등록하면 기존 글의 피드 아바타에 반영된다", async ({ page }) => {
  const account = await signup(page, "e2e-avatar");

  // 프로필 이미지 등록 전에 글을 먼저 작성 — 기존 작성물 snapshot 전파를 검증한다
  const text = `아바타 전파 확인 ${Date.now()}`;
  await page.goto("/posts/new");
  await fillPostContent(page, text);
  await page.getByRole("button", { name: "게시하기" }).click();
  await page.waitForURL("**/feed");

  // 실제 로드 가능한 URL 이어야 한다(onError 시 기본 아바타로 떨어짐) — 앱 자신의 favicon 사용.
  // 포트 파라미터화(E2E_WEB_PORT) 대응: 하드코딩 대신 현재 오리진에서 만든다.
  await page.goto("/profile/edit");
  const origin = await page.evaluate(() => window.location.origin);
  await page.getByLabel("프로필 이미지").fill(`${origin}/favicon.ico`);
  await page.getByRole("button", { name: "저장하기" }).click();
  await page.waitForURL("**/mypage");

  await page.goto("/feed");
  await expect(page.getByText(text).first()).toBeVisible();
  await expect(page.locator(`img[alt="${account.nickname} 프로필 이미지"]`).first()).toBeVisible();
});

test("작성한 글을 편집하면 상세에 반영된다", async ({ page }) => {
  const stamp = Date.now();
  await signup(page, "e2e-edit");
  const original = `E2E 원본 ${stamp}`;
  const updated = `E2E 수정 ${stamp}`;

  await page.goto("/posts/new");
  await expect(page.getByRole("heading", { name: "새 글 쓰기" })).toBeVisible();
  await fillPostContent(page, original);
  await page.getByRole("button", { name: "게시하기" }).click();
  await page.waitForURL("**/feed");

  await page.goto("/mypage");
  await page.getByRole("link", { name: "편집", exact: true }).first().click();
  await page.waitForURL(/\/posts\/[^/]+\/edit$/);
  await expect(page.getByRole("heading", { name: "글 수정" })).toBeVisible();

  await fillPostContent(page, updated);
  await page.getByRole("button", { name: "저장하기" }).click();
  await page.waitForURL(/\/posts\/[^/]+$/);

  await expect(page.getByText(updated).first()).toBeVisible();
});

test("캠페인 개설 페이지가 로그인 후 표시된다", async ({ page }) => {
  await signup(page, "e2e-campaign-page");

  await page.goto("/campaigns/new");
  await expect(page.getByRole("heading", { name: "새 캠페인 개설" })).toBeVisible();
  await expect(page.getByRole("button", { name: /템플릿 적용/ }).first()).toBeVisible();
});
