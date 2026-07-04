import { describe, expect, it } from "vitest";
import { emptyPageFallback } from "./paginated-section-utils";

describe("emptyPageFallback", () => {
  it("빈 page이고 page>0이면 이전 page를 반환한다", () => {
    expect(emptyPageFallback({ content: [], page: 2, size: 6, totalElements: 10, totalPages: 2 })).toBe(1);
  });

  it("항목이 있거나 page=0이면 null", () => {
    expect(emptyPageFallback({ content: [{}], page: 0, size: 6, totalElements: 1, totalPages: 1 })).toBeNull();
    expect(emptyPageFallback({ content: [], page: 0, size: 6, totalElements: 0, totalPages: 0 })).toBeNull();
  });
});
