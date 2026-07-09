import { type Page, expect } from "@playwright/test";

export type Account = { email: string; password: string; nickname: string };

/** 로그인 후 피드로 이동한다. */
export async function login(page: Page, account: Pick<Account, "email" | "password">) {
  await page.goto("/login");
  await page.getByLabel("이메일", { exact: true }).fill(account.email);
  await page.getByLabel("비밀번호", { exact: true }).fill(account.password);
  const submit = page.getByRole("button", { name: "로그인", exact: true });
  await expect(submit).toBeEnabled();
  await submit.click();
  await page.waitForURL("**/feed", { timeout: 60_000 });
}

/** 로그아웃한다. */
export async function logout(page: Page) {
  await page.getByRole("button", { name: "로그아웃" }).click();
  await expect(page.getByRole("button", { name: "로그아웃" })).toBeHidden({ timeout: 15_000 });
}

/** 회원가입 후 피드로 이동한 계정을 반환한다. */
export async function signup(page: Page, prefix = "e2e"): Promise<Account> {
  // 병렬 워커가 같은 밀리초에 signup 하면 Date.now() 만으로는 닉네임이 충돌한다 → 난수 3자리를 섞는다.
  const stamp = `${Date.now() % 10_000_000}${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`;
  const account: Account = {
    email: `${prefix}-${stamp}@example.com`,
    password: "Passw0rd!",
    nickname: `이투이${stamp.slice(-8)}`,
  };

  await page.goto("/signup");
  await page.getByLabel("이메일").fill(account.email);
  await page.getByLabel("비밀번호", { exact: true }).fill(account.password);
  await page.getByLabel("비밀번호 확인").fill(account.password);
  await page.getByLabel("닉네임").fill(account.nickname);
  const submit = page.getByRole("button", { name: "회원가입" });
  await expect(submit).toBeEnabled();
  await submit.click();
  await page.waitForURL("**/feed", { timeout: 60_000 });

  return account;
}
