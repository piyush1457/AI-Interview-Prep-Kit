# Plan: Apollo frontend redesign + auth flow fix

Date: 2026-09-23 · Status: **Implemented + verified (Playwright E2E)** · Implementer: opencode
Design doc: `docs/superpowers/specs/2026-09-23-apollo-frontend-design.md` (approved)
Style source: `frontend/Apollo.md`

## Problem

Frontend is functionally complete but visually an untouched AI scaffold (create-next-app metadata, Phase-0 copy, hardcoded zinc/black colors, no shell) and the login page is a non-functional stub with no register page or auth guard. Must look like a designed product and fix the broken auth flow without touching backend APIs or kit logic.

## Decisions

| Decision | Choice |
|---|---|
| Visual direction | Apollo (warm limestone canvas, flat, single highlighter CTA) - chosen over Hatch/Antimetal/Obscura/Miranda for professional fit |
| Dark mode | Removed - light-only, deletes inconsistent `prefers-color-scheme` block |
| Design-system delivery | Tailwind 4 `@theme` tokens + `@layer components` classes (`.btn`, `.card`, `.eyebrow`…) - one source of truth, no hardcoded hex in JSX |
| Fonts | next/font: Fraunces (display 500/600), Inter (body), JetBrains Mono (eyebrows/meta) |
| Auth guard | Client hook `useRequireAuth()` inside `AppShell` (one guard covers /kits + builder + practice); 401 → `/login?next=` |
| State/fetch | Keep existing `lib/api.ts` fetch client; only add `status`/`code` on thrown errors. No TanStack Query/Zustand migration in this pass |
| Structure | Add `components/atoms/*` + `components/organisms/AppShell`; keep `components/kits|practice` paths (surgical, no move-cascade) |

## Existing Building Blocks

- Pages: `app/page.tsx`, `app/login/page.tsx`, `app/kits/page.tsx`, `app/kits/[id]/page.tsx`, `app/kits/[id]/practice/page.tsx`, `app/layout.tsx`, `app/globals.css`
- Components: `components/kits/{BriefEditor,QuestionList,KitGenerationProgress,ThinKitNotice,BatchUpload}.tsx`, `components/practice/{FlashcardRunner,WeakSpots}.tsx`
- Logic untouched: `lib/kitState.ts` (+ tests), `lib/api.ts` (extended only), backend routes
- Backend auth already correct: `POST /auth/register|login|logout`, `GET /auth/me` (401 when anon)

## Design Overview

Tokens in `globals.css` (`@theme`) → component classes (`@layer components`) → atoms (Button/Field/Badge/Spinner/EmptyState) → AppShell (wordmark + nav + auth cluster + `useRequireAuth`) → 6 pages restyled per spec sections 4.1–4.5. Numbered mono eyebrows: 01 brief, 02–05 categories, 06 schedule. Primary CTA = highlighter `#f8ff2c` + black text; progress fill = indigo (volt stays CTA-only).

## Changes by File

1. `frontend/src/app/globals.css` - replace scaffold vars with Apollo `@theme` (colors, fonts, radius), body = `bg-limestone text-charcoal`, `@layer components` (btn variants, card, input family, eyebrow, badge variants, field), keep focus-visible (indigo) + print rules; drop dark-mode block.
2. `frontend/src/app/layout.tsx` - Fraunces/Inter/JetBrains real `next/font` vars; metadata `AI Interview Prep Kit` + real description; body classes.
3. `frontend/src/components/atoms/{Button,Field,Badge,Spinner,EmptyState}.tsx` - new; forwardRef Button with `variant: primary|outline|ghost|danger`, `pending` state.
4. `frontend/src/components/organisms/AppShell.tsx` - new; sticky marble header, wordmark, Kits link, email + Log out / Sign in; runs `useRequireAuth()`.
5. `frontend/src/lib/auth.ts` - new `useRequireAuth()` hook (api.me → 401 redirect with `?next=`).
6. `frontend/src/lib/api.ts` - attach `status` + body `code` to thrown errors; `logout` returns to `/` handled by caller.
7. `frontend/src/app/page.tsx` - Apollo hero (display 88/48px, highlighter wash, CTA pair) + 3 numbered feature cards + footer; metadata inline.
8. `frontend/src/app/login/page.tsx` - wired form: api.login, `?next=` redirect, code-based errors, pending spinner, link to register.
9. `frontend/src/app/register/page.tsx` - new; api.register, ≥6-char hint, same error pattern.
10. `frontend/src/app/kits/page.tsx` - AppShell; header + create form (`.field`s, disabled logic preserved); kit rows as cards with role/company/mono meta/status badge; EmptyState; error banner.
11. `frontend/src/components/kits/BatchUpload.tsx` - `<details>` disclosure restyle, mono textarea.
12. `frontend/src/app/kits/[id]/page.tsx` - AppShell; sub-header (back, Saving/Saved, conflict banner, Practice CTA); eyebrow-numbered sections; schedule shows `N questions` not raw ids; regen handlers unchanged.
13. `frontend/src/components/kits/{BriefEditor,QuestionList,KitGenerationProgress,ThinKitNotice}.tsx` - token classes, eyebrow numbers, semantic badges; SSE/poll/dnd logic byte-identical.
14. `frontend/src/app/kits/[id]/practice/page.tsx` - AppShell; header + print button.
15. `frontend/src/components/practice/{FlashcardRunner,WeakSpots}.tsx` - paper card, mono progress, outline semantic confidence buttons; record/order logic unchanged.

## Auth Flows / API Contracts

| Endpoint | Change |
|---|---|
| `POST /api/auth/register\|login` | none (now actually called from UI) |
| `GET /api/auth/me` | none (used by guard) |
| `POST /api/auth/logout` | none |
| error payload `{code, message}` | frontend now reads `code` (AUTH / VALIDATION) + HTTP status |

## Tests

1. Existing `frontend/src/lib/kitState.test.ts` - must stay green (logic untouched; suite later grew to 6 with `nextFlashcardId`).
2. Manual/Playwright: register → lands on /kits empty state; logout → /; login with wrong pw → AUTH error; login with `?next=/kits` → returns; guard: anonymous GET /kits → redirected to /login?next=/kits.
3. Regression: builder PATCH debounce + Saving/Saved chrome visible; 409 banner path unchanged (code review).

## Verification

```bash
npm run typecheck            # all 3 workspaces
npx vitest run               # in frontend/ → kitState tests pass
npm run lint                 # in frontend/ → no errors
npm run build                # in frontend/ → routes /, /login, /register, /kits, /kits/[id], /kits/[id]/practice
# Playwright screenshots (webapp-testing): home, register, kits empty, login - 1280px + 390px
```

## Security Notes

- Session stays httpOnly SameSite=Lax cookie via same-origin proxy - no token storage introduced.
- No `dangerouslySetInnerHTML` (eslint-banned) - all content rendered as text nodes.
- Register/login continue through existing rate limiter; errors don't leak whether email exists (backend AUTH message).

## Open Questions / Follow-ups

- None blocking. Optional backlog below.

## Backlog

- TanStack Query migration for kit fetching; skeleton loaders; dark mode as explicit second theme; move `components/kits` → `features/kits` per conventions escalation rule.

## Status Update (2026-09-23)

Implemented + verified (Playwright E2E); committed in Phase 4 (`f0cf1ae`).
