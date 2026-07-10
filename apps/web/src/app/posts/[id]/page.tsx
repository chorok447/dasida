import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { apiGetOrNull } from "@/lib/api";
import { richTextPlainPreview } from "@/lib/rich-text-length";
import type { Post } from "@/data/posts";
import type { Campaign } from "@/data/campaigns";
import PostDetailClient from "./post-detail-client";

// generateMetadata 와 페이지 본문이 같은 요청 안에서 fetch 를 공유하도록 dedupe.
// 캐싱(revalidate) 금지: 편집 직후 상세 SSR 이 옛 본문을 내려주는데,
// 클라이언트 재조회(useAuthedRefresh)는 사용자별 플래그만 갱신해 본문이 stale 로 남는다.
const getPost = cache((id: string) => apiGetOrNull<Post>(`/api/posts/${encodeURIComponent(id)}`));

// 본문이 리치 HTML("<p>…</p>")일 수 있어 태그를 벗긴 plain 텍스트로 제목을 만든다.
function postTitle(post: Post): string {
  return richTextPlainPreview(post.text, 50);
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const post = await getPost(id);
  if (!post) return {};
  const title = postTitle(post);
  const description = `${post.author.name}님의 업사이클 게시글`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: post.images.length > 0 ? [post.images[0]] : undefined,
    },
  };
}

export default async function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await getPost(id);
  if (!post) notFound();
  const linkedCampaign = post.campaignId
    ? await apiGetOrNull<Campaign>(`/api/campaigns/${post.campaignId}`)
    : null;
  return <PostDetailClient post={post} linkedCampaign={linkedCampaign} />;
}
