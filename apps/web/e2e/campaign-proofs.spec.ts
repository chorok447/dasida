import { test, expect, type Page } from "@playwright/test";
import { signup } from "./helpers/account";
import { dateAfter } from "./helpers/dates";

// signup 2회가 연속이라 파일 내 serial (로컬 multi-worker 시)
test.describe.configure({ mode: "serial" });

/** 템플릿으로 모집 중(모집 시작일 = 오늘) 캠페인을 만들고 상세 URL 을 반환한다. */
async function createRecruitingCampaign(page: Page): Promise<string> {
  await page.goto("/campaigns/new");
  await page.getByRole("button", { name: /템플릿 적용/ }).first().click();
  await page.getByLabel("모집 시작일").fill(dateAfter(0));
  await page.getByLabel("모집 종료일").fill(dateAfter(7));
  await page.getByLabel("진행 시작일").fill(dateAfter(8));
  await page.getByLabel("진행 종료일").fill(dateAfter(14));
  await page.getByRole("button", { name: "캠페인 등록" }).click();
  await page.waitForURL("**/campaigns/c-*");

  // 신규 캠페인은 upcoming → 개설자가 모집을 시작해야 참여(및 인증) 가능
  await page.getByRole("button", { name: "모집 시작" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "확인" }).click();
  await expect(page.getByRole("button", { name: "캠페인 참여하기" })).toBeVisible();

  return page.url();
}

test("캠페인에 참여한 사용자가 참여 인증을 등록하고 삭제할 수 있다", async ({ browser }) => {
  test.setTimeout(120_000);
  const stamp = Date.now();

  // 사용자 A: 모집 중 캠페인 개설
  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  await signup(ownerPage, "e2e-proof-owner");
  const campaignUrl = await createRecruitingCampaign(ownerPage);

  // 사용자 B: 캠페인 참여
  const joinerContext = await browser.newContext();
  const joinerPage = await joinerContext.newPage();
  await signup(joinerPage, "e2e-proof-joiner");
  await joinerPage.goto(campaignUrl);
  await joinerPage.getByRole("button", { name: "캠페인 참여하기" }).click();
  await expect(joinerPage.getByText("참여 완료 · 모집 중인 캠페인입니다")).toBeVisible();

  // 참여 인증 탭에서 인증 작성 (사진은 선택 입력이라 텍스트만 등록)
  await joinerPage.getByRole("button", { name: "참여 인증", exact: true }).click();
  const proofText = `E2E 참여 인증 ${stamp}`;
  await joinerPage.getByLabel("참여 인증 작성").fill(proofText);
  await joinerPage.getByRole("button", { name: "인증 등록" }).click();

  // 목록에 나타나고, 작성 폼은 '이미 남김' 안내로 바뀐다
  await expect(joinerPage.getByText(proofText)).toBeVisible();
  await expect(joinerPage.getByText("이미 참여 인증을 남겼어요. 삭제 후 다시 작성할 수 있어요.")).toBeVisible();

  // 본인 인증 삭제 (ConfirmDialog 확인)
  await joinerPage.getByRole("button", { name: "내 참여 인증 삭제" }).click();
  await joinerPage.getByRole("alertdialog").getByRole("button", { name: "삭제" }).click();
  await expect(joinerPage.getByText(proofText)).not.toBeVisible();
  await expect(joinerPage.getByText("아직 참여 인증이 없습니다. 첫 인증을 남겨보세요.")).toBeVisible();

  await ownerContext.close();
  await joinerContext.close();
});
