/**
 * 캠페인 진행률(%) 계산. 항상 0~100 사이 finite number 를 반환.
 * capacity<=0(미정/비정상 데이터)이면 0, joined 가 범위를 벗어나면 clamp.
 */
export function progressPercent(joined: number, capacity: number): number {
  if (!Number.isFinite(joined) || !Number.isFinite(capacity) || capacity <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((joined / capacity) * 100)));
}
