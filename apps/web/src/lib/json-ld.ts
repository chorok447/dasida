import { getSiteUrl } from "@/lib/site-url";
import { richTextPlainPreview } from "@/lib/rich-text-length";
import type { Post } from "@/data/posts";
import type { Campaign } from "@/data/campaigns";

/**
 * JSON-LD 직렬화. `</script>` 조기 종료·태그 주입을 막기 위해 `<` 를 유니코드 이스케이프한다
 * (본문·작성자명은 사용자 입력이므로 그대로 직렬화하면 안 된다).
 */
export function serializeJsonLd(data: object): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/** 게시글 상세용 SocialMediaPosting 스키마. 시드 글은 createdAt 이 없어 datePublished 를 생략한다. */
export function postJsonLd(post: Post): object {
  return {
    "@context": "https://schema.org",
    "@type": "SocialMediaPosting",
    headline: richTextPlainPreview(post.text, 110),
    text: richTextPlainPreview(post.text, 500),
    url: `${getSiteUrl()}/posts/${encodeURIComponent(post.id)}`,
    ...(post.createdAt ? { datePublished: post.createdAt } : {}),
    ...(post.images.length > 0 ? { image: post.images } : {}),
    author: {
      "@type": "Person",
      name: post.author.name,
    },
    interactionStatistic: [
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/LikeAction",
        userInteractionCount: post.likes,
      },
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/CommentAction",
        userInteractionCount: post.comments,
      },
    ],
  };
}

/** 캠페인 상세용 Event 스키마. 날짜는 백엔드가 YYYY-MM-DD 로 내려준다. */
export function campaignJsonLd(campaign: Campaign): object {
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: campaign.title,
    description: campaign.summary,
    url: `${getSiteUrl()}/campaigns/${encodeURIComponent(campaign.id)}`,
    startDate: campaign.runStart,
    endDate: campaign.runEnd,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    // closed 는 "모집 종료"지 행사 취소가 아니므로 상태는 Scheduled 로 둔다.
    eventStatus: "https://schema.org/EventScheduled",
    ...(campaign.thumb ? { image: [campaign.thumb] } : {}),
    organizer: {
      "@type": "Person",
      name: campaign.author.name,
    },
    ...(campaign.capacity > 0 ? { maximumAttendeeCapacity: campaign.capacity } : {}),
  };
}
