import { test, expect } from "@playwright/test";
import { login, logout, signup } from "./helpers/account";

test.describe.configure({ mode: "serial" });

test("프로필에서 메시지를 보내고 알림·답장·목록이 동작한다", async ({ page }) => {
  const recipient = await signup(page, "e2e-dm-recipient");
  const recipientName = recipient.nickname;
  await logout(page);

  await signup(page, "e2e-dm-sender");
  await page.goto("/search");
  await page.getByPlaceholder("검색어를 입력하세요").fill(recipientName);
  await page.getByRole("button", { name: "검색" }).click();
  const profileLink = page.getByRole("link", { name: recipientName }).first();
  await expect(profileLink).toBeVisible({ timeout: 15_000 });
  const href = await profileLink.getAttribute("href");
  expect(href).toMatch(/\/users\/\d+/);

  await page.goto(href!);
  await page.getByRole("button", { name: "메시지 보내기" }).click();
  await page.waitForURL("**/messages/**");

  const messageText = `DM테스트 ${Date.now()}`;
  await page.getByPlaceholder(/메시지 입력/).fill(messageText);
  await page.getByLabel("전송").click();
  await expect(page.getByText(messageText)).toBeVisible({ timeout: 10_000 });

  await logout(page);
  await login(page, recipient);
  await page.goto("/notifications");
  await expect(page.getByRole("link", { name: /새 메시지/ })).toBeVisible({ timeout: 15_000 });

  await page.goto("/messages");
  await expect(page.getByText(messageText).first()).toBeVisible({ timeout: 15_000 });

  await page.getByText(messageText).first().click();
  const replyText = `답장 ${Date.now()}`;
  await page.getByPlaceholder(/메시지 입력/).fill(replyText);
  await page.getByLabel("전송").click();
  await expect(page.getByText(replyText)).toBeVisible({ timeout: 10_000 });
});
