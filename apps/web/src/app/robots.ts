import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // 로그인 필요·개인 영역과 작성/수정 폼은 색인 대상이 아니다.
      disallow: [
        "/mypage",
        "/notifications",
        "/profile",
        "/login",
        "/signup",
        "/posts/new",
        "/campaigns/new",
        "/*/edit",
      ],
    },
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
