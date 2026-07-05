import { ApiError, apiErrorMessage, apiFetch } from "@/lib/api";

type MediaUploadResponse = { url: string };

/** 서버 MediaUploadService.MAX_BYTES 와 동일한 한도. 서버 왕복 전에 즉시 안내한다. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** 클라이언트 사전 검증 실패. message 를 그대로 사용자에게 보여준다. */
export class UploadValidationError extends Error {}

/** 로컬 디스크 업로드. 반환 URL 은 기존 게시글·프로필 http(s) 검증과 호환된다. */
export async function uploadMedia(file: File): Promise<string> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadValidationError("이미지는 5MB 이하여야 합니다.");
  }

  const form = new FormData();
  form.append("file", file);

  // apiFetch 경유: access 토큰 만료(401) 시 refresh 후 1회 재시도가 업로드에도 적용된다.
  const res = await apiFetch("/api/media", { method: "POST", body: form });

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
  if (error instanceof UploadValidationError) return error.message;
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
