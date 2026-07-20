#!/usr/bin/env node
// Flyway 마이그레이션 버전 중복 가드 — 두 PR 이 각각 같은 V<번호> 파일을 추가해
// develop 머지 후 버전이 겹치면 Flyway validate 가 죽어 API bootRun·e2e 가 통째로 깨진다.
// 재발을 CI 에서 막는다.
//
//   node scripts/check-flyway-versions.mjs   # 로컬 실행 (통과 시 exit 0, 중복 발견 시 non-zero)
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const MIGRATION_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "apps/api/src/main/resources/db/migration",
);

// Flyway versioned 마이그레이션: V<번호>__<설명>.sql (번호는 점 구분 허용, 예: V1.2)
const VERSIONED = /^V([0-9]+(?:[._][0-9]+)*)__.+\.sql$/;

const byVersion = new Map();
for (const name of readdirSync(MIGRATION_DIR)) {
  const m = VERSIONED.exec(name);
  if (!m) continue;
  // Flyway 는 버전 구분자로 _ 와 . 를 동일 취급한다 — 정규화해 비교한다.
  const version = m[1].replace(/_/g, ".");
  if (!byVersion.has(version)) byVersion.set(version, []);
  byVersion.get(version).push(name);
}

const duplicates = [...byVersion.entries()].filter(([, files]) => files.length > 1);

if (duplicates.length > 0) {
  console.error("❌ Flyway 마이그레이션 버전 번호가 중복됩니다:\n");
  for (const [version, files] of duplicates) {
    console.error(`  V${version} → ${files.sort().join(", ")}`);
  }
  console.error(
    "\n같은 버전 파일이 둘 이상이면 Flyway validate 가 실패해 API 가 기동하지 못합니다.",
  );
  console.error("가장 큰 버전 뒤로 하나를 리네임해 충돌을 해소하세요.");
  process.exit(1);
}

console.log(`✅ Flyway 마이그레이션 ${byVersion.size}개 버전 — 중복 없음.`);
