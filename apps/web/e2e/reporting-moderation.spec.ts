import { test, expect, type Page } from "@playwright/test";
import { signup } from "./helpers/account";
import { fillPostContent } from "./helpers/post-content";

const ADMIN_EMAIL = "admin@dasida.local";
const ADMIN_PASSWORD = "E2eAdminPass!"; // playwright.config.ts 의 --app.admin.password 시드
const API_BASE = `http://localhost:${process.env.E2E_API_PORT ?? "8080"}`;

// signup 3회 + 관리자 처리가 이어지는 무거운 플로우라 파일 내 serial
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

test("신고된 게시글을 관리자가 숨기면 공개로는 404, 작성자에게는 숨김으로 보인다", async ({ browser, request }) => {
  // signup 3회 + 신고 + 관리자 처리가 이어지는 긴 플로우
  test.setTimeout(120_000);
  const stamp = Date.now();
  const postText = `E2E 신고 대상 글 ${stamp}`;

  // 사용자 A: 게시글 작성
  const authorContext = await browser.newContext();
  const authorPage = await authorContext.newPage();
  await signup(authorPage, "e2e-report-author");
  const postUrl = await createPostAndOpenDetail(authorPage, postText);
  const postId = postUrl.match(/\/posts\/([^/?#]+)/)![1];

  // 사용자 B: 게시글을 열고 신고 (버튼 접근성 이름은 aria-label "콘텐츠 신고")
  const reporterContext = await browser.newContext();
  const reporterPage = await reporterContext.newPage();
  await signup(reporterPage, "e2e-reporter");
  await reporterPage.goto(postUrl);
  // 문서 <title> 에도 본문 첫 줄이 들어가므로 본문 영역으로 한정한다(strict mode).
  await expect(reporterPage.locator("#main-content").getByText(postText)).toBeVisible();
  await reporterPage.getByRole("button", { name: "콘텐츠 신고" }).first().click();

  const reportDialog = reporterPage.getByRole("dialog");
  await expect(reportDialog.getByRole("heading", { name: "콘텐츠 신고" })).toBeVisible();
  await reportDialog.getByLabel("신고 사유").selectOption({ label: "스팸/광고" });
  await reportDialog.getByRole("button", { name: "신고하기" }).click();
  await expect(reporterPage.getByText("신고가 접수되었습니다.").first()).toBeVisible();

  // 관리자: 신고 큐(기본 탭 '대기 중')에서 해당 신고를 조치 완료 + 콘텐츠 숨김
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  const adminOk = await loginAsAdmin(adminPage);
  test.skip(!adminOk, "admin account not seeded on this server");

  await adminPage.goto("/admin/reports");
  const reportRow = adminPage.getByRole("listitem").filter({ hasText: String(stamp) });
  await expect(reportRow).toBeVisible({ timeout: 15_000 });
  // '조치 완료 시 대상 콘텐츠 함께 숨김' 체크박스는 기본 선택 — 그대로 조치 완료
  await expect(reportRow.getByRole("checkbox")).toBeChecked();
  await reportRow.getByRole("button", { name: "조치 완료" }).click();
  await expect(
    adminPage.getByText("신고를 조치 완료 처리하고 콘텐츠를 숨겼습니다.").first(),
  ).toBeVisible({ timeout: 15_000 });

  // 공개 API 에서는 즉시 404 (익명 요청 — request 픽스처에는 쿠키가 없다)
  const apiResponse = await request.get(`${API_BASE}/api/posts/${postId}`);
  expect(apiResponse.status()).toBe(404);

  // 익명 브라우저에서 상세 URL 은 404 페이지 (상세 SSR 은 no-store 라 즉시 반영)
  const anonContext = await browser.newContext();
  const anonPage = await anonContext.newPage();
  await anonPage.goto(postUrl);
  await expect(anonPage.getByText("페이지를 찾을 수 없습니다")).toBeVisible({ timeout: 15_000 });

  // 작성자 A 는 마이페이지에서 숨김 안내와 함께 여전히 자기 글을 본다
  await authorPage.goto("/mypage");
  await expect(authorPage.getByText("운영 정책에 따라 숨김 처리된 게시글입니다")).toBeVisible();

  await authorContext.close();
  await reporterContext.close();
  await adminContext.close();
  await anonContext.close();
});
