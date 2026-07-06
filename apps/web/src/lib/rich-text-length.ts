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

/** 카드·목록용 plain 미리보기(HTML·레거시 **굵게** 지원). */
export function richTextPlainPreview(value: string, maxLength = 160): string {
  const plain = (() => {
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (!/<[a-z][\s\S]*>/i.test(trimmed)) return trimmed.replace(/\*\*([^*]+)\*\*/g, "$1");
    if (typeof document !== "undefined") {
      const doc = new DOMParser().parseFromString(trimmed, "text/html");
      return doc.body.textContent?.replace(/\s+/g, " ").trim() ?? "";
    }
    return trimmed.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  })();
  if (plain.length <= maxLength) return plain;
  return `${plain.slice(0, maxLength).trimEnd()}…`;
}
