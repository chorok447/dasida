/**
 * 업로드 이미지(`/uploads/<name>.<ext>`)의 목록용 썸네일 URL.
 * 서버 MediaUploadService 가 원본 옆에 `<name>.thumb.jpg` 를 생성하는 규약을 따른다.
 * 업로드 경로가 아닌 URL(외부 이미지 등)은 그대로 반환한다.
 * webp·과거 업로드는 썸네일이 없을 수 있으므로 표시는 원본 fallback과 함께 써야 한다
 * (FallbackImage 의 thumbnail prop).
 */
const UPLOAD_IMAGE_RE = /(\/uploads\/[^/?#]+)\.(jpe?g|png|webp)$/i;

export function uploadThumbUrl(url: string): string {
  return url.replace(UPLOAD_IMAGE_RE, "$1.thumb.jpg");
}
