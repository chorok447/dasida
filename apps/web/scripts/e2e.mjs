#!/usr/bin/env node
// pnpm run 은 `--` 구분자를 스크립트에 그대로 전달해서, `pnpm --filter web e2e -- foo.spec.ts` 가
// `playwright test -- foo.spec.ts` 가 되면 이후 인자가 전부 위치 인자로 파싱되어 파일 스코프가 무시된다.
// 선행 `--` 하나만 걷어내고 playwright test 로 넘긴다.
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const separator = args.indexOf("--");
if (separator !== -1) args.splice(separator, 1);

const result = spawnSync("playwright", ["test", ...args], {
  stdio: "inherit",
  shell: process.platform === "win32",
});
process.exit(result.status ?? 1);
