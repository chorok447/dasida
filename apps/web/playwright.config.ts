import { defineConfig } from "@playwright/test";

/**
 * E2E 스모크 테스트 설정.
 * 사전 조건: MySQL 기동 (로컬: repo 루트에서 `docker compose up -d`, CI: service container).
 * web/api 서버는 webServer가 직접 띄우되, 이미 떠 있으면 재사용한다
 * (로컬에서 dev 서버를 켜둔 채 `pnpm e2e` 실행 가능).
 * web은 프로덕션 서버(`next start`)를 쓰므로 먼저 `pnpm build`가 필요하다.
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "pnpm start",
      url: "http://localhost:3000",
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      // e2e 는 스펙마다 신규 계정을 만들어 한 IP 에서 signup 이 몰린다.
      // 운영 기본값(10회/60초)이면 스위트 전체 병렬 실행 시 429 로 깨지므로 테스트 서버만 한도를 올린다.
      command:
        "./gradlew bootRun --args='--app.rate-limit.auth.signup.limit=1000 --app.rate-limit.auth.login.limit=1000'",
      cwd: "../api",
      url: "http://localhost:8080/actuator/health",
      reuseExistingServer: true,
      timeout: 300_000,
    },
  ],
});
