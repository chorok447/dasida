import type { PageResponse } from "@/app/mypage/paginated-section";

/** 현재 page가 비었을 때 이동할 이전 page. 없으면 null. */
export function emptyPageFallback<T>(data: PageResponse<T>): number | null {
  if (data.content.length === 0 && data.page > 0) return Math.max(0, data.page - 1);
  return null;
}
