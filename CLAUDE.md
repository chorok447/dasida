# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"다시, 다" (Dasida) — a Korean upcycling / social-campaign app. pnpm + Gradle monorepo.

- **Frontend**: Next.js (App Router) + TypeScript + Tailwind v4 → `apps/web`
- **Backend**: Kotlin + Spring Boot 4.1 (Gradle Kotlin DSL, Kotlin 2.4) → `apps/api`
- **DB**: MySQL 8 via JPA/Hibernate (introduced for JWT auth persistence). Local DB runs from `docker-compose.yml` at root (`docker compose up -d`). Domains (posts/campaigns/notifications/users) are JPA entities; list/nested fields are stored as JSON columns. Seed data loads once into empty tables via `SeedRunner`. Tests run on in-memory H2 (MySQL mode), no Docker needed. QueryDSL (openfeign fork) is wired via kapt.
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
```

Backend directly (from `apps/api/`): `./gradlew bootRun`, `./gradlew test`, `./gradlew build`.

## Gotchas

- **JDK toolchain**: backend targets **JDK 21** via a Gradle toolchain. If the dev machine has a different JDK, the `foojay-resolver-convention` plugin in `apps/api/settings.gradle.kts` auto-downloads JDK 21 — don't change the target to match a local JDK.
- **pnpm build approvals**: `sharp` and `unrs-resolver` are pre-approved under `allowBuilds:` in `pnpm-workspace.yaml`. New deps with install scripts will be blocked until added there.
- **Health endpoint**: Spring Actuator is included → `/actuator/health`.
- **Auth**: JWT (jjwt) + Spring Security, stateless. Tokens ride **httpOnly cookies** — access `dasida_token`, refresh `dasida_refresh` (rotation, `Path=/api/auth`); `Authorization: Bearer` is also accepted. Most `GET /api/**` are public, but per-user GETs (`/api/auth/me`, `/api/posts/mine`, `/api/notifications/**`, …) require auth — see `SecurityConfig.kt`. Frontend keeps only a session marker in `localStorage` (`apps/web/src/lib/auth.ts`); the JWT is never readable from JS. Secrets via env: `JWT_SECRET` (≥32 bytes), `DB_URL/DB_USER/DB_PASSWORD`.
- **Porting from `design-reference/`**: it uses Vite-isms that don't carry to Next.js — manual `useState` page routing (use Next App Router instead), a custom `theme-context` (consider `next-themes`, already a habit there), and a `figma:asset/` import resolver. Re-implement intent, don't copy config.
- **Theme colors — CSS tokens over `dark ?` ternaries**: `globals.css` defines theme tokens (`--surface`, `--card`, `--border`, `--foreground`, `--foreground-muted`, `--accent`, `--accent-secondary`, `--accent-soft`, `--page-gradient`). Legacy components still carry inline `dark ? "rgba(...)" : "rgba(...)"` ternaries — **when you touch a file, convert that file's color ternaries to `var(--token)`** (no dedicated big-bang PR). New components must use tokens from the start and should not need `useTheme` just for colors.
