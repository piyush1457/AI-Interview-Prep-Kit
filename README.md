# AI Interview Prep Kit (FS-AI-INTERVIEW-01)

Turn a job description + company website + days-available into a personalised interview prep kit:
company brief, role breakdown, categorised question bank, flashcards, day-by-day schedule - all editable,
practicable, and reproducible via a batch CLI.

## Tech stack (chosen = preferred, no deviation to justify)

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 (App Router) + TypeScript + Tailwind 4 on Vercel |
| Backend | Node.js + Express 4 + TypeScript on Render |
| Database | MongoDB Atlas (Mongoose) |
| Shared contract | `packages/kit-schema` (Zod, single source for Appendix A/B) |
| Scraping | `fetch` + `cheerio` + `robots-parser` (our code, no heavy crawler dep) |
| LLM | Groq `openai/gpt-oss-20b` JSON mode (free tier; `GROQ_MODEL` override) |
| Public discussion | Brave (if key) → Tavily (if key) → DuckDuckGo HTML (zero key) |

Why Groq `gpt-oss-20b`: Groq retired the Llama chat lineup (verified live against
`/openai/v1/models` - only `gpt-oss-20b/120b`, `qwen`, `allam` remain for chat).
`gpt-oss-20b` is the fastest free-tier model with reliable `response_format: json_object`.

## Setup: local

```bash
npm install                          # also builds packages/kit-schema (prepare/postinstall)
cp .env.example .env            # then fill GROQ_API_KEY, MONGODB_URI, SESSION_SECRET
cp .env backend/.env
cp .env frontend/.env.local
npm run dev:backend             # http://localhost:4000
npm run dev:frontend            # http://localhost:3000 (proxies /api/* -> :4000)
```

If `@ai-prep/kit-schema` is missing after a partial install: `npm run build --workspace=packages/kit-schema`.

## Setup: deployed

See `DEPLOY.md`. Summary: Atlas M0 + Render web service (`backend/render.yaml`) +
Vercel project rooted at `frontend/` (`frontend/vercel.json`). Prod env:
`GROQ_API_KEY`, `MONGODB_URI`, `SESSION_SECRET`, `FRONTEND_URL=<vercel>`,
`API_URL=<render>`, `ALLOW_LOCALHOST=false`.

## Batch entry point (Sec 9, exact)

```bash
npm run evaluate -- --input <cases.json> --output <kits.json>
```

- Reads `[{id, jd, company_url, days}]`, runs the **same `runPipeline()` the app uses**
  (not a parallel implementation), `bypassDedupe: true` so reruns are always fresh.
- Writes `{version: "1.0", generated_at, kits: [{id, status: ok|failed, kit, error}]}`.
- Continues after one case fails; partial research stays `ok` with honest gaps -
  only no-kit-at-all is `failed`. Company sites may be `localhost:` URLs, so run with
  `ALLOW_LOCALHOST=true` for local fixtures.
- Timing: max 3 concurrent cases (`p-limit`), 2.5 min + queue-wait per case,
  13 min outer wall-clock → `BATCH_TIMEOUT` (2 min margin under the 15 min contract).
- Credentials from env (`.env.example`); nothing else needed beyond `npm install`.

## Which LLM + model

Groq `openai/gpt-oss-20b`, `temperature 0.3`, `response_format: {type: "json_object"}`,
one call per pipeline step through a shared `PQueue` (concurrency 1 + 500 ms gap),
45 s per-call timeout, 3× exponential backoff on 429/5xx, repair-once on invalid JSON
(fence-strip; failure surfaces as `LLM_INVALID_JSON`, never silent).

## High-level architecture

```
browser (Vercel origin) --same-site /api/*--> Next rewrites --> Express (Render)
POST /api/kits {jd, company_url, days} -> dedupe-check -> 202 {kitId, jobId}
  -> worker runPipeline() -> SSE /api/kits/:id/stream (steps + polling fallback)
PATCH /api/kits/:id {kit, If-Match: version} (409 on stale)
POST /api/kits/:id/regenerate {scope} | POST /:id/practice | GET /:id/weak-spots
POST /api/kits/batch (in-app multi-role upload, 20-row cap)
CLI backend/src/evaluate.ts imports runPipeline (p-limit 3, wall-clock, _meta strip)
```

Mongo: `users`, `kits {owner, dedupeHash unique, version, status, steps[], kit (+_meta), context, practice[]}`, `jobs`.

## Retrieval approach + sources

1. `safeFetch` (`fetch.ts`): http/https only, per-hop DNS validation that rejects
   private/loopback/link-local + `169.254.169.254` (SSRF), `redirect: manual` max 3 hops
   re-validated each hop, 10 s timeout, 1 MB cap, html/text only, `InterviewPrepKit/1.0` UA.
2. `crawlCompany` (`crawl.ts`): homepage → `cheerio` link scoring on
   `careers|hiring|jobs|about|handbook|blog|engineering|interview` (ranked, **no hard-coded
   paths** - GitLab/PostHog-style buried pages are found by score), same-origin relative
   links only, `robots.txt` respected via `robots-parser`, top-5 within a 60 s crawl budget.
3. Public discussion (`search.ts`): chain Brave → Tavily → DuckDuckGo HTML, top-5 from
   `glassdoor/reddit/leetcode/teamblind` where available; otherwise honest
   `NO_DISCUSSION` (never fatal).
4. Every failure is skip-and-record (`pages_used` + warnings); a site with no hiring page
   yields `NO_HIRING_PAGE` + an honest thin brief, never a fabricated one.

## Sequencing: research + generation steps (genuine, not one mega-prompt)

| # | Step | Owns | LLM? |
|---|---|---|---|
| S1 | Extract requirements `[{id, kind, priority}]` from JD only | `extraction.ts` | yes (1 call; <80-char stubs take a deterministic thin path, max 3 reqs, no invention) |
| S2 | Crawl + rank + fetch + discussion search | `crawl/search` | no |
| S3 | Company brief from crawl only | `generation.generateBrief` | yes (1 call; empty crawl → honest thin) |
| S4 | Questions, **4 separate calls** per category (`technical/behavioural/system-design/company-fit`) with relevant reqs + hiring context | `generation.generateCategory` | yes (4 calls; take-home vs design-round context changes output) |
| S5 | Flashcards (1 per must) | `generation.buildFlashcards` | no (derived) |
| S6 | **CODE** schedule allocation | `scheduling.allocateSchedule` | no (arithmetic) |
| S7 | **CODE** coverage check → gap-fill (max 2 passes) | `coverage` + `generateGapFill` | gap-fill only (1 call) |
| S8 | Zod validate before save; throw `SCHEMA_INVALID` if invalid | `kit-schema` | no |

must/nice rule: `required|must|years|proficient` → must; `bonus|nice|plus|preferred` → nice.
kind rule: stack/tools/years → technical; mentoring/communication → behavioural; industry → domain.

## Generated / edited / pinned state

Every question/flashcard/brief carries `_meta.origin: generated | edited | pinned`
(`tagGenerated` on creation). Hand edits set `edited` (implies pinned); category moves keep
the flag. `mergeRegen` on single-section regen drops only stale *generated* items of that
scope and keeps everything pinned - proven by `concurrency.test.ts`.
Optimistic concurrency: `Kit.version` + `If-Match` on PATCH/regenerate; stale writers get
409 + the fresh doc (“reloaded, re-apply”) instead of a silent clobber. `_meta` is stripped
(`stripMeta`) and re-validated before any batch output, so Appendix B stays exact.

## Schedule allocation

Pure arithmetic in `scheduling.allocateSchedule`: clamp 1–60 days, sort by
must-priority + difficulty (hard first, never the night before), round-robin across
exactly N days, integer minutes scaled 45–90/day (day 1 +10, last −5), every `question_ids`
entry validated to exist. 1-day packs all musts; 60-day spreads with review tail.

## Creative feature: why weak-spots + one-pager

The real problem after reading a kit is *“what do I still not know?”* - so practice records
confidence 1–3 per card, the next queue sorts least-confident-first (transparent weighted
sort, defended over full SM-2 as timebox-appropriate), and `GET /:id/weak-spots` aggregates
shaky cards + uncovered must-haves + suggested days. The print CSS one-pager is a near-free
second win for last-day revision. Both reuse existing data; no new pipeline cost.

## Key design decisions + trade-offs

- **Job + SSE over request/response:** 90 s Groq runs + Render cold starts would time out a
  direct POST; jobs give visible progress, retry, and double-submit safety.
- **Same-site via Next rewrites** (`next.config.ts` + `trust proxy`): cross-site cookies
  break under Safari ITP; proxying keeps the session first-party (`SameSite=Lax`).
- **Deterministic schedule/coverage in code:** the two things the brief forbids the model
  from deciding; also makes them unit-testable without a key.
- **Shared Groq queue (1 + 500 ms):** free-tier TPM is per-minute, not per-request; one
  global queue + per-case `queueWaitMs` exclusion (deadline = start + 150 s + wait) prevents
  both 429 storms and spurious timeouts - at the cost of serial LLM throughput.
- **13 min outer wall-clock:** bounds the batch even when per-case deadlines stretch;
  pending cases become `BATCH_TIMEOUT`, output always writes (2 min margin).
- **CLI bypasses dedupe:** app dedupes on `sha256(user+jd+url+days)`; batch is “run now”
  by contract, so reruns are never stale.
- **Pin-then-connect honesty:** Node native fetch has no custom-lookup pinning hook without
  an undici dispatcher; we validate resolved IP immediately before each hop's connect
  (per-hop resolve-then-fetch). Documented, tested per hop.

## Known limitations

- Atlas `0.0.0.0/0` (no VPC peering on free tier) + strong password; rotate post-review.
- No Brave key → discussion chain falls to Tavily → DuckDuckGo HTML (fragile to layout change).
- Practice ordering is a simple confidence sort, not SM-2 spaced repetition.
- Regen reuses stored crawl context; it does not re-crawl (fresh posting edits need a new kit).
- In-process workers (no separate queue dyno - Render free sleeps; documented).

## Edge cases and failure handling (Sec 10)

| Case | Behaviour |
|---|---|
| Invalid company URL / bad scheme | `safeFetch` rejects; recorded as warning; kit still builds (honest brief) |
| 404 / unreachable host / timeout | `COMPANY_UNREACHABLE` per page; skip-and-record; not fatal to the run |
| No hiring or about page | `NO_HIRING_PAGE` note + honest thin brief; question gen still runs on JD |
| Thin 2-line JD (&lt;80 chars) | Deterministic thin path: max 1 requirement, no invented fields |
| No public discussion | `NO_DISCUSSION` warning; never fatal |
| Model returns invalid JSON | Fence-strip repair once, else `LLM_INVALID_JSON` (never silent) |
| LLM rate limit (429) / 5xx | 3× exponential backoff + shared queue (1 + 500 ms) |
| Same description+company twice | Dedupe hash returns existing kit (`deduped: true`); CLI uses `bypassDedupe` |
| 1-day or 60-day schedule | Clamped 1–60; 1-day packs all musts; 60-day spreads |
| Malformed `cases.json` input | CLI exits with clear error before writing output |

Pipeline warnings (`NO_HIRING_PAGE`, crawl errors, timeouts) are persisted on the kit and shown as “Research notes” in the builder.

## Tests

```bash
npm run test --workspace=backend    # 14 files / 46 tests (mocked LLM/fetch, no key needed)
npm run test --workspace=frontend   # kitState (edit flags, reorder, queue order, id alloc)
npm run typecheck                   # all 3 workspaces
```

Suites: schedule, coverage, kit-validate, llm-retry, ssrf-redirect, dns-rebinding,
dedupe, dedupe-bypass, batch-upload, kits-ownership (If-Match/409/owner), concurrency (pinned regen), batch-concurrency
(shared-queue serialization), batch-output-hygiene (`_meta`), batch-wall-clock
(`BATCH_TIMEOUT`). CI: `.github/workflows/ci.yml` runs typecheck + lint + tests.