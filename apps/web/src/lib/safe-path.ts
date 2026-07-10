/**
 * 리다이렉트용 내부 경로 검증. `//evil.com`·`/\evil.com` 같은
 * 프로토콜 상대 URL(open redirect)을 걸러 내부 경로만 통과시킨다.
 */
export function safeInternalPath(path: string | null | undefined): string | null {
  if (!path || !path.startsWith("/")) return null;
  if (path.startsWith("//") || path.startsWith("/\\")) return null;
  return path;
}
