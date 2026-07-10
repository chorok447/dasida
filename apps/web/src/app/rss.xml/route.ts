import { apiGet } from "@/lib/api";
import { getSiteUrl } from "@/lib/site-url";
import { richTextPlainPreview } from "@/lib/rich-text-length";
import { buildRssXml } from "@/lib/rss";
import type { Post } from "@/data/posts";

// sitemap 과 같은 이유로 요청 시점에 생성한다(빌드 시 API 없이도 빌드 성공).
export const dynamic = "force-dynamic";

const FEED_SIZE = 20;

/** 최신 게시글 RSS. 공개 Post 타입에 ISO 작성시각이 없어 item pubDate 는 생략한다(RSS 2.0 선택 항목). */
export async function GET(): Promise<Response> {
  const site = getSiteUrl();
  // API 장애 시에도 채널 자체는 응답한다(빈 목록).
  let posts: Post[] = [];
  try {
    posts = (await apiGet<Post[]>("/api/posts", { revalidate: 300 })).slice(0, FEED_SIZE);
  } catch {
    posts = [];
  }
  const xml = buildRssXml({
    siteUrl: site,
    title: "다시,다 — 업사이클 이야기",
    description: "버려진 자원에 새 가치를 더하는 업사이클링 이야기와 캠페인",
    items: posts.map((post) => ({
      title: richTextPlainPreview(post.text, 80) || "새 업사이클 이야기",
      link: `${site}/posts/${encodeURIComponent(post.id)}`,
      description: richTextPlainPreview(post.text, 300),
      pubDate: post.createdAt ? new Date(post.createdAt) : undefined,
    })),
  });
  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
