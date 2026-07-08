package com.dasida.api.post

import com.dasida.api.common.QUERYDSL_LIKE_ESCAPE
import com.dasida.api.common.literalContainsPattern
import com.dasida.api.common.literalJsonElementPattern
import com.querydsl.core.BooleanBuilder
import com.querydsl.core.types.OrderSpecifier
import com.querydsl.core.types.dsl.Expressions
import com.querydsl.jpa.impl.JPAQueryFactory
import org.springframework.stereotype.Repository

enum class PostSearchSort {
    LATEST,
    POPULAR,
    DISCUSSED,
}

data class PostSearchCondition(
    val query: String?,
    val tag: String?,
    val campaignOnly: Boolean,
    val authorUserIds: List<Long>?,
    val sort: PostSearchSort,
    val page: Int,
    val size: Int,
)

data class PostSearchResult(
    val content: List<Post>,
    val totalElements: Long,
)

interface PostSearchRepository {
    fun search(condition: PostSearchCondition): PostSearchResult
}

@Repository
class QuerydslPostSearchRepository(
    private val queryFactory: JPAQueryFactory,
) : PostSearchRepository {
    override fun search(condition: PostSearchCondition): PostSearchResult {
        val post = QPost.post
        val predicates = BooleanBuilder()
        // 숨김 콘텐츠는 공개 검색에서 항상 제외.
        predicates.and(post.hiddenAt.isNull)

        condition.query?.let { query ->
            val pattern = literalContainsPattern(query)
            predicates.and(
                post.text.lower().like(pattern, QUERYDSL_LIKE_ESCAPE)
                    .or(post.author.name.lower().like(pattern, QUERYDSL_LIKE_ESCAPE)),
            )
        }
        condition.tag?.let { tag ->
            // tags 는 JSON 배열 컬럼. 직렬화 문자열에서 따옴표 감싼 원소 일치로 특정 태그를 찾는다.
            predicates.and(
                Expressions.stringTemplate("cast({0} as string)", post.tags)
                    .lower()
                    .like(literalJsonElementPattern(tag), QUERYDSL_LIKE_ESCAPE),
            )
        }
        if (condition.campaignOnly) predicates.and(post.campaignId.isNotNull)
        condition.authorUserIds?.let { authorIds ->
            if (authorIds.isEmpty()) {
                return PostSearchResult(content = emptyList(), totalElements = 0)
            }
            predicates.and(post.authorUserId.`in`(authorIds))
        }

        val content = queryFactory
            .selectFrom(post)
            .where(predicates)
            .orderBy(*orderSpecifiers(post, condition.sort))
            .offset(condition.page.toLong() * condition.size)
            .limit(condition.size.toLong())
            .fetch()

        val totalElements = queryFactory
            .select(post.count())
            .from(post)
            .where(predicates)
            .fetchOne() ?: 0L

        return PostSearchResult(content = content, totalElements = totalElements)
    }

    private fun orderSpecifiers(post: QPost, sort: PostSearchSort): Array<OrderSpecifier<*>> =
        when (sort) {
            PostSearchSort.LATEST -> arrayOf(post.seq.desc(), post.id.asc())
            PostSearchSort.POPULAR -> arrayOf(post.likes.desc(), post.seq.desc(), post.id.asc())
            PostSearchSort.DISCUSSED -> arrayOf(post.comments.desc(), post.seq.desc(), post.id.asc())
        }
}
