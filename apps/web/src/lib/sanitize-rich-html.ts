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
    const src = node.getAttribute("src") ?? "";
    if (!src.startsWith("http://") && !src.startsWith("https://")) {
      node.remove();
    }
  });
  hooksReady = true;
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
