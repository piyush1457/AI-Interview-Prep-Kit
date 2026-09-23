# Backend

Express + TypeScript API for AI Interview Prep Kit (FS-AI-INTERVIEW-01).

## Scripts

```bash
npm run dev         # tsx watch src/index.ts (http://localhost:4000)
npm run build       # tsc -p tsconfig.json
npm run start       # node dist/index.js
npm run typecheck   # tsc --noEmit
npm run test        # vitest run
npm run evaluate    # batch CLI: -- --input cases.json --output kits.json
```

## Layout

- `src/index.ts` - app bootstrap, middleware order, error handler
- `src/routes/` - auth, kits (CRUD/PATCH/SSE), kitsBatch, regen, practice, weakSpots
- `src/services/` - runPipeline, fetch (SSRF), crawl, extraction, generation, scheduling, coverage, llm, evaluate
- `src/middleware/` - session, requireAuth, asyncHandler, rateLimit
- `tests/` - deterministic Vitest suites (mocked LLM/fetch, no API key needed)

Batch entry (Sec 9): `npm run evaluate -- --input <cases.json> --output <kits.json>` from repo root.

Env: see repo root `.env.example` (GROQ_API_KEY, MONGODB_URI, SESSION_SECRET, ALLOW_LOCALHOST, ...).
