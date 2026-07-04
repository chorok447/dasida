# Spring Boot 4.1 마이그레이션 검증

> 원래 spike(`spike/spring-boot-4-1-migration-check`)로 검증했으나, **PR #121**이 develop에 merge됨 (merge commit `f1874e6`, 2026-07-02).
> develop HEAD: `f1874e6` — Spring Boot **4.1.0** / Kotlin **2.3.21** / springdoc **3.0.3** 이 기본 상태.
> spike 당시 기준 develop HEAD: `ead3ecd` (Boot 3.5.0).

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
- `testImplementation("org.springframework.boot:spring-boot-starter-restclient")` **추가**
  - Boot 4 `TestRestTemplate` 자동구성에 필요한 분리된 `RestTemplateBuilder` 모듈을 test classpath 에 제공

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
- 적용 수정: import 치환 + `@AutoConfigureTestRestTemplate` 추가
- 추가 test 의존성: `spring-boot-starter-restclient` (`RestTemplateBuilder` 제공)

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
- **실행 완료** (2026-07-02, 섹션 11 참조). develop merge 이후 post-merge 재확인 포함.

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
- springdoc runtime smoke: **실행 완료** (섹션 11)
- `spring-boot-jackson2` compatibility module: **추가하지 않음** (Jackson 3 native migration 유지)

## 10. TestRestTemplate 자동구성 작업 (2026-07-02, spike 브랜치 후속)

### 원인
- Boot 4 에서는 `@SpringBootTest(webEnvironment = RANDOM_PORT)` 만으로
  `TestRestTemplate` bean 이 등록되지 않는다.
- `@AutoConfigureTestRestTemplate` 적용 후에는 분리된
  `org.springframework.boot.restclient.RestTemplateBuilder`가 test classpath 에 없어
  `NoClassDefFoundError`가 발생했다.
- 따라서 status/body assertion 문제가 아니라 Boot 4 테스트 자동구성과 모듈 분리가
  원인이었다.

### 적용 변경
- `ErrorStatusUnmaskTest`, `ErrorResponseBodyContractTest`에
  `org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate`
  import와 annotation 추가
- test scope에 `spring-boot-starter-restclient` 추가
- 기존 status/body assertion, production code, Jackson helper는 변경하지 않음

### 작업 전 / 후 test 결과
| 시점 | 통과 | 실패 | 비고 |
| --- | --- | --- | --- |
| TestRestTemplate 작업 전 | 532 | **10** | 자동구성 실패 10건 |
| TestRestTemplate 작업 후 | **542** | **0** | 전체 테스트 통과 |

### 검증
- `ErrorStatusUnmaskTest`: **6/6 통과**
- `ErrorResponseBodyContractTest`: **4/4 통과**
- `clean test`: **542/542 통과**
- `clean test build`: **성공**
- `git diff --check`: **통과**
- springdoc runtime smoke: **실행 완료** (섹션 11)

---

## 11. Runtime smoke (2026-07-02, post-merge 검증)

검증-only. SecurityConfig/CORS/OpenAPI/Actuator **정책 코드 변경 없음**. production code 변경 없음.

### merge / 검증 기준
| 항목 | 값 |
| --- | --- |
| PR | **#121** `chore: Spring Boot 4.1 마이그레이션 검증` — **merged** (draft 아님) |
| merge commit | `f1874e6` |
| smoke 수행 기준 | develop `f1874e6` (PR #121 merge 이후) |
| spike 브랜치 | `spike/spring-boot-4-1-migration-check` (head `d841b59`) |

### 사전 검증 (develop 기준)
| 항목 | 결과 |
| --- | --- |
| `./gradlew clean test build --no-daemon` | **성공** (542/542) |
| `git diff --check` | **통과** |

### local profile `bootRun` (`--spring.profiles.active=local`)
- **기동 성공** (포트 8080). MySQL docker(`dasida-mysql`) 연결 정상.
- Spring Boot **4.1.0**, Tomcat **11.0.22**, Hibernate ORM **7.4.1.Final**, MySQL **8.4.10**, HikariCP 정상.
- Security filter chain·springdoc bean 기동 시 runtime exception 없음.
- springdoc 기동 WARN(prod 비활성 권고)만 출력 — local 에서는 정상.

| endpoint | HTTP | 비고 |
| --- | --- | --- |
| `/actuator/health` | **200** | body: `{"groups":["liveness","readiness"],"status":"UP"}` — `details`/`components` **미노출** |
| `/v3/api-docs` | **200** | springdoc 3.0.3 정상 |
| `/swagger-ui/index.html` | **200** | |
| `/actuator/env` | **401** | |
| `/actuator/beans` | **401** | |
| `/actuator/configprops` | **401** | |
| `/actuator/mappings` | **401** | |
| `/actuator/metrics` | **401** | |
| `/actuator/loggers` | **401** | |
| `/actuator/threaddump` | **401** | |
| `/actuator/heapdump` | **401** | |

민감 actuator endpoint **200 노출 없음** (401 = SecurityConfig deny).

### prod profile `bootRun`
- **기동 성공**. 필수 env (실제 비밀값 문서 미기록):
  - `APP_CORS_ALLOWED_ORIGINS=https://example.com` (prod CORS guard 통과용 더미 origin)
  - `JWT_SECRET` = 테스트용 더미 값(≥32바이트, `dev-insecure` 접두사 아님 — `JwtService` prod guard 와 동일 패턴)
  - DB: `application.properties` 기본 MySQL(docker) 사용
- prod 기동 불가 사유: **없음** (로컬 docker MySQL + 위 env 로 smoke 가능)

| endpoint | HTTP | 비고 |
| --- | --- | --- |
| `/actuator/health` | **200** | `details`/`components` 미노출 |
| `/v3/api-docs` | **404** | `application-prod.yml` springdoc 비활성 — **정책 준수** |
| `/swagger-ui/index.html` | **404** | **정책 준수** |
| 민감 actuator (`env`/`beans`/…) | **401** | local 과 동일 |

### CORS smoke
| profile | Origin | 결과 |
| --- | --- | --- |
| local | `http://localhost:3000` | **200**, `Access-Control-Allow-Origin` 반환, `Allow-Credentials: true` |
| local | `http://127.0.0.1:3000` | **200**, 동일 |
| local | preflight `Authorization, Content-Type, Accept` | **Allow-Headers** 에 포함 |
| prod | `https://example.com` (설정 origin) | **200**, `Access-Control-Allow-Origin: https://example.com` |
| prod | `http://localhost:3000` | **403**, localhost **미허용** — prod 정책 유지 |

wildcard `*` 사용 없음. 기존 CORS profile 정책과 일치.

### OpenAPI `/v3/api-docs` sanity (local)
| 항목 | 결과 |
| --- | --- |
| JWT Bearer scheme | **`bearerAuth`** (`scheme: bearer`, `bearerFormat: JWT`) 유지 |
| 총 path 수 | **40** |
| auth paths | 5 |
| posts paths | 13 |
| campaigns paths | 14 |
| notifications paths | 6 |
| reports paths | 2 |
| Page response schemas | `PostPageResponse`, `CampaignPageResponse`, `ReportsPageResponse` 등 — `content`/`page`/`size`/`totalElements`/`totalPages` 필드 유지 |
| `nullable: true` schema | **0건** — OpenAPI 3.1 / Jackson 3 nullable 표현 변화 가능성, 프론트 codegen 영향은 후속 관찰 |

springdoc 3.x **runtime 문제 없음**.

---

## 6. 미해결 / 후속 관찰 항목 (post-merge, runtime smoke 후 갱신)
- ~~**[블로커] Jackson 2 → Jackson 3 마이그레이션**~~ → **해소** (develop merge 완료). Hibernate JSON 컬럼은 Jackson 2 kotlin module 병행 유지.
- ~~**`@AutoConfigureTestRestTemplate` 추가**~~ → **해소** (542/542 통과).
- ~~**springdoc 3.0.3 런타임 검증**~~ → **해소** (섹션 11: local 200 / prod 404, JWT scheme·주요 path·Page schema sanity OK).
- **Boot 3.5.16 최신화** — Boot 4.1 이 이미 develop 에 들어갔으므로 “선행” 단계는 해당 없음. rollback·비교 검토가 필요할 때만 별도 판단.
- **Hibernate JSON → Jackson 3 FormatMapper 통합** — Jackson 2 kotlin module 병행 제거 검토.
- **OpenAPI nullable 표현 변화** — 프론트 codegen 영향 확인.
- **Kotlin KT-73255 경고 정리** (`-Xannotation-default-target` 또는 `@param:`) — 선택.
- **Dependabot PR #113** (next 16.2.10) — `minimumReleaseAge` cutoff 미충족으로 **보류 유지**. 정책 우회 없음.

## 7. develop merge 이후 상태 & 판단
- **결론: PR #121 merge + runtime smoke 완료. develop 은 Boot 4.1 기준으로 안정화 검증됨.**
  - 542 test + build 통과, local/prod runtime smoke 통과, springdoc·Actuator·CORS 정책 회귀 없음.
  - spike 단계에서 계획했던 migration 항목(A~D, Jackson 3, TestRestTemplate, springdoc smoke)은 develop 에 반영 완료.
- **남은 후속은 운영 안정화·관찰 항목**(섹션 6)이며, 별도 PR 로 분할 진행 권장.

## 8. rollback plan (post-merge 갱신)
- Boot 4.1 은 **이미 develop 에 merge**됨 (`f1874e6`). 평소 spike 폐기(브랜치 삭제)와 달리, 되돌리려면 `git revert f1874e6`(또는 PR #121 revert PR)이 필요.
- revert 범위: build.gradle.kts 버전·의존성 + nullability/import 치환. DB schema/API contract 변경 없어 데이터 rollback 불필요.
- runtime smoke 결과(섹션 11)는 rollback 판단 시 “Boot 4.1 이 develop 에서 실제로 기동·노출 정책을 유지하는지” 근거로 사용.
