import { test, expect } from "@playwright/test";
import { signup } from "./helpers/account";

test("접속 기록 탭에 가입·로그인 후 기록이 표시된다", async ({ page }) => {
  await signup(page, "e2e-access");

  await page.goto("/mypage?tab=access");
  await expect(page.getByText("최근 1년간 로그인·세션 갱신 시점의 OS·브라우저·IP와 대략적인 위치를 보여줘요.")).toBeVisible();
  await expect(page.getByText("아직 접속 기록이 없어요.")).not.toBeVisible();
  await expect(page.locator("article").first()).toBeVisible();
});
