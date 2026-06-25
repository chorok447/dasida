import { apiGet } from "@/lib/api";
import type { Post } from "@/data/posts";
import type { Campaign } from "@/data/campaigns";
import FeedClient from "./feed-client";

export default async function FeedPage() {
  const [posts, campaigns] = await Promise.all([
    apiGet<Post[]>("/api/posts"),
    apiGet<Campaign[]>("/api/campaigns"),
  ]);
  return <FeedClient posts={posts} campaigns={campaigns} />;
}
