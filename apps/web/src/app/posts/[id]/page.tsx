import { notFound } from "next/navigation";
import { apiGetOrNull } from "@/lib/api";
import type { Post } from "@/data/posts";
import type { Campaign } from "@/data/campaigns";
import PostDetailClient from "./post-detail-client";

export default async function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await apiGetOrNull<Post>(`/api/posts/${id}`);
  if (!post) notFound();
  const linkedCampaign = post.campaignId
    ? await apiGetOrNull<Campaign>(`/api/campaigns/${post.campaignId}`)
    : null;
  return <PostDetailClient post={post} linkedCampaign={linkedCampaign} />;
}
