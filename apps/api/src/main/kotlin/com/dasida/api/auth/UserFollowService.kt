package com.dasida.api.auth

import com.dasida.api.common.checkPageParams
import com.dasida.api.notification.NotificationService
import com.dasida.api.notification.NotificationType
import com.dasida.api.post.PostRepository
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.Clock
import java.time.Instant
import java.util.UUID

@Service
class UserFollowService(
    private val follows: UserFollowRepository,
    private val users: UserRepository,
    private val posts: PostRepository,
    private val authService: AuthService,
    private val notifications: NotificationService,
    private val clock: Clock,
) {
    @Transactional(readOnly = true)
    fun getPublicProfile(userId: Long, viewerId: Long?): PublicUserResponse {
        val user = authService.publicUser(userId)
        return toPublicUser(user, viewerId)
    }

    @Transactional(readOnly = true)
    fun isFollowing(followerId: Long, followeeId: Long): FollowStatusResponse =
        FollowStatusResponse(followed = follows.existsByFollowerIdAndFolloweeId(followerId, followeeId))

    @Transactional
    fun follow(followerId: Long, followeeId: Long) {
        if (followerId == followeeId) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "cannot follow yourself")
        }
        authService.publicUser(followeeId)
        if (follows.existsByFollowerIdAndFolloweeId(followerId, followeeId)) return

        follows.save(
            UserFollow(
                id = "uf-${UUID.randomUUID()}",
                followerId = followerId,
                followeeId = followeeId,
                createdAt = Instant.now(clock),
            ),
        )
        val follower = users.findById(followerId).orElse(null) ?: return
        notifications.notify(
            recipientUserId = followeeId,
            actorUserId = followerId,
            type = NotificationType.USER_FOLLOWED,
            title = "새 팔로워",
            body = "${follower.name}님이 회원님을 팔로우했어요.",
            href = "/users/$followerId",
        )
    }

    @Transactional
    fun unfollow(followerId: Long, followeeId: Long) {
        follows.deleteByFollowerIdAndFolloweeId(followerId, followeeId)
    }

    @Transactional(readOnly = true)
    fun recommended(viewerId: Long, size: Int): RecommendedUsersResponse {
        val limit = size.coerceIn(1, MAX_RECOMMEND_SIZE)
        val authorIds = follows.findRecommendedAuthorIds(
            viewerId,
            PageRequest.of(0, limit),
        )
        return RecommendedUsersResponse(
            items = authorIds.mapNotNull { id ->
                users.findById(id).orElse(null)?.takeIf { it.deletedAt == null }?.let { toPublicUser(it, viewerId) }
            },
        )
    }

    @Transactional(readOnly = true)
    fun followingPage(viewerId: Long, page: Int, size: Int): PublicUserPageResponse {
        checkPageParams(page, size, MAX_PAGE_SIZE)
        val result = follows.findByFollowerId(
            viewerId,
            PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")),
        )
        return userFollowPage(result, viewerId)
    }

    @Transactional(readOnly = true)
    fun followersPage(userId: Long, viewerId: Long, page: Int, size: Int): PublicUserPageResponse {
        authService.publicUser(userId)
        checkPageParams(page, size, MAX_PAGE_SIZE)
        val result = follows.findByFolloweeId(
            userId,
            PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")),
        )
        return userFollowPage(result, viewerId, followeeSide = false)
    }

    @Transactional(readOnly = true)
    fun followeeIdsFor(viewerId: Long): List<Long> = follows.findFolloweeIdsByFollowerId(viewerId)

    @Transactional
    fun deleteAllForUser(userId: Long) {
        follows.deleteAllForUser(userId)
    }

    private fun userFollowPage(
        result: org.springframework.data.domain.Page<UserFollow>,
        viewerId: Long,
        followeeSide: Boolean = true,
    ): PublicUserPageResponse {
        val content = result.content.mapNotNull { row ->
            val targetId = if (followeeSide) row.followeeId else row.followerId
            users.findById(targetId).orElse(null)?.takeIf { it.deletedAt == null }?.let { toPublicUser(it, viewerId) }
        }
        return PublicUserPageResponse(
            content = content,
            page = result.number,
            size = result.size,
            totalElements = result.totalElements,
            totalPages = result.totalPages,
        )
    }

    private fun toPublicUser(user: User, viewerId: Long?): PublicUserResponse {
        val id = requireNotNull(user.id)
        return PublicUserResponse(
            id = id,
            name = user.name,
            verified = user.verified,
            profileImageUrl = user.profileImageUrl,
            postCount = posts.countByAuthorUserId(id),
            followerCount = follows.countByFolloweeId(id),
            followingCount = follows.countByFollowerId(id),
            followedByMe = viewerId?.let { follows.existsByFollowerIdAndFolloweeId(it, id) },
        )
    }

    private companion object {
        const val MAX_PAGE_SIZE = 100
        const val MAX_RECOMMEND_SIZE = 10
    }
}
