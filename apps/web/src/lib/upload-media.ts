import { ApiError, apiErrorMessage } from "@/lib/api";
import { getClientApiBaseUrl } from "@/lib/api-url";

type MediaUploadResponse = { url: string };

/** 로컬 디스크 업로드. 반환 URL 은 기존 게시글·프로필 http(s) 검증과 호환된다. */
export async function uploadMedia(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${getClientApiBaseUrl()}/api/media`, {
    method: "POST",
    body: form,
    credentials: "include",
    cache: "no-store",
  });

  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = undefined;
    }
    throw new ApiError(res.status, "/api/media", undefined, body);
  }

  const data = (await res.json()) as MediaUploadResponse;
  if (!data.url?.startsWith("http://") && !data.url?.startsWith("https://")) {
    throw new Error("invalid upload response");
  }
  return data.url;
}

export function uploadMediaErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    const detail = apiErrorMessage(error, "");
    if (detail.includes("file is too large")) return "이미지는 5MB 이하여야 합니다.";
    if (detail.includes("unsupported image type")) return "jpeg, png, webp 이미지만 업로드할 수 있습니다.";
    if (detail.includes("file is required")) return "업로드할 파일을 선택해주세요.";
    if (error.status === 401) return "로그인이 필요합니다.";
    return detail || fallback;
  }
  return fallback;
}
