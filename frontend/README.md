# Frontend (Next.js)

Apollo-styled App Router UI for AI Interview Prep Kit (FS-AI-INTERVIEW-01).

## Scripts

```bash
npm run dev         # next dev (http://localhost:3000, rewrites /api/* -> API_URL)
npm run build       # next build
npm run start       # next start
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
npm run test        # vitest run (kitState)
```

## Layout

- `src/app/` - routes: `/`, `/login`, `/register`, `/kits`, `/kits/[id]`, `/kits/[id]/practice`
- `src/components/atoms|organisms|kits|practice` - design system + feature UI
- `src/lib/api.ts` - same-origin fetch client (If-Match on PATCH/regenerate)
- `src/lib/kitState.ts` - pure builder helpers (unit-tested)
- `src/app/globals.css` - Apollo `@theme` tokens + component classes

Proxy: `next.config.ts` rewrites `/api/*` to `API_URL` so session cookies stay first-party.

Design source: `Apollo.md`. Root docs: see repo `README.md`.
