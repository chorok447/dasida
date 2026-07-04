const IMG_SRC_RE = /<img[^>]+src=["'](https?:\/\/[^"']+)["']/gi;
const IMG_TAG_RE = /<img[^>]*>/gi;
const EMPTY_P_RE = /<p>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>/gi;

/** img 제거 후 남는 빈 문단을 정리한다. */
export function cleanEmptyRichParagraphs(html: string): string {
  let next = html.trim();
  let prev = "";
  while (next !== prev) {
    prev = next;
    next = next.replace(EMPTY_P_RE, "").trim();
  }
  return next;
}

/** 본문 HTML 에서 갤러리용 이미지를 분리한다. */
export function splitRichBodyHtml(body: string): { html: string; images: string[] } {
  const images = Array.from(body.matchAll(IMG_SRC_RE), (match) => match[1].trim()).filter(Boolean);
  const uniqueImages = [...new Set(images)];
  const html = cleanEmptyRichParagraphs(body.replace(IMG_TAG_RE, ""));
  return { html, images: uniqueImages };
}

/** 편집기 로드 시 그리드 이미지를 본문 HTML 로 합친다. */
export function mergeRichBodyForEditor(text: string, images: string[]): string {
  const trimmed = text.trim();
  if (images.length === 0) return trimmed;
  const blocks = images.map((src) => `<p><img src="${src}" alt="본문 이미지" /></p>`).join("");
  return trimmed ? `${trimmed}\n${blocks}` : blocks;
}

// ponytail: 캠페인 compose 호환 alias
export function mergeCampaignBodyForEditor(paragraphs: string[], images: string[]): string {
  return mergeRichBodyForEditor(paragraphs.join("\n\n"), images);
}

export const splitCampaignBodyHtml = splitRichBodyHtml;
