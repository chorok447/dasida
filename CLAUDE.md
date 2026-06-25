# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"다시, 다" (Dasida) — a Korean upcycling / social-campaign app. pnpm + Gradle monorepo.

- **Frontend**: Next.js (App Router) + TypeScript + Tailwind v4 → `apps/web`
- **Backend**: Kotlin + Spring Boot 3.5 (Gradle Kotlin DSL) → `apps/api`
- **DB**: deferred. Add MySQL/MongoDB (and Redis) only when the backend actually needs persistence — wire via `docker-compose.yml` at root when that happens. Don't add it speculatively.
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
- **Health endpoint**: Spring Actuator is included → `/actuator/health`. No app-level routes exist yet beyond that.
- **Porting from `design-reference/`**: it uses Vite-isms that don't carry to Next.js — manual `useState` page routing (use Next App Router instead), a custom `theme-context` (consider `next-themes`, already a habit there), and a `figma:asset/` import resolver. Re-implement intent, don't copy config.
