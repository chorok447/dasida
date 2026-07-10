import { describe, expect, it } from "vitest";
import { buildRssXml, escapeXml } from "./rss";

describe("escapeXml", () => {
  it("XML 특수문자를 전부 이스케이프한다", () => {
    expect(escapeXml(`<b>&"'`)).toBe("&lt;b&gt;&amp;&quot;&apos;");
  });
});

describe("buildRssXml", () => {
  it("채널 메타와 아이템을 담은 유효한 RSS 2.0 을 만든다", () => {
    const xml = buildRssXml({
      siteUrl: "https://dasida.example",
      title: "다시,다",
      description: "업사이클",
      now: new Date("2026-07-10T00:00:00Z"),
      items: [
        {
          title: "페트병 <화분> 만들기 & 나눔",
          link: "https://dasida.example/posts/p1",
          description: "설명",
        },
      ],
    });
    expect(xml).toContain(`<?xml version="1.0" encoding="UTF-8"?>`);
    expect(xml).toContain("<rss version=\"2.0\">");
    expect(xml).toContain("<title>다시,다</title>");
    expect(xml).toContain("<lastBuildDate>Fri, 10 Jul 2026 00:00:00 GMT</lastBuildDate>");
    // 사용자 입력(제목)의 특수문자는 이스케이프되어야 한다.
    expect(xml).toContain("페트병 &lt;화분&gt; 만들기 &amp; 나눔");
    expect(xml).toContain(`<guid isPermaLink="true">https://dasida.example/posts/p1</guid>`);
    expect(xml).not.toContain("<화분>");
    // pubDate 미지정 아이템은 태그 자체를 생략한다.
    expect(xml).not.toContain("<pubDate>");
  });

  it("pubDate 가 있으면 UTC 문자열로 실린다", () => {
    const xml = buildRssXml({
      siteUrl: "https://dasida.example",
      title: "t",
      description: "d",
      now: new Date("2026-07-10T00:00:00Z"),
      items: [
        {
          title: "제목",
          link: "https://dasida.example/posts/p2",
          description: "설명",
          pubDate: new Date("2026-07-09T12:34:56Z"),
        },
      ],
    });
    expect(xml).toContain("<pubDate>Thu, 09 Jul 2026 12:34:56 GMT</pubDate>");
  });

  it("아이템이 없어도 채널은 유효하다", () => {
    const xml = buildRssXml({
      siteUrl: "https://dasida.example",
      title: "t",
      description: "d",
      items: [],
      now: new Date("2026-07-10T00:00:00Z"),
    });
    expect(xml).toContain("</channel>");
    expect(xml).not.toContain("<item>");
  });
});
