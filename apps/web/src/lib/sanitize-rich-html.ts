import DOMPurify from "isomorphic-dompurify";

const PURIFY_CONFIG = {
  ALLOWED_TAGS: ["p", "br", "strong", "b", "em", "i", "ul", "ol", "li", "a", "img"],
  ALLOWED_ATTR: ["href", "src", "alt", "target", "rel", "loading"],
  ALLOW_DATA_ATTR: false,
};

let hooksReady = false;

function ensurePurifyHooks() {
  if (hooksReady) return;
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName !== "A") return;
    const href = node.getAttribute("href") ?? "";
    if (!href.startsWith("http://") && !href.startsWith("https://")) {
      node.removeAttribute("href");
      return;
    }
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
  });
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName !== "IMG") return;
    if (!isSafeImageSrc(node.getAttribute("src") ?? "")) {
      node.remove();
    }
  });
  hooksReady = true;
}

/**
 * 이미지는 https 만 허용해 https 배포에서 mixed content 로 깨지지 않게 한다.
 * http 는 로컬 개발(localhost·127.0.0.1 업로드 서빙)만 예외. 링크(a href)는 탐색이라 http 허용 유지.
 */
function isSafeImageSrc(src: string): boolean {
  if (src.startsWith("https://")) return true;
  if (!src.startsWith("http://")) return false;
  try {
    const host = new URL(src).hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

export function sanitizeRichHtml(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) return "";
  if (!isRichHtml(trimmed)) return trimmed;
  ensurePurifyHooks();
  return DOMPurify.sanitize(trimmed, PURIFY_CONFIG);
}

export function isRichHtml(value: string): boolean {
  return /<[a-z][\s\S]*>/i.test(value.trim());
}
