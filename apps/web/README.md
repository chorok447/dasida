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

- API 베이스 URL은 `NEXT_PUBLIC_API_URL`(기본 `http://localhost:8080`).
- 인증 토큰은 `localStorage`에 저장(`src/lib/auth.ts`), `apiPost` 가 `Authorization` 헤더에 부착.

프로젝트 전체 구조·DB·환경 변수는 루트 [`README.md`](../../README.md) 참고.
