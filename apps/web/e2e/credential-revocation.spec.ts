import { test, expect } from "@playwright/test";
import { signup, login } from "./helpers/account";

const API_BASE = `http://localhost:${process.env.E2E_API_PORT ?? "8080"}`;
const NEW_PASSWORD = "NewPassw0rd!";

/**
 * 비밀번호 변경 시 다른 기기(세션)의 기존 토큰이 즉시 무효화되는지 검증한다.
 * credentials_changed_at 이전 발급 토큰은 인증 필터·refresh 모두에서 거절되고,
 * 변경한 기기 자신은 새 토큰 쌍으로 세션이 이어져야 한다.
 */
test("비밀번호를 변경하면 다른 기기의 세션이 무효화되고 본인 세션은 유지된다", async ({ browser }) => {
  const deviceA = await browser.newContext();
  const pageA = await deviceA.newPage();
  const account = await signup(pageA, "e2e-revoke");

  const deviceB = await browser.newContext();
  const pageB = await deviceB.newPage();
  await login(pageB, account);

  // 변경 전에는 두 기기 모두 인증된다.
  expect((await pageB.request.get(`${API_BASE}/api/auth/me`)).ok()).toBeTruthy();

  // JWT iat 은 초 단위 절삭이라 변경과 같은 초에 발급된 토큰은 통과된다 — 발급 초를 확실히 넘긴다.
  await pageA.waitForTimeout(1500);

  await pageA.goto("/mypage?tab=account");
  const section = pageA.getByRole("region", { name: "비밀번호 변경" });
  await section.getByLabel("현재 비밀번호").fill(account.password);
  await section.getByLabel("새 비밀번호", { exact: true }).fill(NEW_PASSWORD);
  await section.getByLabel("새 비밀번호 확인").fill(NEW_PASSWORD);
  await section.getByRole("button", { name: "비밀번호 변경" }).click();
  await expect(pageA.getByText("비밀번호가 변경되었습니다.")).toBeVisible();

  // 변경한 기기 A: 응답으로 받은 새 토큰 쌍으로 세션 유지.
  expect((await pageA.request.get(`${API_BASE}/api/auth/me`)).ok()).toBeTruthy();

  // 다른 기기 B: 변경 이전 발급 access 는 401, refresh 로도 세션을 살릴 수 없다.
  expect((await pageB.request.get(`${API_BASE}/api/auth/me`)).status()).toBe(401);
  expect((await pageB.request.post(`${API_BASE}/api/auth/refresh`)).status()).toBe(401);

  await deviceA.close();
  await deviceB.close();
});
