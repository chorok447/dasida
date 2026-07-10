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

  // 본인 메시지 삭제 → 마스킹 표시로 대체
  await page.getByRole("button", { name: "메시지 삭제" }).first().click();
  await expect(page.getByText("삭제된 메시지입니다")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(replyText)).not.toBeVisible();
});

test("메시지 삭제가 상대 화면에 실시간 반영된다", async ({ browser }) => {
  const senderContext = await browser.newContext();
  const recipientContext = await browser.newContext();
  const senderPage = await senderContext.newPage();
  const recipientPage = await recipientContext.newPage();

  // 수신자: 글을 하나 만들어 프로필 앵커 확보
  const recipient = await signup(recipientPage, "e2e-dm-del-recipient");
  await recipientPage.goto("/posts/new");
  await fillPostContent(recipientPage, `DM삭제앵커 ${Date.now()}`);
  await recipientPage.getByRole("button", { name: "게시하기" }).click();
  await recipientPage.waitForURL("**/feed");
  const profileHref = await recipientPage.getByRole("link", { name: recipient.nickname }).first().getAttribute("href");
  expect(profileHref).toMatch(/\/users\/\d+/);

  // 발신자: DM 방 진입 후 메시지 전송
  await signup(senderPage, "e2e-dm-del-sender");
  await senderPage.goto(profileHref!);
  await senderPage.getByRole("button", { name: "메시지 보내기" }).click();
  await senderPage.waitForURL("**/messages/**");
  const roomUrl = senderPage.url();
  const messageText = `실시간삭제 ${Date.now()}`;
  await senderPage.getByPlaceholder(/메시지 입력/).fill(messageText);
  await senderPage.getByLabel("전송").click();
  await expect(senderPage.getByText(messageText)).toBeVisible({ timeout: 10_000 });

  // 수신자: 같은 방을 열어 메시지 확인 (WS 구독 활성)
  await recipientPage.goto(roomUrl);
  await expect(recipientPage.getByText(messageText)).toBeVisible({ timeout: 10_000 });

  // 발신자가 삭제 → 수신자 화면이 새로고침 없이 마스킹으로 바뀐다
  await senderPage.getByRole("button", { name: "메시지 삭제" }).first().click();
  await expect(senderPage.getByText("삭제된 메시지입니다")).toBeVisible({ timeout: 10_000 });
  await expect(recipientPage.getByText("삭제된 메시지입니다")).toBeVisible({ timeout: 10_000 });
  await expect(recipientPage.getByText(messageText)).not.toBeVisible();

  await senderContext.close();
  await recipientContext.close();
});

test("게시글 상세에서 작성자에게 메시지를 보낸다", async ({ page }) => {
  await signup(page, "e2e-dm-post-author");
  const postText = `DM상세 ${Date.now()}`;

  await page.goto("/posts/new");
  await fillPostContent(page, postText);
  await page.getByRole("button", { name: "게시하기" }).click();
  await page.waitForURL("**/feed");

  await page.goto("/mypage");
  const postLink = page.locator('a[href^="/posts/"]').filter({ hasText: postText }).first();
  await expect(postLink).toBeVisible({ timeout: 15_000 });
  const postHref = await postLink.getAttribute("href");
  expect(postHref).toMatch(/\/posts\//);

  await logout(page);
  await signup(page, "e2e-dm-post-viewer");
  await page.goto(postHref!);
  await page.getByRole("button", { name: "메시지 보내기" }).click();
  await page.waitForURL("**/messages/**");

  const messageText = `상세DM ${Date.now()}`;
  await page.getByPlaceholder(/메시지 입력/).fill(messageText);
  await page.getByLabel("전송").click();
  await expect(page.getByText(messageText)).toBeVisible({ timeout: 10_000 });
});
