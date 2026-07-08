import { test, expect } from "@playwright/test";
import { signup } from "./helpers/account";

/** 사용자 탭: 빈 검색어 안내 → 닉네임 검색 → 프로필 이동. */
test("사용자 탭에서 닉네임으로 사용자를 찾아 프로필로 이동한다", async ({ page }) => {
  const account = await signup(page, "usr");

  await page.goto("/search");
  await page.getByRole("button", { name: "사용자", exact: true }).click();
  await page.waitForURL(/type=users/);
  await expect(page.getByText("이름으로 사용자를 찾아보세요.")).toBeVisible();

  const searchInput = page.getByRole("textbox", { name: "통합 검색" });
  await searchInput.fill(account.nickname);
  await searchInput.press("Enter");
  await page.waitForURL(/type=users/);

  const result = page.getByRole("link", { name: new RegExp(account.nickname) });
  await expect(result).toBeVisible();
  await result.click();
  await page.waitForURL(/\/users\/\d+/);
  await expect(page.getByText(account.nickname).first()).toBeVisible();
});
