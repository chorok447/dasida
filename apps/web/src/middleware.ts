import { NextResponse, type NextRequest } from "next/server";

/**
 * 로그인 필요 라우트의 서버측 가드.
 * JWT 검증은 API 가 하고, 여기서는 "로그인 흔적 쿠키가 하나도 없는" 방문만 /login 으로 돌려보낸다.
 * - dasida_token: 액세스 토큰(30분). 있으면 통과.
 * - dasida_session: 로그인 상태 힌트(refresh TTL과 동일). 액세스 토큰이 만료로 사라져도
 *   refresh 가능성이 남아 있으므로 통과시키고, 실제 갱신은 클라이언트 401→refresh 흐름이 처리한다.
 * 각 페이지의 클라이언트 가드는 그대로 유지된다(만료·위조 토큰 방어).
 *
 * 범위는 "이미 클라이언트에서 /login 으로 리다이렉트하던" 라우트만이다. 기존 UX 유지를 위해
 * /mypage·/profile/edit(인라인 로그인 안내), /admin(익명에게도 404 로 존재를 감춤)은 제외한다.
 */
const PROTECTED_PREFIXES = [
  "/notifications",
  "/messages",
];

function isProtected(pathname: string): boolean {
  if (PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true;
  if (pathname === "/posts/new" || pathname === "/campaigns/new") return true;
  return /^\/(posts|campaigns)\/[^/]+\/edit$/.test(pathname);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!isProtected(pathname)) return NextResponse.next();
  if (request.cookies.has("dasida_token") || request.cookies.has("dasida_session")) {
    return NextResponse.next();
  }
  // pathname 은 경로 문자만 담으므로 인코딩 없이 붙인다(로그인 페이지가 startsWith("/") 로 검증).
  return NextResponse.redirect(new URL(`/login?next=${pathname}`, request.url));
}

export const config = {
  matcher: [
    "/notifications/:path*",
    "/messages/:path*",
    "/posts/:path*",
    "/campaigns/:path*",
  ],
};
