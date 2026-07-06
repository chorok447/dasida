import { test, expect } from "@playwright/test";
import { login, logout, signup } from "./helpers/account";
import { fillPostContent } from "./helpers/post-content";

test.describe.configure({ mode: "serial" });

test("프로필에서 메시지를 보내고 알림·답장·목록이 동작한다", async ({ page }) => {
  const recipient = await signup(page, "e2e-dm-recipient");
  const postText = `DM앵커 ${Date.now()}`;

  await page.goto("/posts/new");
  await fillPostContent(page, postText);
  await page.getByRole("button", { name: "게시하기" }).click();
  await page.waitForURL("**/feed");

  const profileHref = await page.getByRole("link", { name: recipient.nickname }).first().getAttribute("href");
  expect(profileHref).toMatch(/\/users\/\d+/);

  await logout(page);

  await signup(page, "e2e-dm-sender");
  await page.goto(profileHref!);
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

  await page.getByRole("link", { name: new RegExp(messageText) }).first().click();
  const replyText = `답장 ${Date.now()}`;
  await page.getByPlaceholder(/메시지 입력/).fill(replyText);
  await page.getByLabel("전송").click();
  await expect(page.getByText(replyText)).toBeVisible({ timeout: 10_000 });
});
