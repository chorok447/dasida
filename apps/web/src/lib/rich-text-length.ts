/** HTML 본문의 순수 텍스트 길이(저장·검증용). */
export function richTextPlainLength(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  if (!/<[a-z][\s\S]*>/i.test(trimmed)) return trimmed.length;
  if (typeof document !== "undefined") {
    const doc = new DOMParser().parseFromString(trimmed, "text/html");
    return doc.body.textContent?.trim().length ?? 0;
  }
  return trimmed.replace(/<[^>]*>/g, "").trim().length;
}
