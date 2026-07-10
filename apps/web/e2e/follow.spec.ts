import { test, expect } from "@playwright/test";
import { login, logout, signup } from "./helpers/account";
import { fillPostContent } from "./helpers/post-content";

test.describe.configure({ mode: "serial" });

test("팔로우·추천·팔로잉 피드·목록·알림이 동작한다", async ({ page }) => {
  const author = await signup(page, "e2e-follow-author");
  const postText = `팔로우테스트 ${Date.now()}`;

  await page.goto("/posts/new");
  await fillPostContent(page, postText);
  await page.getByRole("button", { name: "게시하기" }).click();
  await page.waitForURL("**/feed");

  const profileHref = await page.getByRole("link", { name: author.nickname }).first().getAttribute("href");
  expect(profileHref).toMatch(/\/users\/\d+/);

  await logout(page);

  const follower = await signup(page, "e2e-follow-viewer");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/feed");
  await expect(page.getByRole("heading", { name: "이런 분 어때요" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("link", { name: author.nickname })).toBeVisible();

  await page.goto(profileHref!);
  await page.getByRole("button", { name: "팔로우" }).click();
  await expect(page.getByRole("button", { name: "팔로잉" })).toBeVisible();

  await page.goto("/feed");
  await page.getByLabel("팔로잉만").click();
  await expect(page).toHaveURL(/followingOnly=true/);
  await expect(page.getByText(postText).first()).toBeVisible({ timeout: 15_000 });

  await page.goto("/mypage/following");
  await expect(page.getByRole("link", { name: author.nickname })).toBeVisible();

  await logout(page);
  await login(page, author);
  await page.goto("/notifications");
  await expect(page.getByRole("link", { name: /새 팔로워/ })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(follower.nickname).first()).toBeVisible();
});

test("차단한 사용자를 마이페이지 차단 목록에서 확인하고 해제할 수 있다", async ({ page }) => {
  const target = await signup(page, "e2e-block-target");

  // 대상 사용자의 프로필 URL 확보(작성 글 작성자 링크 경유)
  await page.goto("/posts/new");
  await fillPostContent(page, `차단테스트 대상 글 ${Date.now()}`);
  await page.getByRole("button", { name: "게시하기" }).click();
  await page.waitForURL("**/feed");
  const profileHref = await page.getByRole("link", { name: target.nickname }).first().getAttribute("href");
  expect(profileHref).toMatch(/\/users\/\d+/);
  await logout(page);

  // 차단하는 사용자
  await signup(page, "e2e-blocker");
  await page.goto(profileHref!);
  await page.getByRole("button", { name: "차단", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "차단", exact: true }).click();
  await expect(page.getByRole("button", { name: "차단 해제" })).toBeVisible();

  // 차단 목록에서 확인 → 해제 → 빈 상태
  await page.goto("/mypage/blocked");
  await expect(page.getByRole("heading", { name: "차단 사용자" })).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(target.nickname) })).toBeVisible();
  await page.getByRole("button", { name: `${target.nickname} 차단 해제`, exact: true }).click();
  await expect(page.getByText("차단한 사용자가 없어요.")).toBeVisible();
});
