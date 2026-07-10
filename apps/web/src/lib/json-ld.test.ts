import { describe, expect, it } from "vitest";
import { campaignJsonLd, postJsonLd, serializeJsonLd } from "./json-ld";
import type { Post } from "@/data/posts";
import type { Campaign } from "@/data/campaigns";

const basePost: Post = {
  id: "p1",
  author: { name: "김다시", verified: true },
  time: "2시간 전",
  text: "<p>낡은 청바지 업사이클</p>",
  tags: ["#청바지"],
  images: ["https://example.com/a.jpg"],
  likes: 3,
  comments: 2,
  likedByMe: false,
  bookmarkedByMe: false,
  ownedByMe: false,
  createdAt: "2026-07-01T00:00:00Z",
};

const baseCampaign: Campaign = {
  id: "c1",
  status: "open",
  title: "댕교복 캠페인",
  summary: "강아지 옷 만들기",
  thumb: "https://example.com/t.jpg",
  recruitStart: "2026-07-01",
  recruitEnd: "2026-07-31",
  runStart: "2026-08-05",
  runEnd: "2026-08-30",
  capacity: 10,
  joined: 3,
  daysLeftLabel: "모집중",
  recruitable: true,
  recruitState: "recruiting",
  author: { name: "개설자", verified: false },
  body: { heading: "소개", paragraphs: [], images: [] },
  joinedByMe: false,
  bookmarkedByMe: false,
  ownedByMe: false,
};

describe("serializeJsonLd", () => {
  it("</script> 조기 종료를 막도록 < 를 이스케이프한다", () => {
    const out = serializeJsonLd({ text: "</script><img onerror=x>" });
    expect(out).not.toContain("</script>");
    expect(out).toContain("\\u003c/script>");
  });
});

describe("postJsonLd", () => {
  it("SocialMediaPosting 스키마에 본문·작성자·상호작용 수를 담는다", () => {
    const ld = postJsonLd(basePost) as Record<string, unknown>;
    expect(ld["@type"]).toBe("SocialMediaPosting");
    expect(ld.headline).toBe("낡은 청바지 업사이클");
    expect(ld.datePublished).toBe("2026-07-01T00:00:00Z");
    expect(ld.image).toEqual(["https://example.com/a.jpg"]);
    expect((ld.author as Record<string, unknown>).name).toBe("김다시");
    const stats = ld.interactionStatistic as Array<Record<string, unknown>>;
    expect(stats.map((s) => s.userInteractionCount)).toEqual([3, 2]);
  });

  it("시드 글(createdAt 없음)·이미지 없음이면 해당 필드를 생략한다", () => {
    const ld = postJsonLd({ ...basePost, createdAt: null, images: [] }) as Record<string, unknown>;
    expect("datePublished" in ld).toBe(false);
    expect("image" in ld).toBe(false);
  });
});

describe("campaignJsonLd", () => {
  it("Event 스키마에 기간·정원·주최자를 담는다", () => {
    const ld = campaignJsonLd(baseCampaign) as Record<string, unknown>;
    expect(ld["@type"]).toBe("Event");
    expect(ld.startDate).toBe("2026-08-05");
    expect(ld.endDate).toBe("2026-08-30");
    expect(ld.maximumAttendeeCapacity).toBe(10);
    expect((ld.organizer as Record<string, unknown>).name).toBe("개설자");
  });
});
