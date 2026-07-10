plugins {
	kotlin("jvm") version "2.4.0"
	kotlin("kapt") version "2.4.0"
	kotlin("plugin.spring") version "2.4.0"
	kotlin("plugin.jpa") version "2.4.0"
	id("org.springframework.boot") version "4.1.0"
	id("io.spring.dependency-management") version "1.1.7"
}

group = "com.dasida"
version = "0.0.1-SNAPSHOT"

java {
	toolchain {
		languageVersion = JavaLanguageVersion.of(21)
	}
}

repositories {
	mavenCentral()
}

dependencies {
	implementation("org.springframework.boot:spring-boot-starter-actuator")
	implementation("org.springframework.boot:spring-boot-starter-web")
	implementation("org.springframework.boot:spring-boot-starter-websocket")
	implementation("org.springframework.boot:spring-boot-starter-data-jpa")
	// 스키마 마이그레이션(db/migration). Boot 4 는 자동구성이 모듈로 분리되어
	// flyway-core 만으로는 동작하지 않고 starter-flyway 가 필요하다. MySQL 8 은 flyway-mysql 추가.
	implementation("org.springframework.boot:spring-boot-starter-flyway")
	implementation("org.flywaydb:flyway-mysql")
	implementation("org.springframework.boot:spring-boot-starter-data-redis")
	implementation("org.springframework.boot:spring-boot-starter-security")
	implementation("tools.jackson.module:jackson-module-kotlin")
	// Hibernate @JdbcTypeCode(JSON) 는 HibernateJsonFormatMapperConfig 에서 Jackson 3 JsonMapper로 연결한다.
	implementation("org.jetbrains.kotlin:kotlin-reflect")
	// OpenAPI 3 문서 자동 생성 + Swagger UI.
	// [spike] Boot 4.1(Spring 7) 대응으로 springdoc 3.x 라인으로 상향. springdoc 3.0.3 은
	// Spring Framework 7 / Servlet 6.1 기준이며, 이전 2.8.x 는 Boot 3.5 기준이었다.
	implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:3.0.3")
	implementation("io.github.openfeign.querydsl:querydsl-jpa:7.4.0")
	kapt("io.github.openfeign.querydsl:querydsl-apt:7.4.0:jpa")
	kapt("jakarta.persistence:jakarta.persistence-api")
	kapt("jakarta.annotation:jakarta.annotation-api")
	// JWT (jjwt)
	implementation("io.jsonwebtoken:jjwt-api:0.13.0")
	runtimeOnly("io.jsonwebtoken:jjwt-impl:0.13.0")
	runtimeOnly("io.jsonwebtoken:jjwt-jackson:0.13.0")
	runtimeOnly("com.mysql:mysql-connector-j")
	testImplementation("org.springframework.boot:spring-boot-starter-test")
	// [spike] Boot 4 에서 test slice(@AutoConfigureMockMvc/MockMvc)가 기술별 모듈로 분리됨.
	// spring-boot-starter-test 는 더 이상 webmvc test slice 를 전이 포함하지 않아 별도 추가한다.
	testImplementation("org.springframework.boot:spring-boot-starter-webmvc-test")
	// [spike] Boot 4 TestRestTemplate 자동구성은 분리된 RestTemplateBuilder 모듈을 요구한다.
	testImplementation("org.springframework.boot:spring-boot-starter-restclient")
	testImplementation("org.springframework.security:spring-security-test")
	testImplementation("org.jetbrains.kotlin:kotlin-test-junit5")
	testRuntimeOnly("com.h2database:h2")
	testRuntimeOnly("org.junit.platform:junit-platform-launcher")
	// 실제 MySQL 8 에서 Flyway 마이그레이션 + ddl validate 를 검증하는 스모크 테스트용
	// (일반 테스트는 H2 — 마이그레이션 SQL 은 MySQL 전용이라 배포 전 커버리지가 0이었다).
	// Docker 미가동 환경에서는 @Testcontainers(disabledWithoutDocker) 로 자동 스킵된다.
	// Boot 4.1 BOM 이 testcontainers 버전을 관리하지 않아 BOM 을 직접 고정한다.
	testImplementation(platform("org.testcontainers:testcontainers-bom:1.21.3"))
	testImplementation("org.springframework.boot:spring-boot-testcontainers")
	testImplementation("org.testcontainers:junit-jupiter")
	testImplementation("org.testcontainers:mysql")
}

kotlin {
	compilerOptions {
		freeCompilerArgs.addAll("-Xjsr305=strict")
	}
}

tasks.withType<Test> {
	useJUnitPlatform()
}
