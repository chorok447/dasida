# apps/web — 다시,다 프론트엔드

Next.js (App Router) + TypeScript + Tailwind v4. 모노레포의 프론트엔드 패키지.

## 실행

루트에서 실행하는 것을 권장합니다(워크스페이스 스크립트):

```bash
pnpm install     # 루트에서 1회
pnpm dev:web     # = pnpm --filter web dev → http://localhost:3000
pnpm build:web   # 프로덕션 빌드
```

이 디렉터리에서 직접:

```bash
pnpm dev
pnpm build
pnpm lint
```

## 백엔드 연동

- **브라우저**: `NEXT_PUBLIC_API_URL`(기본 `http://localhost:8080`) — Web image build arg 로 bake-in.
- **SSR·Server Components**: `API_INTERNAL_URL`(런타임 env). Docker Compose 에서 `http://api:8080`. 미설정 시 `NEXT_PUBLIC_API_URL` fallback. `src/lib/api-url.ts` 참고.
- 인증: JWT 는 **httpOnly 쿠키**(`dasida_token`)로만 전달되어 JS 에서 접근 불가. `localStorage` 에는 세션 마커·표시 이름만 저장(`src/lib/auth.ts`).

프로젝트 전체 구조·DB·환경 변수는 루트 [`README.md`](../../README.md) 참고.
