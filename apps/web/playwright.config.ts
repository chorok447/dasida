import { defineConfig } from "@playwright/test";

/**
 * E2E 스모크 테스트 설정.
 * 사전 조건: MySQL 기동 (로컬: repo 루트에서 `docker compose up -d`, CI: service container).
 * web/api 서버는 webServer가 직접 띄우되, 이미 떠 있으면 재사용한다
 * (로컬에서 dev 서버를 켜둔 채 `pnpm e2e` 실행 가능).
 * web은 프로덕션 서버(`next start`)를 쓰므로 먼저 `pnpm build`가 필요하다.
 *
 * 3000/8080 을 다른 프로젝트가 쓰고 있으면 포트를 바꿔 실행할 수 있다:
 *   NEXT_PUBLIC_API_URL=http://localhost:8180 pnpm build   # 클라이언트 API URL 은 빌드에 박힌다
 *   E2E_WEB_PORT=3100 E2E_API_PORT=8180 pnpm e2e
 */
const WEB_PORT = process.env.E2E_WEB_PORT ?? "3000";
const API_PORT = process.env.E2E_API_PORT ?? "8080";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  // ponytail: CI 에서 signup·업로드 e2e 가 같은 API 를 두고 경쟁하면 간헐 실패 → worker 1
  workers: process.env.CI ? 1 : undefined,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: `pnpm start --port ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: true,
      timeout: 60_000,
      env: {
        // SSR fetch 용 런타임 API URL(클라이언트 번들 URL 은 빌드 시점의 NEXT_PUBLIC_API_URL).
        API_INTERNAL_URL: `http://localhost:${API_PORT}`,
      },
    },
    {
      // e2e 는 스펙마다 신규 계정·게시글·캠페인을 만들어 한 IP 에 쓰기가 몰린다.
      // 운영 기본값이면 스위트 전체 병렬 실행 시 429 로 깨지므로 테스트 서버만 한도를 올린다.
      // 관리자 e2e 용 부트스트랩 계정(admin@dasida.local)도 테스트 서버 전용 비밀번호로 시드한다.
      // 공개 비밀번호로 시드되는 서버이므로 루프백에만 바인딩한다(LAN 노출 방지).
      command:
        `./gradlew bootRun --args='--server.port=${API_PORT} --server.address=127.0.0.1 --app.cors.allowed-origins=http://localhost:${WEB_PORT},http://127.0.0.1:${WEB_PORT} --app.upload.public-base-url=http://localhost:${API_PORT} --app.rate-limit.auth.signup.limit=1000 --app.rate-limit.auth.login.limit=1000 --app.rate-limit.content.post.limit=1000 --app.rate-limit.content.campaign.limit=1000 --app.admin.password=E2eAdminPass!'`,
      cwd: "../api",
      url: `http://localhost:${API_PORT}/actuator/health`,
      reuseExistingServer: true,
      timeout: 300_000,
    },
  ],
});
