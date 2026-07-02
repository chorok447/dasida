# Hibernate JSON → Jackson 3 FormatMapper 전환 검증 (spike)

> 목적: Boot 4.1 이후 병행 유지 중인 `com.fasterxml.jackson.module:jackson-module-kotlin`(v2)를
> 제거할 수 있는지 검증한다. **spike** — Draft PR, 즉시 merge 목적 아님.

## 검증 기준

| 항목 | 값 |
| --- | --- |
| develop HEAD | `e800ca8` (PR #121/#122/#123 merge 이후) |
| 브랜치 | `spike/hibernate-json-jackson3-formatmapper` |
| Hibernate ORM | **7.4.1.Final** (Boot 4.1.0 BOM) |
| Jackson HTTP | **3.1.4** (`tools.jackson`, Boot auto-configured `JsonMapper`) |

---

## 1. JSON column / `@JdbcTypeCode` 사용 위치

| Entity | Field | Type | 용도 |
| --- | --- | --- | --- |
| `Campaign` | `body` | `CampaignBody` (Kotlin data class) | 캠페인 본문 JSON (heading, paragraphs, images) |
| `Post` | `tags` | `List<String>` | 게시글 태그 배열 |
| `Post` | `images` | `List<String>` | 이미지 URL 배열 |

- `CampaignBody` 정의: `apps/api/.../campaign/Campaign.kt` (embeddable JSON 타입, 기본 생성자 없음)
- Seed 경로: `CampaignSeed` / `SeedRunner` → DB insert 시 Hibernate JSON **write**
- 테스트/런타임: repository load, campaign controller → JSON **read**
- `@JsonIgnore` 는 Jackson annotation (v2 패키지) — entity 직렬화 제어용, HTTP JsonMapper 와 별개

---

## 2. Jackson 2/3 dependency 분석 (변경 전)

| 의존성 | 경로 | 역할 |
| --- | --- | --- |
| `tools.jackson.module:jackson-module-kotlin` 3.1.4 | **직접** + Boot BOM | HTTP `JsonMapper`, Kotlin DTO 역직렬화 |
| `com.fasterxml.jackson.module:jackson-module-kotlin` 2.21.4 | **직접** (병행) | Hibernate `@JdbcTypeCode(JSON)` Kotlin 타입 역직렬화 |
| `com.fasterxml.jackson.core:jackson-databind` 2.21.4 | jjwt-jackson, springdoc/swagger | JWT·OpenAPI (Hibernate JSON 과 무관) |

**Jackson 2 Kotlin module이 필요했던 이유**

- Hibernate 7.4 기본 JSON FormatMapper = `org.hibernate.type.format.jackson.JacksonJsonFormatMapper` (**Jackson 2**)
- Jackson 2 auto-detection 은 `com.fasterxml.jackson` 패키지만 인식 → Boot 4 기본 Jackson 3(`tools.jackson`)과 **자동 연결 안 됨**
- v2 kotlin module 없이 `CampaignBody` read 시:
  - `InvalidDefinitionException: Cannot construct instance of CampaignBody (no Creators...)`

---

## 3. 1차 시도: Jackson 2 Kotlin module만 제거

`build.gradle.kts`에서 `com.fasterxml.jackson.module:jackson-module-kotlin` 제거, FormatMapper 설정 **없음**.

| 검증 | 결과 |
| --- | --- |
| `compileKotlin` / `compileTestKotlin` | **성공** |
| `clean test` | **실패** — Spring context 기동 중 seed/JSON read 실패 |
| Campaign 테스트 (`*Campaign*`) | **233/233 실패** (context load) |

**Root cause (대표 스택)**

```
JacksonJsonFormatMapper.java
  → InvalidDefinitionException: CampaignBody (no Creators, like default constructor, exist)
```

→ **Jackson 2 module 제거만으로는 불가**. Hibernate JSON 경로가 Jackson 2 FormatMapper에 묶여 있음.

---

## 4. 2차 시도: Hibernate `Jackson3JsonFormatMapper` 연결

Hibernate 7.4에 `org.hibernate.type.format.jackson.Jackson3JsonFormatMapper` **내장** (HHH-19890).

### 적용 (spike)

`apps/api/src/main/kotlin/com/dasida/api/common/HibernateJsonFormatMapperConfig.kt`

- Spring auto-configured `JsonMapper`(kotlin module v3 포함)를 `Jackson3JsonFormatMapper`에 주입
- `HibernatePropertiesCustomizer`로 `AvailableSettings.JSON_FORMAT_MAPPER` 설정

`build.gradle.kts`: Jackson 2 kotlin module **제거 유지**

### 검증 결과 (2차 시도 후)

| 검증 | 결과 |
| --- | --- |
| `compileKotlin` / `compileTestKotlin` | **성공** |
| `clean test` | **542/542 통과** |
| `clean test build` | **성공** |
| `dependencyInsight jackson-module-kotlin` (v2) | **runtimeClasspath 에 없음** |
| Jackson 2 `jackson-databind` | jjwt-jackson·swagger **전이 유지** (이번 spike 범위 외) |
| `git diff --check` | **통과** |

Campaign/Hibernate JSON 관련: seed load, campaign CRUD/search/join/comment 테스트 **전부 통과**.

---

## 5. 최종 판단

| 항목 | 결론 |
| --- | --- |
| Jackson 2 Kotlin module 제거 가능 여부 | **가능** — `Jackson3JsonFormatMapper` + Boot `JsonMapper` 연결 필요 |
| 현 단계 보류 여부 | **보류 아님** (spike 검증 성공) |
| 실제 migration PR 분리 | **권장** — spike(Draft)와 별도 Ready PR로 `HibernateJsonFormatMapperConfig` + dependency 정리 |
| API/DTO/status/JWT/DB schema | **변경 없음** |
| DB JSON contract | **유지** (CampaignBody 구조·저장 형식 동일) |

### codegen / 런타임 smoke

- 이번 spike 에서 **별도 bootRun smoke 미실행** (전체 테스트·seed·campaign 경로로 JSON read/write 검증)
- 후속 Ready PR 에서 local profile campaign 상세 1건 smoke 권장

---

## 6. 후속 작업

1. **Ready PR** — `HibernateJsonFormatMapperConfig` + Jackson 2 kotlin module 제거를 develop 에 반영
2. Spring Boot 자동 FormatMapper 연결 이슈 추적 ([spring-boot#33870](https://github.com/spring-projects/spring-boot/issues/33870)) — Boot 가 공식 지원 시 custom config 단순화 검토
3. Jackson 2 `jackson-databind` 전이(jjwt, springdoc) — 별도 spike (이번 범위 외)
4. PR #113 (`minimumReleaseAge`) — **미처리·보류 유지**

---

## 7. 변경 파일 (spike)

| 파일 | 변경 |
| --- | --- |
| `apps/api/build.gradle.kts` | Jackson 2 kotlin module 제거 |
| `apps/api/.../HibernateJsonFormatMapperConfig.kt` | **신규** — Jackson3 FormatMapper 연결 |
| `docs/backend/hibernate-json-jackson3-formatmapper-check.md` | 본 문서 |

**변경 없음:** SecurityConfig/CORS/OpenAPI/Actuator, API endpoint, DTO 필드, JWT, DB schema, frontend
