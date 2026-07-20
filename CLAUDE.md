# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"다시, 다" (Dasida) — a Korean upcycling / social-campaign app. pnpm + Gradle monorepo.

- **Frontend**: Next.js (App Router) + TypeScript + Tailwind v4 → `apps/web`
- **Backend**: Kotlin + Spring Boot 4.1 (Gradle Kotlin DSL, Kotlin 2.4) → `apps/api`
- **DB**: MySQL 8 via JPA/Hibernate (introduced for JWT auth persistence). Local DB runs from `docker-compose.yml` at root (`docker compose up -d`). Domains (posts/campaigns/notifications/users) are JPA entities; list/nested fields are stored as JSON columns. Seed data loads once into empty tables via `SeedRunner`. Tests run on in-memory H2 (MySQL mode), no Docker needed — except `MySqlMigrationSmokeTest`, which boots Testcontainers MySQL 8.4 to verify Flyway migrations + `ddl-auto=validate` against the real dialect (auto-skips when Docker is unavailable). QueryDSL (openfeign fork) is wired via kapt.
- **`design-reference/`**: the original **Figma Make export** (a standalone Vite React SPA). This is the **design source of truth**, not shipping code. Port screens from here into `apps/web`; don't run it as part of the app. It has 13 pages (`design-reference/src/app/pages/`) and shadcn/ui components to mirror.

## Layout

```
apps/web   # Next.js frontend
apps/api   # Kotlin + Spring Boot backend
packages/  # shared TS packages (empty until needed)
design-reference/  # Figma export, reference only
```

`pnpm-workspace.yaml` globs `apps/*` + `packages/*`. `apps/api` has no `package.json`, so pnpm ignores it — it's Gradle-only.

## Commands

From repo root:

```bash
pnpm install        # installs JS workspace (web + packages)
pnpm dev:web        # Next.js dev server
pnpm build:web      # Next.js production build
pnpm dev:api        # Spring Boot (gradlew bootRun)
pnpm build:api      # gradlew build
pnpm test:api       # gradlew test
pnpm docker:up      # local MySQL (docker compose up -d --wait)
pnpm docker:local   # full stack build+run (compose.local.yml)
pnpm docker:reset   # wipe DB volume and restart MySQL
```

Backend directly (from `apps/api/`): `./gradlew bootRun`, `./gradlew test`, `./gradlew build`.

API 타입 동기화: `pnpm --filter web openapi:types` 가 실행 중인 API 의 `/v3/api-docs` 로부터 `apps/web/src/types/api.d.ts` 를 재생성한다(springdoc). 백엔드 DTO/엔드포인트를 바꾸면 재생성해서 diff 로 프론트 수동 타입(`apps/web/src/data/*.ts`)과의 드리프트를 리뷰하라. 이 파일은 커밋 대상이며 직접 수정하지 않는다. CI(`ci.yml` e2e job)의 **OpenAPI 타입 드리프트 게이트**가 API 를 8081 로 띄워 같은 재생성을 수행하고 diff 가 나오면 실패하므로, 백엔드 계약 변경 시 재생성 커밋을 잊지 말 것.

## Gotchas

- **JDK toolchain**: backend targets **JDK 21** via a Gradle toolchain. If the dev machine has a different JDK, the `foojay-resolver-convention` plugin in `apps/api/settings.gradle.kts` auto-downloads JDK 21 — don't change the target to match a local JDK.
- **pnpm build approvals**: `esbuild`, `sharp`, and `unrs-resolver` are pre-approved under `allowBuilds:` in `pnpm-workspace.yaml`. New deps with install scripts will be blocked until added there. The same file pins `postcss@<8.5.10 → >=8.5.10` under `overrides:` (Next-pulled postcss XSS advisory) — keep it when touching the workspace file.
- **CSS-in-`<style>` escaping**: `apps/web/src/lib/escapeCssForStyle` (`src/lib/escape-css-for-style.ts`) escapes `</style>`/`<!--`/`<script` breakouts before injecting CSS into a `<style>` tag via `dangerouslySetInnerHTML`. No production call site yet — use it (don't re-implement) if a feature ever inserts user-provided CSS.
- **Health endpoint**: Spring Actuator is included → `/actuator/health`.
- **Auth**: JWT (jjwt) + Spring Security, stateless. Tokens ride **httpOnly cookies** — access `dasida_token`, refresh `dasida_refresh` (rotation, `Path=/api/auth`), plus a non-sensitive login-hint `dasida_session` (fixed value "1", refresh TTL) that `apps/web/src/middleware.ts` uses to server-redirect anonymous visits to routes that already client-redirect (`/notifications`, `/messages`, compose/edit pages); `/mypage`·`/profile/edit` keep their inline login notices and `/admin` stays 404 to anonymous — don't add them to the middleware. `Authorization: Bearer` is also accepted. Most `GET /api/**` are public, but per-user GETs (`/api/auth/me`, `/api/posts/mine`, `/api/notifications/**`, …) require auth — see `SecurityConfig.kt`. Frontend keeps only a session marker in `localStorage` (`apps/web/src/lib/auth.ts`); the JWT is never readable from JS. Secrets via env: `JWT_SECRET` (≥32 bytes), `DB_URL/DB_USER/DB_PASSWORD`. **Credential change revokes old tokens**: password/email change stamps `users.credentials_changed_at` (V17) and tokens issued before it are rejected by refresh, `JwtAuthFilter`, and the DM WS handshake — the changing session itself gets a fresh access+refresh cookie pair, other sessions get logged out. JWT `iat` is second-granular, so the comparison truncates to seconds.
- **Admin**: `users.role` (`USER`/`ADMIN`) drives authorization — `JwtAuthFilter` reads the role from DB per request (no JWT claim), so revoking admin applies immediately. All of `/api/admin/**` requires `ROLE_ADMIN` (`AdminController`: report queue + summary + content visibility). Frontend `/admin` is guarded client-side (`admin-guard.tsx`, non-admins get 404). Bootstrap admin account is seeded by `SeedRunner` **only when `ADMIN_PASSWORD` is set** (no built-in default password); `ADMIN_EMAIL` defaults to `admin@dasida.local`. An existing user with that email is promoted, not overwritten — but **promotion also only happens when `ADMIN_PASSWORD` is set** (otherwise a public signup with the default email would silently become ADMIN on restart).
- **Content hiding (soft hide)**: posts/campaigns/comments carry `hiddenAt`/`hiddenReason` (`AdminContentService` sets them; report resolution can hide via `hideContent`). Hidden content is excluded from public lists/search/sitemap and interactions 404; the **author still sees it** on detail/mine with `hidden: true` (SSR detail pages 404 though — no cookie server-side). When adding a new public read path for these entities, filter `hiddenAt is null`; hiding/unhiding a post comment must keep `post.comments` counter in sync (already handled — don't double-decrement on delete). Hiding a **top-level** comment cascades to its visible replies (and unhide restores only replies hidden at the same instant), mirroring author-delete semantics — keep that symmetry if you touch either path.
- **e2e scoping**: `pnpm --filter web e2e <file>.spec.ts` runs just that file (`scripts/e2e.mjs` strips the `--` separator pnpm forwards, so the `-- <file>` form works too). The full suite is currently 47 tests, ~1.5min. Also: `webServer` reuses whatever's already on the configured ports (`reuseExistingServer: true`) — never start a second `pnpm e2e`/`pnpm build` run before a prior one has fully finished, or the two runs contend for the same dev servers and produce large numbers of unrelated false failures (looks like a regression, isn't one). If another project occupies 3000/8080, run on alternate ports: `NEXT_PUBLIC_API_URL=http://localhost:8180 pnpm build` then `E2E_WEB_PORT=3100 E2E_API_PORT=8180 API_INTERNAL_URL=http://localhost:8180 pnpm e2e` (the API URL is baked into the client bundle at build time; the e2e API server also gets CORS/upload-URL/admin-seed args from `playwright.config.ts` — admin specs skip themselves if the `admin@dasida.local`/`E2eAdminPass!` seed is absent).
- **Porting from `design-reference/`**: it uses Vite-isms that don't carry to Next.js — manual `useState` page routing (use Next App Router instead), a custom `theme-context` (consider `next-themes`, already a habit there), and a `figma:asset/` import resolver. Re-implement intent, don't copy config.
- **Theme colors — CSS tokens only, no `dark ?` ternaries**: `globals.css` defines all theme tokens (`--surface`, `--card`, `--panel`, `--glass`, `--border`, `--foreground`, `--foreground-muted`, `--heading`, `--accent`, `--accent-secondary`, `--accent-strong`, `--accent-soft`, `--danger`, `--danger-soft`, `--danger-solid`/`--danger-solid-strong` (opaque destructive-button bg + hover, theme-invariant), `--warning`, `--warning-soft`, `--page-gradient`, `--auth-gradient`) plus purpose-named gradients (`--hero-gradient`, `--hero-title-gradient`, `--band-gradient`, `--news-card-gradient`, `--text-tile-gradient`) and RGB channels for arbitrary alpha (`rgba(var(--ink-rgb), a)` for text/tints, `rgba(var(--surface-rgb), a)` for translucent fixed bars). The `dark ? "..." : "..."` color-ternary migration is **done** — do not reintroduce ternaries or use `useTheme` for colors; also do not use Tailwind `dark:` variants — no `@custom-variant dark` is defined, so `dark:` follows the **OS** preference, not the app toggle (past bug); the only remaining `dark`/`theme` usages are `theme-toggle.tsx` (icon/label, not color) and `app-frame.tsx` (sonner `Toaster theme` prop — semantic, not color).
