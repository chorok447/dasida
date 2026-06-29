package com.dasida.api.campaign

import com.dasida.api.common.QUERYDSL_LIKE_ESCAPE
import com.dasida.api.common.literalContainsPattern
import com.querydsl.core.BooleanBuilder
import com.querydsl.core.types.dsl.CaseBuilder
import com.querydsl.core.types.OrderSpecifier
import com.querydsl.jpa.impl.JPAQueryFactory
import org.springframework.stereotype.Repository

enum class CampaignSearchSort {
    LATEST,
    POPULAR,
    DEADLINE,
}

data class CampaignSearchCondition(
    val query: String?,
    val status: String?,
    val availableOnly: Boolean,
    val today: String,
    val sort: CampaignSearchSort,
    val page: Int,
    val size: Int,
)

data class CampaignSearchResult(
    val content: List<Campaign>,
    val totalElements: Long,
)

interface CampaignSearchRepository {
    fun search(condition: CampaignSearchCondition): CampaignSearchResult
}

@Repository
class QuerydslCampaignSearchRepository(
    private val queryFactory: JPAQueryFactory,
) : CampaignSearchRepository {
    override fun search(condition: CampaignSearchCondition): CampaignSearchResult {
        val campaign = QCampaign.campaign
        val predicates = BooleanBuilder()

        condition.query?.let { query ->
            val pattern = literalContainsPattern(query)
            predicates.and(
                campaign.title.lower().like(pattern, QUERYDSL_LIKE_ESCAPE)
                    .or(campaign.summary.lower().like(pattern, QUERYDSL_LIKE_ESCAPE)),
            )
        }
        condition.status?.let { predicates.and(campaign.status.eq(it)) }
        if (condition.availableOnly) {
            predicates.and(campaign.status.eq("open"))
            predicates.and(campaign.joined.lt(campaign.capacity))
            predicates.and(campaign.recruitStart.loe(condition.today))
            predicates.and(campaign.recruitEnd.goe(condition.today))
        }

        val content = queryFactory
            .selectFrom(campaign)
            .where(predicates)
            .orderBy(*orderSpecifiers(campaign, condition.sort))
            .offset(condition.page.toLong() * condition.size)
            .limit(condition.size.toLong())
            .fetch()

        val totalElements = queryFactory
            .select(campaign.count())
            .from(campaign)
            .where(predicates)
            .fetchOne() ?: 0L

        return CampaignSearchResult(content = content, totalElements = totalElements)
    }

    private fun orderSpecifiers(campaign: QCampaign, sort: CampaignSearchSort): Array<OrderSpecifier<*>> =
        when (sort) {
            CampaignSearchSort.LATEST -> arrayOf(campaign.seq.desc(), campaign.id.asc())
            CampaignSearchSort.POPULAR -> arrayOf(campaign.joined.desc(), campaign.seq.desc(), campaign.id.asc())
            CampaignSearchSort.DEADLINE -> arrayOf(
                CaseBuilder().`when`(campaign.status.eq("open")).then(0).otherwise(1).asc(),
                campaign.recruitEnd.asc(),
                campaign.seq.desc(),
                campaign.id.asc(),
            )
        }

}
