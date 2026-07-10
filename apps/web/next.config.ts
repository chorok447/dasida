import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Content-Security-Policy",
            // Next 인라인 스크립트/스타일과 무관하게 안전한 지시어만 강제한다.
            // script/style-src 전면 도입은 nonce 파이프라인이 필요해 별도 과제로 남긴다.
            // - object-src 'none': 플러그인(<object>/<embed>) 기반 주입 차단
            // - base-uri 'self': <base> 태그 주입으로 상대 URL 을 탈취하는 공격 차단
            // - frame-ancestors 'none': X-Frame-Options DENY 의 CSP 표준 대응(클릭재킹)
            value: "object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
