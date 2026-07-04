import { test, expect } from "@playwright/test";

/**
 * 핵심 경로 스모크: 회원가입 → 글 작성 → 피드 노출 → 로그인 상태로 직접 진입.
 * 마지막 단계는 hydration 첫 렌더에서 비로그인 UI로 튕기던 회귀(#197, #198)의 가드다.
 */
test("회원가입 후 글을 작성하면 피드에 보인다", async ({ page }) => {
  const stamp = Date.now();
  const email = `e2e-${stamp}@example.com`;
  const nickname = `이투이${stamp % 100000}`;
  const password = "Passw0rd!"; // 영문+숫자+특수문자, 8~15자

  // 회원가입
  await page.goto("/signup");
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.getByLabel("비밀번호 확인").fill(password);
  await page.getByLabel("이름").fill("이투이");
  await page.getByLabel("닉네임").fill(nickname);
  await page.getByRole("button", { name: "회원가입" }).click();
  await page.waitForURL("**/feed");

  // 헤더에 로그인 상태 반영
  await expect(page.getByRole("button", { name: "로그아웃" })).toBeVisible();

  // 글 작성
  const text = `E2E 스모크 게시글 ${stamp}`;
  await page.goto("/posts/new");
  await page.getByLabel(/내용/).fill(text);
  await page.getByRole("button", { name: "게시하기" }).click();
  await page.waitForURL("**/feed");
  await expect(page.getByText(text).first()).toBeVisible();

  // 로그인 상태로 마이페이지 직접 진입 — 비로그인 안내가 뜨면 hydration 회귀
  await page.goto("/mypage");
  await expect(page.getByText(nickname).first()).toBeVisible();
  await expect(page.getByText("마이페이지를 보려면 로그인이 필요합니다.")).toHaveCount(0);
});
