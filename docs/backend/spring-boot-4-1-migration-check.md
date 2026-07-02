# Spring Boot 4.1 마이그레이션 검증 (spike)

> 목적: 실제 머지가 아니라 **마이그레이션 가능성·필수 수정 범위·깨지는 지점**을 확인하는 검증 spike.
> 브랜치: `spike/spring-boot-4-1-migration-check` / 기준 develop HEAD: `ead3ecd`

## 1. 현재 버전 (검증 전, develop 기준)

| 항목 | 현재 값 |
| --- | --- |
| Spring Boot Gradle plugin | 3.5.0 |
| io.spring.dependency-management | 1.1.7 |
| Kotlin jvm / kapt / plugin.spring | 1.9.25 |
| Kotlin plugin.jpa | 2.4.0 (다른 Kotlin 플러그인과 불일치 상태) |
| springdoc-openapi-starter-webmvc-ui | 2.8.14 |
| QueryDSL (openfeign fork) | 7.4.0 (kapt 프로세서) |
| jjwt | 0.12.6 |
| Gradle wrapper | 8.14.5 |
| Java toolchain | 21 (foojay resolver 1.0.0 자동 provisioning) |
| CI setup-java | 21 (temurin) |

- **3.5.0 은 3.5.x 최신이 아니다.** 최신 maintenance 는 **3.5.16**. Boot 4.1 직행 전에 3.5.x 최신화(3.5.16)를 별도 선행 PR 로 두는 것이 안전하다.

## 2. 시도한 target version

| 항목 | target | 근거 |
| --- | --- | --- |
| Spring Boot Gradle plugin | **4.1.0** | 최신 4.1 GA |
| Kotlin jvm/kapt/plugin.spring/plugin.jpa | **2.3.21** | Boot 4.1.0 BOM `kotlin.version`=2.3.21 에 정렬 (Boot 4 최소 요건은 Kotlin 2.2+) |
| springdoc-openapi-starter-webmvc-ui | **3.0.3** | Spring Framework 7 / Servlet 6.1 대응 라인 |
| io.spring.dependency-management | 1.1.7 (유지) | Boot 4.1 plugin 과 함께 동작 |
| Gradle wrapper | 8.14.5 (유지) | Boot 4.1 plugin / Kotlin 2.3.21 이 8.14.5 에서 동작 (wrapper 업그레이드 불필요 확인) |
| jjwt | 0.12.6 (유지) | Boot 4 와 무관, spike 에서 섞지 않음 |
| QueryDSL openfeign | 7.4.0 (유지) | 버전 변경 없이 관찰 |

### Boot 4.1.0 이 관리(BOM)하는 주요 버전
- Spring Framework **7.0.8**
- Hibernate ORM **7.4.1.Final**
- Tomcat **11.0.22** (Servlet 6.1 / Jakarta EE 11)
- JUnit Jupiter **6.0.3** (JUnit Platform 6)
- H2 **2.4.240**, MySQL connector-j **9.7.0**
- Kotlin **2.3.21**

## 3. 변경한 dependency/plugin (build.gradle.kts)
- `org.springframework.boot` 3.5.0 → **4.1.0**
- Kotlin `jvm`/`kapt`/`plugin.spring`/`plugin.jpa` → **2.3.21** (jpa 는 2.4.0 → 2.3.21 로 통일)
- springdoc 2.8.14 → **3.0.3** (기존 2.8.14 고정 사유 주석 갱신)
- `testImplementation("org.springframework.boot:spring-boot-starter-webmvc-test")` **추가**
  - Boot 4 에서 `spring-boot-starter-test` 가 더 이상 webmvc test slice 를 전이 포함하지 않음

## 4. 깨진 항목 (마이그레이션 필수 수정) 과 원인

### A. Spring Security 7 — `PasswordEncoder.encode` 반환이 `@Nullable(String?)` 로 변경
- 증상: `Assignment/Argument type mismatch: actual 'String?', but 'String' expected` (`-Xjsr305=strict` 하에서 오류)
- 영향 파일:
  - `main/.../auth/AuthService.kt` (3곳: signup, changePassword, deleteAccount)
  - `test/.../auth/AccountDeletionTest.kt`, `AuthControllerTest.kt`, `EmailChangeConcurrencyTest.kt` (setup helper)
- 적용 수정: `encoder.encode(...)` → `encoder.encode(...)!!` (BCrypt 는 실제로 null 을 반환하지 않음)
- **API/DTO/status/JWT/DB 변경 없음** — 순수 Kotlin nullability 대응

### B. Spring Framework 7 (JSpecify) — `CommandLineRunner.run(String...)` vararg 가 non-null 로 조여짐
- 증상: `'run' overrides nothing. Potential: fun run(vararg args: String)`
- 영향 파일: `main/.../common/SeedRunner.kt`, `test/.../TestUserSeed.kt`
- 적용 수정: `override fun run(vararg args: String?)` → `... String`
- 런타임 동작 동일 (시드 로직 그대로)

### C. Boot 4 test slice 모듈 분리 — `@AutoConfigureMockMvc` 패키지 이동
- 구: `org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc`
- 신: `org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc` (모듈 `spring-boot-webmvc-test`)
- 영향: 테스트 **40개 파일**
- 최초 증상은 kapt 단계의 `@error.NonExistentClass()` 였으나 실제 원인은 구 패키지가 Boot 4 에 존재하지 않음
- 적용 수정: import 40개 치환 + `spring-boot-starter-webmvc-test` test 의존성 추가

### D. Boot 4 test slice 모듈 분리 — `TestRestTemplate` 패키지 이동
- 구: `org.springframework.boot.test.web.client.TestRestTemplate`
- 신: `org.springframework.boot.resttestclient.TestRestTemplate` (모듈 `spring-boot-resttestclient`, webmvc-test starter 가 전이 포함)
- 영향: `ErrorResponseBodyContractTest.kt`, `ErrorStatusUnmaskTest.kt` (2개 파일)
- 적용 수정: import 치환 (추가 의존성 불필요)

## 5. 검증 결과

### compileKotlin / compileTestKotlin
- **성공** (섹션 4의 A~D 수정 적용 후). 남은 것은 Kotlin 2.x 경고뿐(오류 아님):
  - KT-73255: 생성자 파라미터의 `@Autowired` 어노테이션 target 관련 경고. 컴파일/런타임 영향 없음.

### test
- **실패**: `542 tests, 129 failed` (413 통과). Spring context 자체는 정상 기동(대다수 MockMvc·JPA·Security·Actuator·CORS 테스트 통과).
- 실패 129건은 3개 root cause 로 정확히 분해된다:

  **(1) Jackson 2 → Jackson 3 (약 99건) — 최대 블로커.**
  - Boot 4.1 은 기본 JSON 매퍼를 **Jackson 3 (`tools.jackson`, 3.1.4)** 로 전환. 자동 구성되는 `ObjectMapper` bean 이 `tools.jackson.databind.ObjectMapper` 가 됨.
  - 테스트가 생성자로 주입하는 **Jackson 2 타입** `com.fasterxml.jackson.databind.ObjectMapper` bean 은 더 이상 등록되지 않아 `NoSuchBeanDefinitionException` → `ParameterResolutionException`.
  - 영향 클래스: AuthControllerTest(33), CampaignCommentControllerTest(21), ReportControllerTest(10), FailedMutationRollbackPolicyTest(10), NotificationEventTest(9), AccountDeletionTest(4), PaginationContractTest(3), ListOrderingBoundaryTest(3), NotificationFailureSideEffectTest(3), AggregateCountConsistencyTest(2), ReportConcurrencyTest(1), EmailChangeConcurrencyTest(1) 등.

  **(2) Kotlin DTO 요청 body 역직렬화 실패 → POST 400 (약 20건) — 런타임 계약 영향.**
  - classpath 의 `jackson-module-kotlin` 은 여전히 **Jackson 2 (2.21.4)** 라, Boot 4 의 Jackson 3 기본 매퍼에는 Kotlin 모듈이 적용되지 않음.
  - Kotlin data class DTO(기본 생성자 없음)를 역직렬화하지 못해 POST 요청이 **400** 으로 거부됨.
  - 증상: `Status expected:<201> but was:<400>`, `<200>/<403> but <400>`.
  - 영향: PostControllerTest(13), CampaignControllerTest(6) 등. 이 클래스들은 ObjectMapper 를 주입하지 않으므로(대부분 통과), 이 400 은 **실제 직렬화 회귀**다.

  **(3) `TestRestTemplate` bean 미자동등록 (10건).**
  - Boot 4 에서 `@SpringBootTest(webEnvironment=RANDOM_PORT)` 만으로는 `TestRestTemplate` 이 자동 주입되지 않고 `@AutoConfigureTestRestTemplate` 이 필요.
  - 영향: ErrorStatusUnmaskTest(6), ErrorResponseBodyContractTest(4).

### build
- **미실행**: `test` 가 실패하므로 `test build` 단계로 진행하지 않음(build 는 test 단계에서 동일하게 실패).

### runtime smoke (`--spring.profiles.active=local`)
- **미실행**: build 가 test 에서 막혀 실행 조건 미충족. 다만 test 실행 중 **413개 통합 테스트가 Spring context 를 정상 로드**했으므로 context 기동 자체는 Boot 4.1 에서 문제없음이 간접 확인됨(local profile 은 MySQL/Docker 필요).

### git diff --check
- **통과** (whitespace/conflict 없음). 프론트엔드/lockfile/workspace 변경 없음.

## 9. Jackson 3 호환 작업 (2026-07-02, spike 브랜치 후속)

### 작업 전 / 후 test 결과
| 시점 | 통과 | 실패 | 비고 |
| --- | --- | --- | --- |
| Jackson 작업 전 | 413 | **129** | ObjectMapper 주입 ~99 + POST 400 ~20 + TestRestTemplate 10 |
| Jackson 작업 후 | **532** | **10** | TestRestTemplate 자동구성만 잔존 |

### 적용한 변경 (앱 코드/DTO/status/API contract 변경 없음)

**dependency (`apps/api/build.gradle.kts`)**
- `com.fasterxml.jackson.module:jackson-module-kotlin` → **`tools.jackson.module:jackson-module-kotlin`** (3.1.4, Boot BOM) 추가
- Hibernate `@JdbcTypeCode(JSON)` 은 내부 **Jackson 2 FormatMapper** 를 사용하므로 **`com.fasterxml.jackson.module:jackson-module-kotlin`(v2) 유지** (제거 시 SeedRunner/CampaignBody 역직렬화 실패)

**테스트 ObjectMapper → JsonMapper (13 파일)**
- `com.fasterxml.jackson.databind.ObjectMapper` → **`tools.jackson.databind.json.JsonMapper`**
- Boot 4 auto-configured `JsonMapper` bean 주입으로 `NoSuchBeanDefinitionException` 제거

**JsonNode 배열 순회 helper (신규)**
- `apps/api/src/test/kotlin/com/dasida/api/JacksonTestExtensions.kt`
- Jackson 3 `JsonNode` 는 Iterable `.map`/`.first` 확장이 없어 `toElementList()` / `mapElements()` helper 추가
- 사용: `ListOrderingBoundaryTest`, `PaginationContractTest`, `AggregateCountConsistencyTest`

### Kotlin DTO 역직렬화 (POST 400) 처리
- **원인**: Jackson 2 kotlin module 만 classpath 에 있으면 Boot 4 Jackson 3 `JsonMapper` 에 Kotlin module 미적용
- **조치**: `tools.jackson.module:jackson-module-kotlin` 추가 → PostControllerTest(117), CampaignControllerTest(143) 등 POST mutation 테스트 **전부 통과**
- DTO 필드/validation/request body contract 변경 없음

### 남은 실패 (10건, Jackson 외 — 후속 작업)
| 그룹 | 건수 | 클래스 | root cause |
| --- | --- | --- | --- |
| TestRestTemplate 자동구성 | 10 | `ErrorStatusUnmaskTest`(6), `ErrorResponseBodyContractTest`(4) | Boot 4: `@AutoConfigureTestRestTemplate` 필요 |

### 검증 (Jackson 작업 후)
- `compileKotlin` / `compileTestKotlin`: **성공**
- `clean test`: **532/542 통과**, 10 실패 (TestRestTemplate만)
- `clean test build`: **미실행** (test 10건 실패로 build 단계 동일 실패 예상)
- `git diff --check`: **통과**
- springdoc runtime smoke: **미실행** (후속)
- `spring-boot-jackson2` compatibility module: **추가하지 않음** (Jackson 3 native migration 유지)

---

## 6. 미해결 / 후속 관찰 항목 (Jackson 작업 후 갱신)
- ~~**[블로커] Jackson 2 → Jackson 3 마이그레이션**~~ → **Jackson HTTP/테스트 경로 해소** (129→10 실패). Hibernate JSON 컬럼은 Jackson 2 kotlin module 병행 유지.
- **`@AutoConfigureTestRestTemplate` 추가** (ErrorStatusUnmaskTest, ErrorResponseBodyContractTest 2개 파일) — **남은 10건**.
- **springdoc 3.0.3 런타임 검증 미완** — 컴파일/context-load 는 통과했으나 Swagger UI/`/v3/api-docs` local 노출·prod 비활성·JWT scheme·PathPattern·Kotlin nullable schema 는 smoke 단계(미실행)에서 확인 예정.
- **3.5.x 최신화(3.5.16) 선행 여부** — 현재 3.5.0. Boot 4.1 직행 전에 3.5.16 으로 올려 deprecation 경고를 먼저 정리하는 단계적 접근 권장.
- Kotlin KT-73255 경고 정리(`-Xannotation-default-target` 또는 `@param:`) — 선택.

## 7. 실제 migration PR 로 진행 가능 여부 & 판단
- **결론: 지금 바로 단일 PR 로 머지하기에는 이르다. 단, 마이그레이션 경로는 명확하고 실현 가능하다.**
  - 근거(가능성 긍정): Spring Framework 7 / Hibernate 7 / Security 7 / Servlet 6.1(Tomcat 11) / JPA·H2 / Actuator / CORS 관점에서는 **컴파일·context 기동·413개 테스트 통과**로 큰 구조적 장애가 없음. Boot/Kotlin/Gradle/Java 호환성도 확인됨(Gradle 8.14.5, Java 21 유지 가능).
  - 근거(보류 사유): 유일한 실질 블로커가 **Jackson 2→3** 이며 이는 직렬화 계약에 직접 닿는 변경이라, 회귀 테스트를 통과시키는 전용 작업으로 분리해야 함.
- **권장 순서(후속 실제 migration PR 분할):**
  1. (선택·선행) Boot 3.5.16 최신화 + deprecation 정리.
  2. Boot 4.1 + Kotlin 2.3.21 + test slice 모듈 분리 대응(본 spike 의 A~D) + `@AutoConfigureTestRestTemplate`.
  3. **Jackson 3 마이그레이션**(kotlin 모듈 v3 교체 + 테스트 ObjectMapper 타입 교체) 후 전체 테스트 green 확인. 이 단계가 계약 회귀 게이트.
  4. springdoc 3.0.3 런타임/prod 정책 smoke 확인.

## 8. rollback plan
- 이 spike 는 별도 브랜치(`spike/...`)이며 develop 에 머지하지 않는다. 폐기 시 브랜치 삭제로 원복.
- 실제 migration 진행 시: build.gradle.kts 버전 6줄 + 의존성 1줄 + 소스 nullability/import 치환이 전부이므로,
  `git revert` 또는 브랜치 되돌리기로 즉시 3.5.0 상태 복귀 가능. DB schema/API contract 변경이 없어 데이터 rollback 불필요.
