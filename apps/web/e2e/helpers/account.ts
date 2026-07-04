import { type Page } from "@playwright/test";

export type Account = { email: string; password: string; nickname: string };

/** 회원가입 후 피드로 이동한 계정을 반환한다. */
export async function signup(page: Page, prefix = "e2e"): Promise<Account> {
  const stamp = Date.now();
  const account: Account = {
    email: `${prefix}-${stamp}@example.com`,
    password: "Passw0rd!",
    nickname: `이투이${stamp % 100000}`,
  };

  await page.goto("/signup");
  await page.getByLabel("이메일").fill(account.email);
  await page.getByLabel("비밀번호", { exact: true }).fill(account.password);
  await page.getByLabel("비밀번호 확인").fill(account.password);
  await page.getByLabel("이름").fill("이투이");
  await page.getByLabel("닉네임").fill(account.nickname);
  await page.getByRole("button", { name: "회원가입" }).click();
  await page.waitForURL("**/feed");

  return account;
}
