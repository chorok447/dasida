import { test, expect, type Page } from "@playwright/test";

/**
 * 인증·캠페인 시나리오: httpOnly 쿠키 인증 전환(#202) 이후의 회귀 가드.
 * - 로그아웃이 쿠키를 만료시키고, 재로그인이 새 쿠키로 동작하는지
 * - 쿠키 인증으로 캠페인 개설 → 모집 시작 → 참여 → 취소가 이어지는지
 */

type Account = { email: string; password: string; nickname: string };

async function signup(page: Page): Promise<Account> {
  const stamp = Date.now();
  const account = {
    email: `e2e-auth-${stamp}@example.com`,
    password: "Passw0rd!", // 영문+숫자+특수문자, 8~15자
    nickname: `이투이${stamp % 100000}`,
  };
  await page.goto("/signup");
  await page.getByLabel("이메일").fill(account.email);
  await page.getByLabel("비밀번호", { exact: true }).fill(account.password);
  await page.getByLabel("비밀번호 확인").fill(account.password);
  await page.getByLabel("이름").fill("이투이");
  await page.getByLabel("닉네임").fill(account.nickname);
  await page.getByRole("button", { name: "회원가입" }).click();
  await page.waitForURL("**/feed");
  return account;
}

/** LocalDate(yyyy-MM-dd). 오프셋은 일 단위. */
function dateAfter(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

test("로그아웃하면 세션이 끊기고 재로그인하면 복구된다", async ({ page }) => {
  const account = await signup(page);
  await expect(page.getByRole("button", { name: "로그아웃" })).toBeVisible();

  // 로그아웃 → 비로그인 헤더
  await page.getByRole("button", { name: "로그아웃" }).click();
  await expect(page.getByRole("link", { name: "로그인", exact: true })).toBeVisible();

  // 인증 쿠키가 만료됐어야 한다 — 마이페이지가 비로그인 안내를 보여야 함
  await page.goto("/mypage");
  await expect(page.getByText("마이페이지를 보려면 로그인이 필요합니다.")).toBeVisible();

  // 재로그인. 헤더 링크로 이동해 hydration 완료 후 입력한다
  // (goto 직후 fill 은 controlled input 의 React 상태 반영 전이라 빈 값으로 제출될 수 있다).
  // "이메일 기억하기" 체크박스와 구분하려면 exact 필요.
  await page.getByRole("link", { name: "로그인", exact: true }).click();
  await page.waitForURL("**/login");
  await page.getByLabel("이메일", { exact: true }).fill(account.email);
  await page.getByLabel("비밀번호", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await page.waitForURL("**/feed");
  await expect(page.getByRole("button", { name: "로그아웃" })).toBeVisible();

  // 새 쿠키로 사용자별 페이지 접근
  await page.goto("/mypage");
  await expect(page.getByText(account.nickname).first()).toBeVisible();
});

test("캠페인을 개설해 모집을 시작하면 참여와 취소가 된다", async ({ page }) => {
  // 모집 시작·참여 취소는 window.confirm 을 띄운다 — 기본 동작(dismiss)이면 진행이 안 되므로 수락.
  page.on("dialog", (dialog) => void dialog.accept());
  await signup(page);

  // 개설 — 템플릿으로 필수 텍스트를 채우고, 날짜는 오늘 기준으로 참여 가능하게 지정
  await page.goto("/campaigns/new");
  await page.getByRole("button", { name: /템플릿 적용/ }).first().click();
  await page.getByLabel("모집 시작일").fill(dateAfter(0));
  await page.getByLabel("모집 종료일").fill(dateAfter(7));
  await page.getByLabel("진행 시작일").fill(dateAfter(8));
  await page.getByLabel("진행 종료일").fill(dateAfter(14));
  await page.getByRole("button", { name: "캠페인 등록" }).click();
  await page.waitForURL("**/campaigns/c-*");

  // 신규 캠페인은 upcoming → 개설자가 모집을 시작해야 참여 가능
  await page.getByRole("button", { name: "모집 시작" }).click();

  // 참여
  await page.getByRole("button", { name: "캠페인 참여하기" }).click();
  await expect(page.getByText("참여 완료 · 모집 중인 캠페인입니다")).toBeVisible();

  // 취소
  await page.getByRole("button", { name: "참여 취소", exact: true }).click();
  await expect(page.getByRole("button", { name: "캠페인 참여하기" })).toBeVisible();
});
