package com.dasida.api.common

import com.dasida.api.campaign.CampaignRepository
import com.dasida.api.campaign.CampaignSeed
import com.dasida.api.post.PostRepository
import com.dasida.api.post.PostSeed
import org.springframework.boot.CommandLineRunner
import org.springframework.stereotype.Component

/**
 * 비어있는 테이블에만 시드 적재. reversed() 로 저장해 seq DESC 정렬 시 시드 원래 순서(p1, c1 …)가 유지된다.
 * 알림은 사용자별 도메인 이벤트로만 생성되므로 시드하지 않는다.
 */
@Component
class SeedRunner(
    private val posts: PostRepository,
    private val campaigns: CampaignRepository,
) : CommandLineRunner {
    override fun run(vararg args: String) {
        if (posts.count() == 0L) {
            posts.saveAll(PostSeed.posts.reversed().onEachIndexed { i, p -> p.seq = (i + 1).toLong() })
        }
        if (campaigns.count() == 0L) {
            campaigns.saveAll(CampaignSeed.campaigns.reversed().onEachIndexed { i, c -> c.seq = (i + 1).toLong() })
        }
    }
}
