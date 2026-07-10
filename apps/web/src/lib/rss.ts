/** RSS 2.0 XML 빌더. 값은 전부 이스케이프한다 — 게시글 본문/제목은 사용자 입력. */

export type RssItem = {
  title: string;
  link: string;
  description: string;
  /** 작성 시각 — 없으면 pubDate 를 생략한다(RSS 2.0 선택 항목). */
  pubDate?: Date;
};

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildRssXml(options: {
  siteUrl: string;
  title: string;
  description: string;
  items: RssItem[];
  /** 채널 lastBuildDate. 테스트 주입용 — 미지정 시 현재 시각. */
  now?: Date;
}): string {
  const { siteUrl, title, description, items } = options;
  const lastBuildDate = (options.now ?? new Date()).toUTCString();
  const itemsXml = items
    .map(
      (item) => `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.link)}</link>
      <guid isPermaLink="true">${escapeXml(item.link)}</guid>
      <description>${escapeXml(item.description)}</description>${
        item.pubDate ? `\n      <pubDate>${item.pubDate.toUTCString()}</pubDate>` : ""
      }
    </item>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${escapeXml(siteUrl)}</link>
    <description>${escapeXml(description)}</description>
    <language>ko</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
${itemsXml}
  </channel>
</rss>
`;
}
