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
    private val userBlocks: UserBlockService,
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
        return RecommendedUsersResponse(items = toPublicUsersOrdered(authorIds, viewerId))
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

    /** 내가 차단한 사용자 목록(최근 차단 순). 차단 관리 화면용. */
    @Transactional(readOnly = true)
    fun blockedPage(viewerId: Long, page: Int, size: Int): PublicUserPageResponse {
        checkPageParams(page, size, MAX_PAGE_SIZE)
        val result = userBlocks.blockedRowsPage(
            viewerId,
            PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")),
        )
        return PublicUserPageResponse(
            content = toPublicUsersOrdered(result.content.map { it.blockedId }, viewerId),
            page = result.number,
            size = result.size,
            totalElements = result.totalElements,
            totalPages = result.totalPages,
        )
    }

    @Transactional(readOnly = true)
    fun searchUsers(q: String, viewerId: Long?, page: Int, size: Int): PublicUserPageResponse {
        checkPageParams(page, size, MAX_PAGE_SIZE)
        val query = q.trim()
        if (query.length > MAX_QUERY_LENGTH) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "q must not exceed $MAX_QUERY_LENGTH characters")
        }
        // 빈 검색어로 전체 회원을 나열하지 않는다.
        if (query.isEmpty()) {
            return PublicUserPageResponse(content = emptyList(), page = page, size = size, totalElements = 0, totalPages = 0)
        }
        val result = users.searchPublic(
            query.lowercase(),
            Instant.now(clock),
            PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "id")),
        )
        return PublicUserPageResponse(
            content = toPublicUsers(result.content, viewerId),
            page = result.number,
            size = result.size,
            totalElements = result.totalElements,
            totalPages = result.totalPages,
        )
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
        val targetIds = result.content.map { if (followeeSide) it.followeeId else it.followerId }
        return PublicUserPageResponse(
            content = toPublicUsersOrdered(targetIds, viewerId),
            page = result.number,
            size = result.size,
            totalElements = result.totalElements,
            totalPages = result.totalPages,
        )
    }

    /** id 목록 순서를 보존해 bulk 매핑한다. 탈퇴 사용자는 결과에서 제외(기존 목록 규칙 유지). */
    private fun toPublicUsersOrdered(targetIds: List<Long>, viewerId: Long?): List<PublicUserResponse> {
        if (targetIds.isEmpty()) return emptyList()
        val usersById = users.findAllById(targetIds.distinct())
            .filter { it.deletedAt == null }
            .associateBy { requireNotNull(it.id) }
        return toPublicUsers(targetIds.mapNotNull { usersById[it] }, viewerId)
    }

    /**
     * 사용자 목록을 bulk 5쿼리(게시글 수·팔로워 수·팔로잉 수 group by + 팔로우/차단 상태 IN)로 매핑한다.
     * 기존에는 사용자마다 카운트 3 + 상태 2 쿼리가 나가 page 10 기준 요청당 50+ 쿼리였다.
     */
    private fun toPublicUsers(targets: List<User>, viewerId: Long?): List<PublicUserResponse> {
        if (targets.isEmpty()) return emptyList()
        val ids = targets.map { requireNotNull(it.id) }
        val postCounts = posts.countByAuthorUserIdsAndHiddenAtIsNull(ids).associate { it.authorUserId to it.count }
        val followerCounts = follows.countByFolloweeIds(ids).associate { it.userId to it.count }
        val followingCounts = follows.countByFollowerIds(ids).associate { it.userId to it.count }
        val followedIds = viewerId?.let { follows.findFollowedIdsAmong(it, ids).toSet() }
        val blockedIds = viewerId?.let { userBlocks.blockedIdsAmong(it, ids).toSet() }
        return targets.map { user ->
            val id = requireNotNull(user.id)
            PublicUserResponse(
                id = id,
                name = user.name,
                verified = user.verified,
                profileImageUrl = user.profileImageUrl,
                postCount = postCounts[id] ?: 0,
                followerCount = followerCounts[id] ?: 0,
                followingCount = followingCounts[id] ?: 0,
                followedByMe = followedIds?.contains(id),
                blockedByMe = blockedIds?.contains(id),
            )
        }
    }

    private fun toPublicUser(user: User, viewerId: Long?): PublicUserResponse =
        toPublicUsers(listOf(user), viewerId).first()

    private companion object {
        const val MAX_PAGE_SIZE = 100
        const val MAX_RECOMMEND_SIZE = 10
        const val MAX_QUERY_LENGTH = 100
    }
}
