/** 공개 사이트 베이스 URL. OG metadataBase·robots·sitemap 에서 사용. 운영은 NEXT_PUBLIC_SITE_URL 주입. */
export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}
