import { test, expect, type Page } from "@playwright/test";
import { signup } from "./helpers/account";

const ADMIN_EMAIL = "admin@dasida.local";
const ADMIN_PASSWORD = "E2eAdminPass!"; // playwright.config.ts 의 --app.admin.password 시드

// signup·관리자 로그인이 연속이라 파일 내 serial (로컬 multi-worker 시)
test.describe.configure({ mode: "serial" });

/** 관리자 로그인을 시도한다. 시드가 없는 서버(재사용 dev 서버)면 false 를 반환한다. */
async function loginAsAdmin(page: Page): Promise<boolean> {
  await page.goto("/login");
  await page.getByLabel("이메일", { exact: true }).fill(ADMIN_EMAIL);
  await page.getByLabel("비밀번호", { exact: true }).fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  try {
    await page.waitForURL("**/feed", { timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
}

test("일반 사용자가 /admin 에 접근하면 404 화면을 본다", async ({ page }) => {
  await signup(page, "e2e-admin-guard");

  // AdminGuard 는 ADMIN 이 아니면 notFound() 처리한다 (경로 존재를 숨기기 위한 404)
  await page.goto("/admin");
  await expect(page.getByText("페이지를 찾을 수 없습니다")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "관리자" })).toHaveCount(0);
});

test("관리자는 /admin 대시보드를 볼 수 있다", async ({ page }) => {
  const adminOk = await loginAsAdmin(page);
  test.skip(!adminOk, "admin account not seeded on this server");

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "관리자" })).toBeVisible({ timeout: 15_000 });
  // 통계 로딩이 끝나면 큐 카드·통계 카드가 보인다
  await expect(page.getByText("처리 대기 신고")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("활동 회원")).toBeVisible();
  await expect(page.getByText("정지 중 회원")).toBeVisible();
});

test("관리자는 /admin/users 에서 회원 목록을 검색해 볼 수 있다", async ({ page }) => {
  const adminOk = await loginAsAdmin(page);
  test.skip(!adminOk, "admin account not seeded on this server");

  await page.goto("/admin/users");
  await expect(page.getByLabel("회원 검색")).toBeVisible({ timeout: 15_000 });

  // 가입자가 많아도 흔들리지 않도록 관리자 계정 자신을 검색해 확인한다
  await page.getByLabel("회원 검색").fill(ADMIN_EMAIL);
  await page.getByRole("button", { name: "검색", exact: true }).click();
  const adminRow = page.getByRole("listitem").filter({ hasText: ADMIN_EMAIL });
  await expect(adminRow).toBeVisible({ timeout: 15_000 });
  await expect(adminRow.getByText("관리자", { exact: true })).toBeVisible();
});
