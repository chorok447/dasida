plugins {
	// Auto-provisions the JDK 21 toolchain when the dev machine lacks it.
	id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0"
}

rootProject.name = "api"
