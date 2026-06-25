import { apiGet } from "@/lib/api";
import type { Post } from "@/data/posts";
import FeedClient from "./feed-client";

export default async function FeedPage() {
  const posts = await apiGet<Post[]>("/api/posts");
  return <FeedClient posts={posts} />;
}
