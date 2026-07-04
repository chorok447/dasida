import { toast } from "sonner";

export async function sharePage(options: { title: string; url?: string; text?: string }) {
  const url = options.url ?? (typeof window !== "undefined" ? window.location.href : "");
  const payload = { title: options.title, text: options.text, url };

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share(payload);
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("링크를 복사했어요.");
      return;
    } catch {
      // fall through
    }
  }

  toast.error("공유할 수 없어요. 주소창의 URL을 복사해 주세요.");
}
