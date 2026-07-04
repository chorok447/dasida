import { test, expect, type Page } from "@playwright/test";
import { signup } from "./helpers/account";
import { fillPostContent } from "./helpers/post-content";

/** 새 글을 작성하고 마이페이지 '상세 보기'로 게시글 상세에 진입한 뒤 URL을 반환한다. */
async function createPostAndOpenDetail(page: Page, text: string): Promise<string> {
  await page.goto("/posts/new");
  await expect(page.getByRole("heading", { name: "새 글 쓰기" })).toBeVisible();
  await fillPostContent(page, text);
  await page.getByRole("button", { name: "게시하기" }).click();
  await page.waitForURL("**/feed");

  await page.goto("/mypage");
  await page.getByRole("link", { name: /상세 보기/ }).first().click();
  await page.waitForURL(/\/posts\/[^/]+$/);
  return page.url();
}

test("게시글 댓글을 작성·수정·삭제할 수 있다", async ({ page }) => {
  const stamp = Date.now();
  await signup(page, "e2e-comment");
  await createPostAndOpenDetail(page, `E2E 댓글 대상 글 ${stamp}`);

  // 작성
  const commentText = `E2E 댓글 ${stamp}`;
  await page.getByLabel("댓글 내용").fill(commentText);
  await page.getByRole("button", { name: "댓글 등록" }).click();
  await expect(page.getByText(commentText)).toBeVisible();

  // 수정
  const updatedText = `E2E 댓글 수정 ${stamp}`;
  await page.getByRole("button", { name: "댓글 수정" }).click();
  await page.getByLabel("댓글 수정 내용").fill(updatedText);
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByText(updatedText)).toBeVisible();
  await expect(page.getByText("수정됨")).toBeVisible();

  // 삭제 (ConfirmDialog 확인)
  await page.getByRole("button", { name: "댓글 삭제" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "삭제" }).click();
  await expect(page.getByText(updatedText)).not.toBeVisible();
});

test("캠페인 댓글을 작성·수정·삭제할 수 있다", async ({ page }) => {
  const stamp = Date.now();
  await signup(page, "e2e-camp-comment");

  await page.goto("/campaigns/new");
  await page.getByRole("button", { name: /템플릿 적용/ }).first().click();

  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const addDays = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return fmt(d);
  };
  await page.getByLabel("모집 시작일").fill(addDays(0));
  await page.getByLabel("모집 종료일").fill(addDays(7));
  await page.getByLabel("진행 시작일").fill(addDays(8));
  await page.getByLabel("진행 종료일").fill(addDays(14));
  await page.getByRole("button", { name: "캠페인 등록" }).click();
  await page.waitForURL("**/campaigns/c-*");

  // 상세는 내용/댓글 탭 구조 — 댓글 탭으로 전환
  await page.getByRole("button", { name: "댓글", exact: true }).click();

  // 작성
  const commentText = `E2E 캠페인 댓글 ${stamp}`;
  await page.getByPlaceholder("댓글을 입력해주세요.").fill(commentText);
  await page.getByRole("button", { name: "댓글 등록" }).click();
  await expect(page.getByText(commentText)).toBeVisible();

  // 수정
  const updatedText = `E2E 캠페인 댓글 수정 ${stamp}`;
  await page.getByRole("button", { name: /댓글 수정/ }).click();
  await page.getByLabel("댓글 수정 내용").fill(updatedText);
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByText(updatedText)).toBeVisible();
  await expect(page.getByText("수정됨")).toBeVisible();

  // 삭제
  await page.getByRole("button", { name: /댓글 삭제/ }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "삭제" }).click();
  await expect(page.getByText(updatedText)).not.toBeVisible();
});

test("댓글 알림을 클릭하면 해당 댓글 위치로 이동한다", async ({ browser }) => {
  const stamp = Date.now();
  const authorContext = await browser.newContext();
  const commenterContext = await browser.newContext();
  const authorPage = await authorContext.newPage();
  const commenterPage = await commenterContext.newPage();

  // 글 작성자
  await signup(authorPage, "e2e-deeplink-author");
  const postUrl = await createPostAndOpenDetail(authorPage, `E2E 딥링크 글 ${stamp}`);

  // 다른 사용자가 댓글 작성 → 작성자에게 알림 발생
  await signup(commenterPage, "e2e-deeplink-commenter");
  const commentText = `E2E 딥링크 댓글 ${stamp}`;
  await commenterPage.goto(postUrl);
  await commenterPage.getByLabel("댓글 내용").fill(commentText);
  await commenterPage.getByRole("button", { name: "댓글 등록" }).click();
  await expect(commenterPage.getByText(commentText)).toBeVisible();

  // 작성자가 알림에서 댓글 딥링크(commentId 쿼리)로 진입
  await authorPage.goto("/notifications");
  await expect(authorPage.getByRole("heading", { name: /알림 \(1\)/ })).toBeVisible();
  await authorPage.getByRole("link", { name: /댓글/ }).click();
  await authorPage.waitForURL(/\/posts\/[^/?]+\?.*commentId=/);
  await expect(authorPage.getByText(commentText)).toBeVisible();

  await authorContext.close();
  await commenterContext.close();
});
