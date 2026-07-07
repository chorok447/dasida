import { test, expect } from "@playwright/test";
import { signup } from "./helpers/account";

test("비로그인 상태에서 알림 페이지는 로그인으로 보낸다", async ({ page }) => {
  await page.goto("/notifications");
  await page.waitForURL(/\/login\?next=.*notifications/);
});

test("로그인 후 알림 페이지가 빈 상태로 표시된다", async ({ page }) => {
  await signup(page, "e2e-notif");
  await page.goto("/notifications");

  await expect(page.getByRole("heading", { name: "알림", exact: true })).toBeVisible();
  await expect(page.getByText("알림이 없습니다.")).toBeVisible();
});

test("캠페인 참여 시 개설자에게 알림이 생성되고 읽음·삭제할 수 있다", async ({ browser }) => {
  const ownerContext = await browser.newContext();
  const joinerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  const joinerPage = await joinerContext.newPage();

  await signup(ownerPage, "e2e-notif-owner");
  await ownerPage.goto("/campaigns/new");
  await ownerPage.getByRole("button", { name: /템플릿 적용/ }).first().click();

  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const addDays = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + n);
    return fmt(d);
  };

  await ownerPage.getByLabel("모집 시작일").fill(addDays(0));
  await ownerPage.getByLabel("모집 종료일").fill(addDays(7));
  await ownerPage.getByLabel("진행 시작일").fill(addDays(8));
  await ownerPage.getByLabel("진행 종료일").fill(addDays(14));
  await ownerPage.getByRole("button", { name: "캠페인 등록" }).click();
  await ownerPage.waitForURL("**/campaigns/c-*");
  const campaignUrl = ownerPage.url();

  await ownerPage.getByRole("button", { name: "모집 시작" }).click();
  await ownerPage.getByRole("alertdialog").getByRole("button", { name: "확인" }).click();

  await signup(joinerPage, "e2e-notif-joiner");
  await joinerPage.goto(campaignUrl);
  await joinerPage.getByRole("button", { name: "캠페인 참여하기" }).click();
  await expect(joinerPage.getByText("참여 완료 · 모집 중인 캠페인입니다")).toBeVisible();

  await ownerPage.goto("/notifications");
  await expect(ownerPage.getByRole("heading", { name: /알림 \(1\)/ })).toBeVisible();
  await expect(ownerPage.getByRole("link", { name: /캠페인에 참여했습니다/ })).toBeVisible();

  // 타입별 필터 탭: 관련 없는 그룹에서는 안 보이고, 캠페인 그룹에서는 보인다.
  await ownerPage.getByRole("button", { name: "팔로우", exact: true }).click();
  await expect(ownerPage.getByText("알림이 없습니다.")).toBeVisible();
  await ownerPage.getByRole("button", { name: "캠페인", exact: true }).click();
  await expect(ownerPage.getByRole("link", { name: /캠페인에 참여했습니다/ })).toBeVisible();
  await ownerPage.getByRole("button", { name: "전체", exact: true }).click();

  await ownerPage.getByRole("button", { name: "읽음으로 표시" }).click();
  await expect(ownerPage.getByRole("heading", { name: "알림", exact: true })).toBeVisible();
  await expect(ownerPage.getByRole("heading", { name: /알림 \(1\)/ })).not.toBeVisible();

  // types + 안읽음만 조합(AND): 읽음 처리된 알림은 타입이 맞아도 안읽음만 볼 때는 안 보인다.
  await ownerPage.getByRole("button", { name: "캠페인", exact: true }).click();
  await ownerPage.getByRole("button", { name: "안읽음만", exact: true }).click();
  await expect(ownerPage.getByText("알림이 없습니다.")).toBeVisible();
  await ownerPage.getByRole("button", { name: "안읽음만", exact: true }).click();
  await expect(ownerPage.getByRole("link", { name: /캠페인에 참여했습니다/ })).toBeVisible();
  await ownerPage.getByRole("button", { name: "전체", exact: true }).click();

  await ownerPage.getByRole("button", { name: "알림 삭제" }).click();
  await expect(ownerPage.getByText("알림이 없습니다.")).toBeVisible();

  await ownerContext.close();
  await joinerContext.close();
});
