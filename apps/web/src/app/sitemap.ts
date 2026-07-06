import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";
import { fetchAllSitemapIds } from "@/lib/sitemap-ids";

// 콘텐츠가 계속 늘어나므로 요청 시점에 생성한다(빌드 시 API 없이도 빌드 성공).
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = getSiteUrl();
  const staticRoutes: MetadataRoute.Sitemap = ["/", "/feed", "/campaigns", "/search", "/logos"].map(
    (path) => ({ url: `${site}${path}` }),
  );

  // API 장애 시에도 sitemap 자체는 응답한다(정적 경로만 노출).
  let contentRoutes: MetadataRoute.Sitemap = [];
  try {
    const [postIds, campaignIds] = await Promise.all([
      fetchAllSitemapIds("/api/posts/sitemap-ids"),
      fetchAllSitemapIds("/api/campaigns/sitemap-ids"),
    ]);
    contentRoutes = [
      ...postIds.map((id) => ({ url: `${site}/posts/${encodeURIComponent(id)}` })),
      ...campaignIds.map((id) => ({ url: `${site}/campaigns/${encodeURIComponent(id)}` })),
    ];
  } catch {
    contentRoutes = [];
  }

  return [...staticRoutes, ...contentRoutes];
}
