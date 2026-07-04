import { describe, expect, it } from "vitest";
import { DEFAULT_CAMPAIGN_COMPOSE_VALUES, validateCampaignCompose } from "@/data/campaigns";

describe("validateCampaignCompose", () => {
  const base = { ...DEFAULT_CAMPAIGN_COMPOSE_VALUES, title: "테스트 캠페인" };

  it("rejects empty title", () => {
    const result = validateCampaignCompose({ ...base, title: "  " });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe("title");
  });

  it("rejects invalid capacity", () => {
    const result = validateCampaignCompose({ ...base, capacity: "0" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe("capacity");
  });

  it("rejects recruit end before start", () => {
    const result = validateCampaignCompose({
      ...base,
      recruitStart: "2026-08-01",
      recruitEnd: "2026-07-01",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe("recruitEnd");
  });

  it("accepts valid payload", () => {
    const result = validateCampaignCompose(base);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.payload.title).toBe("테스트 캠페인");
  });
});
