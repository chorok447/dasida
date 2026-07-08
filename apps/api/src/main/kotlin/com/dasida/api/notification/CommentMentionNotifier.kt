package com.dasida.api.notification

import com.dasida.api.auth.UserRepository
import org.springframework.stereotype.Service

/**
 * 댓글 텍스트의 @이름 멘션을 언급된 사용자 알림으로 전달한다. 호출자(댓글 작성) 트랜잭션에 참여한다.
 *
 * 해석 규칙:
 * - 토큰은 `@` 뒤 연속 문자(한글·영숫자·`._-`). "@김철수님 감사해요"처럼 조사·꼬리가 붙으면
 *   토큰의 가장 긴 prefix 와 일치하는 사용자 이름으로 해석한다.
 * - 같은 이름의 활성 사용자가 여러 명이면 모호하므로 알림을 보내지 않는다.
 * - 본인 멘션과 exclude(같은 댓글로 이미 댓글/답글 알림을 받은 수신자)는 제외해 중복 알림을 막는다.
 */
@Service
class CommentMentionNotifier(
    private val users: UserRepository,
    private val notifications: NotificationService,
) {
    fun notifyMentions(
        text: String,
        actorUserId: Long,
        actorName: String,
        href: String,
        excludeUserIds: Set<Long> = emptySet(),
    ) {
        val tokens = mentionTokens(text)
        if (tokens.isEmpty()) return

        val candidates = tokens.flatMapTo(mutableSetOf()) { token ->
            (1..token.length).map { token.substring(0, it) }
        }
        val usersByName = users.findByNameInAndDeletedAtIsNull(candidates).groupBy { it.name }
        if (usersByName.isEmpty()) return

        val recipientIds = tokens.mapNotNullTo(mutableSetOf()) { token ->
            val name = (token.length downTo 1).asSequence()
                .map { token.substring(0, it) }
                .firstOrNull(usersByName::containsKey)
                ?: return@mapNotNullTo null
            // 동명이인은 모호 → 생략.
            usersByName.getValue(name).singleOrNull()?.id
        }

        for (recipientId in recipientIds) {
            if (recipientId in excludeUserIds) continue
            notifications.notify(
                recipientUserId = recipientId,
                actorUserId = actorUserId,
                type = NotificationType.COMMENT_MENTIONED,
                title = "${actorName}님이 댓글에서 회원님을 언급했습니다",
                body = text,
                href = href,
            )
        }
    }

    companion object {
        /** 댓글당 처리하는 최대 멘션 수. 초과분은 무시한다. */
        private const val MAX_MENTIONS = 10

        /** prefix 후보를 만드는 토큰 길이 상한(이름 최대 길이보다 넉넉하게). */
        private const val MAX_TOKEN_LENGTH = 20

        private val MENTION_RE = Regex("""@([\p{L}\p{N}._-]+)""")

        internal fun mentionTokens(text: String): List<String> =
            MENTION_RE.findAll(text)
                .map { it.groupValues[1].take(MAX_TOKEN_LENGTH) }
                .distinct()
                .take(MAX_MENTIONS)
                .toList()
    }
}
