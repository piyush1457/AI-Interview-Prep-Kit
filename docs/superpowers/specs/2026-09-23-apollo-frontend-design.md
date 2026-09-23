# Design: Apollo-styled frontend redesign + auth flow fix

Date: 2026-09-23 · Status: Approved (verbal, "proceed with it") · Project: FS-AI-INTERVIEW-01
Reference style: `frontend/Apollo.md` (chosen over Hatch / Antimetal / Obscura / Miranda)

## 1. Problem

The frontend is functionally complete but reads as an untouched AI scaffold:

- `layout.tsx` still ships `title: "Create Next App"`; the home page still says "Phase 0 scaffold".
- Login is a visual stub - the form never calls `api.login()`; there is no register page and no auth guard.
- No design system: hardcoded `bg-black` / `text-red-600` / `border-purple-200` scattered across files (violates frontend-conventions "tokens, never hardcode brand hex").
- No shared app shell - each page is an isolated centered box; the kit list shows raw `id.slice(-6)` instead of role/company.
- Inconsistent buttons/inputs; a half-applied `prefers-color-scheme` dark mode; the builder schedule leaks raw `q1,q2,q3` IDs.

Goal: one coherent Apollo-derived design system across all five pages, plus working auth - reviewable as a designed product, verified by screenshots.

## 2. Design direction (Apollo, adapted)

Light-only. No dark-mode toggle (removes the inconsistent `prefers-color-scheme` block).

### Color tokens (CSS vars → Tailwind 4 `@theme`)

| Token | Value | Role |
|---|---|---|
| `--color-limestone` | `#ccc9c6` | Page canvas (body background) |
| `--color-marble` | `#f7f5f2` | Card / section surfaces |
| `--color-paper` | `#ffffff` | Elevated surfaces: inputs, overlays, question cards |
| `--color-onyx` | `#000000` | Headlines, high-contrast text |
| `--color-charcoal` | `#1a1a1a` | Body text, input values |
| `--color-graphite` | `#47423d` | Secondary icon strokes, strong secondary text |
| `--color-pebble` | `#736f6c` | Secondary text, placeholders, muted meta |
| `--color-ash` | `#94918e` | Tertiary / disabled text |
| `--color-flint` | `#e5e7eb` | Hairline borders, dividers, input outlines, progress tracks |
| `--color-highlighter` | `#f8ff2c` | Primary CTA fill (black text), soft emphasis washes |
| `--color-volt` | `#ebf212` | Alternate CTA fill variant (hover/active of primary) |
| `--color-indigo` | `#3f3653` | Display accent only (eyebrow markers, progress fill) - never body text |
| `--color-danger` | `#b91c1c` | Error text/borders (semantic addition) |
| `--color-success` | `#15803d` | Success / "Solid" confidence (semantic addition) |
| `--color-warning` | `#b45309` | Warning / "OK" confidence, thin-kit notice (semantic addition) |

Rules: no shadows anywhere (flat system; hierarchy = warm layering + 1px Flint hairlines). No gradients. No cool grays. Highlighter/volt only on primary actions and soft emphasis - never large fills.

### Typography (via `next/font/google`)

| Role | Font | Weights | Usage |
|---|---|---|---|
| Display (`--font-display`) | **Fraunces** (Season Mix substitute) | 500–600, optical size high | Page titles, hero, section headings ≥24px. Never below 24px. |
| Body (`--font-sans`) | **Inter** (Soehne substitute) | 400/500/600/700 | All body, UI, buttons, inputs |
| Mono (`--font-mono`) | **JetBrains Mono** (Founders Grotesk Mono substitute) | 400/500 | Eyebrows (`01 · TECHNICAL`), metadata (days, status, timestamps), code-ish JD hints |

Scale: caption 12px · body 16px/1.5 · subheading 20px · heading-sm 24px · heading 48px/1.1 ls −0.01em · display 88px/1 ls −0.01em (home hero only). Display headings: weight 550-ish (Fraunces 500/600), never ultra-bold.

### Spacing / shape / layout

- Base unit 8px. Section gap 80px. Card padding 24px. Element gap 8–16px.
- Radii: 4px small · 8px cards+buttons+inputs · 12px images/large panels. Nothing above 12px.
- Page max-width 1200px, centered.
- Borders: 1px `--color-flint` hairlines everywhere structure is needed.

### Components (defined once in `globals.css` `@layer components`, built from tokens)

- `.btn` - 8px radius, Inter 500 16px, padding 10×20, transition colors 150ms.
- `.btn-primary` - highlighter fill, onyx text, no border; hover → volt.
- `.btn-outline` - transparent, 1px flint border, charcoal text; hover → paper bg.
- `.btn-ghost` - text-only, charcoal, hover marble bg.
- `.btn-danger` - ghost variant in danger color (delete actions).
- `.card` - marble bg, 8px radius, 1px flint border, padding 24px.
- `.card-paper` - paper bg variant (elevated: question cards, inputs inside forms).
- `.input` / `.textarea` / `.select` - paper bg, 1px flint, 8px radius, focus border → onyx (no glow ring; global `:focus-visible` outline stays for a11y).
- `.eyebrow` - JetBrains Mono 11px uppercase ls 0.08em pebble (section numbering).
- `.badge` - 4px radius, mono 11px, marble/flint default; semantic variants (`badge-success`, `badge-warning`, `badge-danger`, `badge-accent` with highlighter wash).
- `.field` - label (Inter 500 14px charcoal) + control stack.

Atoms in code (`components/atoms/`): `Button`, `Field` (label+input/textarea wrapper), `Badge`, `Spinner`, `EmptyState`. Everything else composes `.card` / `.eyebrow` classes directly.

## 3. Information architecture + app shell

- **`components/organisms/AppShell`** wraps `/kits`, `/kits/[id]`, `/kits/[id]/practice`:
  - Top bar: `PrepKit` wordmark (Fraunces 600, onyx) linking home · center/right: `Kits` nav link · right cluster: user email (mono caption) + `Log out` ghost button, or `Sign in` btn-primary when logged out.
  - Bar: marble bg, 1px flint bottom border, sticky top, height 64px. Not glass, no shadow.
  - Main: max-w-1200px, px-24, py-40 below bar.
- **Auth guard** (client): `useRequireAuth()` hook - on mount `api.me()`; on 401 → `router.replace('/login?next=' + pathname)`. Used by AppShell (guarding all three kit routes at once).
- Home (`/`), `/login`, `/register` render without the kit nav (own minimal header with wordmark + auth links).

## 4. Page designs

### 4.1 Home `/` (server component - replaces Phase-0 scaffold)

- Apollo hero: eyebrow `AI INTERVIEW PREP KIT` · display headline 88px (mobile 48px): "Turn any job post into a five-day interview plan." (one highlighter wash behind "five-day") · subcopy 18px pebble max-w-600 · CTA pair: `Get started` (btn-primary → /register) + `I have an account` (btn-outline → /login).
- Below: three feature cards (mono numbered eyebrows `01 RESEARCH` / `02 GENERATE` / `03 PRACTICE`) with 1-sentence descriptions of crawl → question bank → flashcards/weak-spots.
- Footer strip: mono caption with tech note (Groq · Next.js · Express · MongoDB).
- Metadata: `title: "AI Interview Prep Kit"`, real description (kills create-next-app defaults).

### 4.2 `/login` (wired) + `/register` (new)

- Centered card (paper, max-w-420) on limestone: wordmark, display heading "Sign in" / "Create account", fields Email + Password (`.field`), primary submit, alternate link below ("Need an account? Register" / "Have an account? Sign in").
- Real calls: `api.login(email, password)` / `api.register(...)`; on success → `router.push(next ?? '/kits')`. `next` read from `?next=`.
- Errors: render from `error.code` - `AUTH` → "Invalid email or password", `VALIDATION` → message as-is, 401-rate-limit (429) → "Too many attempts - try again in a few minutes." Inline under the form in danger color, `role="alert"`. Disable button + Spinner while pending.
- Register rules mirrored from backend: email required, password ≥ 6 chars (hint text under field).

### 4.3 `/kits` (list)

- AppShell on. Page header: display heading "Your kits" + `New kit` primary button that scrolls/focuses the create form (form always visible above list).
- **Create form** = card with `.field` stacks: Job description (textarea, rows 6, mono hint "Paste the full posting…"), row of Company website (input) + Days (number 1–60). Submit `Generate kit` (btn-primary, disabled until jd+url non-empty). Secondary: `Batch upload` disclosure (existing BatchUpload component, restyled, details/summary not modal).
- **Kit rows** = cards (not raw list items): left = role title (heading-sm) + `@ company` (pebble) ; meta line in mono caption `5 days · created 23 Sep · generated kit` ; right = status badge (`done` success, `running` accent with pulse, `failed` danger, `queued` neutral) + `Open →` ghost link. Whole row is the link target (stretched-link pattern or Link wrapper).
- Empty state = `EmptyState` atom: display-sm "No kits yet" + 2-line explainer + primary CTA focused to the JD textarea.
- Error (401 after guard fails / network): danger banner with Retry.

### 4.4 `/kits/[id]` (builder)

- AppShell on. Sticky sub-header row: back link `← Kits` (ghost) · mono caption saving state (`Saving…` / `Saved` with check) · conflict banner (danger, `role="alert"`, existing 409 copy) · `Practice →` btn-primary.
- Title block: role title display-sm + `@ company` · thin-kit `ThinKitNotice` restyled as warning badge card.
- **Company brief** = card, eyebrow `01 · COMPANY BRIEF`, two textareas (paper inputs), actions: `Save brief` primary + `Regenerate` outline.
- **Question categories** = one card per category, eyebrow `0N · CATEGORY NAME` where 02=technical, 03=behavioural, 04=system-design, 05=company-fit (continues after brief's 01; mono) + count badge + actions (`+ Add` outline-small, `Regenerate` outline-small). Question cards nested inside as paper cards: prompt (Inter 500 15px), outline (pebble 13px), meta badges (`d2`, requirement ids in mono, `hand-edited` accent badge when `_meta.origin !== 'generated'`), inline Edit / Move-to select / Delete. Drag handle stays; keyboard dnd unchanged.
- **Schedule** = card, eyebrow `06 · SCHEDULE`, rows: `Day 1` (mono) · focus (Inter 500) · right-aligned `45 min` + `6 questions` - never raw question IDs (map `question_ids.length`). Coverage warning line stays (warning color, mono ids allowed there since they're requirement refs) + `Regenerate schedule` outline.
- Generation state (status ≠ done): full-page progress view (existing `KitGenerationProgress`), restyled: numbered mono steps (`01 QUEUED … 08 DONE` vertical list), current step indigo + pulse, bar track flint / fill indigo, elapsed-time mono caption. SSE + 3s polling fallback logic untouched. Failure state: danger card + `Retry` + back link.

### 4.5 `/kits/[id]/practice`

- AppShell on. Header: `← Builder` ghost · display-sm `Practice` + role title · `Print one-pager` outline (print-hide).
- **FlashcardRunner** = paper card centered max-w-720: mono progress line `CARD 3 / 24 · COVERED 12` + keyboard hints (`←/→ · Space reveal`); flint track / charcoal fill progress bar; question in display 32px; reveal = outline button; answer body 16px; confidence trio = `Shaky` (danger outline) / `OK` (warning outline) / `Solid` (success outline) - semantic outlines, not saturated fills, to stay inside the flat system. Focus states preserved; buttons in tab order after reveal.
- **WeakSpots** = marble card with eyebrow `WEAK SPOTS`, summary line, grouped lists (shaky cards / uncovered musts) with mono requirement ids; print-break kept.
- Empty flashcards: `EmptyState` micro variant.

## 5. Auth flow contract

| Step | Behavior |
|---|---|
| Register | `POST /api/auth/register {email,password}` → session cookie set by backend → redirect `/kits?next` honored |
| Login | `POST /api/auth/login` → same |
| Guard | `GET /api/auth/me` 401 → `/login?next=<path>`; 200 → render children, show email |
| Logout | `POST /api/auth/logout` → clear state → redirect `/` |
| api.ts | Attach `status` + `code` from response body onto thrown errors (needed for AUTH/VALIDATION branching) |

## 6. States checklist (rubric Sec "interaction design")

Loading: kit list skeleton-free simple Spinner + "Loading kits"; builder existing loading + progress; practice Spinner. Empty: kits list, no flashcards. Thin: ThinKitNotice (warning). Errors: inline auth errors, danger banners, 409 conflict (kept), generation failed retry. Progress: KitGenerationProgress SSE+poll (kept, restyled). Optimistic edits: debounced PATCH + Saving/Saved indicator (existing logic, new UI chrome). Regen never clobbers hand edits: unchanged backend flags + accent badge surfacing them.

## 7. Accessibility + responsive

- Focus-visible outline kept globally (indigo, 2px) - adjust color to `--color-indigo` for palette coherence.
- Landmarks: header/main/footer in AppShell; each card section has `aria-label` (existing pattern kept).
- Keyboard: dnd-kit keyboard sensors, flashcard arrows/Space, Esc on any disclosure (BatchUpload as `<details>` needs no JS), visible focus on all `.btn`.
- Breakpoints: default mobile-first - hero display 48px → 88px at `sm`; create-form website/days row stacks; kit row meta wraps; builder category cards single column always (list is already vertical); practice card padding 16px on mobile.

## 8. Print (kept)

`.print-hide` hides shell/nav/actions; `.print-break` on weak-spots; body → white/black; borders stay for legibility.

## 9. Out of scope

- No new backend behavior; no API shape changes beyond reading `status`/`code` already returned.
- No dark mode, no animation library, no icon package (inline SVG / unicode only where needed).
- No TanStack Query / Zustand migration (existing fetch hooks in `lib/api.ts` stay; conventions allow fetch for this scope).
- Kit logic (`kitState.ts`) untouched - tests must stay green.

## 10. Verification

1. `npm run typecheck` (root, all workspaces) - clean.
2. `npx vitest run` in `frontend/` - kitState tests green (5 at design time; 6 after `nextFlashcardId` was added).
3. `npm run lint` (frontend eslint, incl. dangerouslySetInnerHTML ban) - clean.
4. `npm run build` (frontend) - all routes build.
5. Playwright (webapp-testing skill): home, register → auto-login → kits empty state, login flow, create-form validation, screenshots at 1280px + 390px widths; if time allows, one full kit generation → builder + practice screenshots.
