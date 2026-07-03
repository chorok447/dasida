/** 브라우저(클라이언트) fetch용 API 베이스 URL. NEXT_PUBLIC_ 접두사로 빌드 시 번들에 포함된다. */
export function getClientApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
}

/** SSR·Server Components·route handler용 API 베이스 URL. Docker Compose 내부에서는 api 서비스명을 쓴다. */
export function getServerApiBaseUrl(): string {
  return process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
}
