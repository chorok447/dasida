plugins {
	kotlin("jvm") version "1.9.25"
	kotlin("kapt") version "1.9.25"
	kotlin("plugin.spring") version "2.4.0"
	kotlin("plugin.jpa") version "1.9.25"
	id("org.springframework.boot") version "3.5.0"
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
	implementation("org.springframework.boot:spring-boot-starter-data-jpa")
	implementation("org.springframework.boot:spring-boot-starter-security")
	implementation("com.fasterxml.jackson.module:jackson-module-kotlin")
	implementation("org.jetbrains.kotlin:kotlin-reflect")
	// OpenAPI 3 문서 자동 생성 + Swagger UI.
	// 2.8.15 는 swagger-ui 리소스에 '/**/*swagger-initializer.js' 같은 '**' 중간 패턴을 넣는데,
	// 그 파싱 수정(Spring Web #34986)은 6.2.8(Boot 3.5.1+)부터다. 현재 Boot 3.5.0(Spring 6.2.7)
	// 에서는 PathPattern 파서가 이를 거부해 컨텍스트 기동이 실패한다. 해당 패턴이 없는 2.8.14 로 고정.
	implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:2.8.14")
	implementation("io.github.openfeign.querydsl:querydsl-jpa:7.4.0")
	kapt("io.github.openfeign.querydsl:querydsl-apt:7.4.0:jpa")
	kapt("jakarta.persistence:jakarta.persistence-api")
	kapt("jakarta.annotation:jakarta.annotation-api")
	// JWT (jjwt)
	implementation("io.jsonwebtoken:jjwt-api:0.12.6")
	runtimeOnly("io.jsonwebtoken:jjwt-impl:0.12.6")
	runtimeOnly("io.jsonwebtoken:jjwt-jackson:0.12.6")
	runtimeOnly("com.mysql:mysql-connector-j")
	testImplementation("org.springframework.boot:spring-boot-starter-test")
	testImplementation("org.springframework.security:spring-security-test")
	testImplementation("org.jetbrains.kotlin:kotlin-test-junit5")
	testRuntimeOnly("com.h2database:h2")
	testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

kotlin {
	compilerOptions {
		freeCompilerArgs.addAll("-Xjsr305=strict")
	}
}

tasks.withType<Test> {
	useJUnitPlatform()
}
