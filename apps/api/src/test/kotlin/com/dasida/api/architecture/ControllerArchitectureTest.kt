package com.dasida.api.architecture

import com.dasida.api.auth.AuthController
import com.dasida.api.campaign.CampaignController
import com.dasida.api.notification.NotificationController
import com.dasida.api.post.PostController
import com.dasida.api.report.ReportController
import org.junit.jupiter.api.Test
import org.springframework.transaction.annotation.Transactional
import kotlin.reflect.KClass
import kotlin.reflect.full.declaredMemberFunctions
import kotlin.reflect.full.findAnnotation
import kotlin.reflect.full.primaryConstructor
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Controller 회귀 방지 구조 테스트.
 *
 * PR #63~#66 으로 각 Controller 를 HTTP adapter(라우팅/인증 사용자 추출/status code/Service 위임)로
 * 정리했다. 이후 다시 Repository/PasswordEncoder/JwtService/Clock 같은 인프라 의존성이나 트랜잭션이
 * Controller 로 새어드는 것을 막기 위해, 새 test dependency(ArchUnit 등) 없이 Kotlin reflection 으로만
 * 구조를 고정한다.
 */
class ControllerArchitectureTest {

    private val controllers: List<KClass<*>> = listOf(
        AuthController::class,
        NotificationController::class,
        ReportController::class,
        PostController::class,
        CampaignController::class,
    )

    /** Controller 생성자에 들어오면 안 되는 인프라 의존성 타입 이름 마커. */
    private val forbiddenDependencyMarkers = listOf("Repository", "PasswordEncoder", "JwtService", "Clock")

    @Test
    fun `controller 는 인프라 타입을 직접 주입받지 않는다`() {
        controllers.forEach { controller ->
            val params = controller.primaryConstructor?.parameters.orEmpty()
            params.forEach { param ->
                val typeName = (param.type.classifier as? KClass<*>)?.simpleName.orEmpty()
                forbiddenDependencyMarkers.forEach { marker ->
                    assertTrue(
                        !typeName.contains(marker),
                        "${controller.simpleName} 가 금지된 의존성을 주입받고 있습니다: $typeName (marker=$marker)",
                    )
                }
            }
        }
    }

    @Test
    fun `controller 클래스와 메서드에 @Transactional 이 없다`() {
        controllers.forEach { controller ->
            assertNull(
                controller.findAnnotation<Transactional>(),
                "${controller.simpleName} 클래스에 @Transactional 이 붙어 있습니다",
            )
            controller.declaredMemberFunctions.forEach { function ->
                assertNull(
                    function.findAnnotation<Transactional>(),
                    "${controller.simpleName}.${function.name} 에 @Transactional 이 붙어 있습니다",
                )
            }
        }
    }
}
