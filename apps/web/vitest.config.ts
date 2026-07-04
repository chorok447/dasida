import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  // test 스크립트는 NODE_OPTIONS=--no-experimental-webstorage 로 실행한다.
  // Node 22+의 실험적 전역 localStorage가 jsdom의 localStorage를 가리기 때문.
  test: {
    environment: "jsdom",
    // testing-library의 자동 cleanup / act 환경 설정이 전역 훅에 의존한다.
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
