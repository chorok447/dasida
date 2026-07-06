import { test, expect } from "@playwright/test";
import { signup } from "./helpers/account";

/**
 * access 토큰 만료(401) 시 refresh 후 원 요청 재시도 회귀 가드 (#241).
 * 실제 TTL 대기 대신 첫 API 호출만 401을 흉내 낸다.
 */
test("내 게시글 API 401 후 refresh 되면 마이페이지가 유지된다", async ({ page }) => {
  const account = await signup(page, "e2e-refresh");
  let minePageHits = 0;

  await page.route("**/api/posts/mine/page**", async (route) => {
    minePageHits += 1;
    if (minePageHits === 1) {
      await route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
      return;
    }
    await route.continue();
  });

  await page.goto("/mypage?tab=posts");
  await expect(page.getByText(account.nickname).first()).toBeVisible();
  await expect(page.getByText("아직 작성한 글이 없어요.")).toBeVisible({ timeout: 15_000 });
  expect(minePageHits).toBeGreaterThanOrEqual(2);
});
