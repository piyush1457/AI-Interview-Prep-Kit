---
name: frontend-conventions
description: Project conventions for frontend apps (React + Vite + TS) including atomic component structure, Tailwind + design tokens, TanStack Query, Zustand, JWT auth, error-code handling, and styling rules
compatibility: opencode
metadata:
  audience: developers
  project: frontend-template
---

## Framework & Stack (Default)
- React 18/19 + TypeScript, built with Vite 5+. Tests via Vitest + React Testing Library.
- Server state: TanStack Query. Small client state: Zustand. No Redux unless a feature explicitly needs it.
- Styling: Tailwind utilities + CSS-variable design tokens. **No styled-components, no SCSS.**
- Routing: React Router v7. PWA: vite-plugin-pwa (Workbox). No Capacitor.

## Framework Override — FS-AI-INTERVIEW-01 (Next.js + Tailwind)
When building the AI Interview Prep Kit assessment (TRAO_ASSESSMENT_ID: FS-AI-INTERVIEW-01),
the preferred stack in the brief (Section 12 + Preferred Tech Stack) takes precedence over Default:
- Next.js (App Router) + TypeScript + Tailwind CSS. No Vite, no React Router.
- Data: TanStack Query (or SWR / fetch + route handlers) for server state; Zustand for small
  client-only state (builder edits in flight, practice-mode progress). Never mirror server cache into Zustand.
- Auth: session-based (httpOnly cookie) per brief Sec 1. Tokens never in Zustand/localStorage.
  Handle expired/invalid sessions with redirect to login + structured error.
- Required interaction design (scored 10 pts):
  - Long-running generation (up to 90s): show visible progress steps + partial-failure states,
    use `loading.tsx` / `error.tsx` + streaming/SSE/polling, never block UI.
  - Empty states for no kits / thin kits (2-line JD honest output).
  - Builder edits feel immediate: optimistic local state, debounced PATCH, no round-trip per keystroke.
  - Regeneration must not clobber hand edits (respect generated/edited/pinned flags from backend).
  - Responsive (laptop + phone) via Tailwind breakpoints; keyboard navigable (focus order,
    arrow-key flashcard stepping, Esc closes modals, visible focus rings).

## Component Structure (Atomic Design)
- `atoms/` — primitive UI (button, input, loader, badge, modal). No business logic, no app data.
- `molecules/` — small composites of atoms (search-bar, form-group).
- `organisms/` — domain sections wired to data (SignIn, Navbar+Sidebar, Checkout).
- `templates/` — page-level layout shells (AppWrapper, main).
- `pages/` — route-level screens; compose organisms; own business logic.
- Escalation rule: when a domain outgrows ~2 pages with heavy cross-cutting logic, promote it to `features/<domain>/`. `atoms/` + `molecules/` stay global.

### Next.js Mapping (FS-AI-INTERVIEW-01)
- `app/(auth)/login|register/page.tsx`, `app/kits/page.tsx` (list), `app/kits/[id]/page.tsx` (builder),
  `app/kits/[id]/practice/page.tsx`, `components/atoms|molecules|organisms/` as above.
- Kit domains → `features/kits/` (builder: question-list, brief-editor, schedule-view),
  `features/practice/` (flashcard-runner, confidence-tracker).
- Reusable loading/empty/error: `app/kits/loading.tsx`, `error.tsx`, plus `<KitGenerationProgress/>`,
  `<EmptyKits/>`, `<ThinKitNotice/>`.

## Adding a New Page
Follow the existing sibling pattern:
- `pages/<PageName>/index.jsx` (route component), `services.js` (TanStack Query hooks), `styles.js` (Tailwind/theme class maps), optional sub-components.
- Register route in `routes/componentRoutes.js`. Dashboard apps: add to the privileges matrix (`privileges.js`) if access-controlled.

## Data Fetching (TanStack Query)
- Define query keys centrally per domain; use `useQuery`/`useMutation`.
- Server state lives in the query cache — do not mirror it into Zustand.
- GraphQL (if present) via `graphql-request` or keep Apollo only if schema tooling is critical.

## State (Zustand)
- Small client-only state: cart, order draft, UI flags. Persist with `persist()` middleware to localStorage/IndexedDB so UI survives reload offline.
- Never store tokens in Zustand — tokens live in the auth library's storage.

## Auth (JWT via @build-from-bits/jwt-authentication)
- Access token in `sessionStorage`, refresh token in `localStorage`; auto-refresh on 401.
- Header prefix `JWT`; refresh body key `refresh`; verify key `token`.
- Errors are handled by machine-readable `code`, never by message text.

## Styling Rules
- Use Tailwind utility classes in `className` or a `styles.js` map.
- Dynamic brand values (primary color, font) come from CSS variables in `tokens.css` — never hardcode brand hex in a component.
- Design-system components from `@build-from-bits/ui-primitives` must not be re-implemented.

## Import Style
- Group imports: React → third-party → local, each group separated by a blank line.

## Code Quality
- TypeScript strict-ish: no `any` unless unavoidable.
- Lint: `npm run lint`; format: `npm run format`; typecheck: `npm run typecheck`; test: `npm run test`.
- Add comments with examples for complex code.
- No re-implementation: import shared code from libs/boilerplate; never copy it into the app.
