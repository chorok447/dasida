import { test, expect } from "@playwright/test";
import { signup } from "./helpers/account";

test.describe("비로그인 접근", () => {
  test("글 작성 페이지는 로그인으로 보낸다", async ({ page }) => {
    await page.goto("/posts/new");
    await page.waitForURL(/\/login\?next=.*\/posts\/new/);
  });

  test("캠페인 개설 페이지는 로그인으로 보낸다", async ({ page }) => {
    await page.goto("/campaigns/new");
    await page.waitForURL("**/login");
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

test("작성한 글을 편집하면 상세에 반영된다", async ({ page }) => {
  const stamp = Date.now();
  await signup(page, "e2e-edit");
  const original = `E2E 원본 ${stamp}`;
  const updated = `E2E 수정 ${stamp}`;

  await page.goto("/posts/new");
  await expect(page.getByRole("heading", { name: "새 글 쓰기" })).toBeVisible();
  await page.getByLabel(/내용/).fill(original);
  await page.getByRole("button", { name: "게시하기" }).click();
  await page.waitForURL("**/feed");

  await page.goto("/mypage");
  await page.getByRole("link", { name: "편집", exact: true }).first().click();
  await page.waitForURL(/\/posts\/[^/]+\/edit$/);
  await expect(page.getByRole("heading", { name: "글 수정" })).toBeVisible();

  await page.getByLabel(/내용/).fill(updated);
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
