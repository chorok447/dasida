import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { apiGetOrNull } from "@/lib/api";
import type { Post } from "@/data/posts";
import type { Campaign } from "@/data/campaigns";
import PostDetailClient from "./post-detail-client";

// generateMetadata 와 페이지 본문이 같은 요청 안에서 fetch 를 공유하도록 dedupe.
const getPost = cache((id: string) => apiGetOrNull<Post>(`/api/posts/${id}`));

function postTitle(post: Post): string {
  const firstLine = post.text.split("\n")[0].trim();
  return firstLine.length > 50 ? `${firstLine.slice(0, 50)}…` : firstLine;
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
