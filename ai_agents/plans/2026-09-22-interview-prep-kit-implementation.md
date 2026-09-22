# Plan: Interview Prep Kit — Phased Implementation (Option A Job+SSE, 95+ target)

Date: 2026-09-22 · Status: **Planned (95+ hardened)** · Implementer: piyus + agent

## Problem
Greenfield build of FS-AI-INTERVIEW-01 in 4 days (2-3 focused): sequenced Groq pipeline with deterministic schedule/coverage, SSRF-safe crawl, editable builder that survives regen, practice + weak-spots, batch `npm run evaluate`, Vercel+Render+Atlas deploy, README + 3-4min video. Must not hallucinate on thin JDs.
95+ means: auto ≥52/55 + human ≥43/45. Every critical review gap closed; no demo-breaking auth; honest thin kits; exact schemas.

## Decisions
| Decision | Choice |
|---|---|
| Monorepo | `/frontend`, `/backend`, `/packages/kit-schema`; shared Zod is single source for Appendix A/B + error enum |
| Auth transport | Next.js `rewrites() /api/* -> API_URL` proxy; first-party `HttpOnly, SameSite=Lax, Secure prod` session; origin check on mutations; login + register rate-limit (limiter factory); Express `trust proxy=1` |
| Pipeline | Job+SSE, `runPipeline()` shared by API + CLI + batch-upload; Groq openai/gpt-oss-20b via shared PQueue singleton (concurrency 1 + 500ms across all jobs, tracks queueWaitMs per case), 45s/call, 3x backoff, max 2 coverage passes, wall 2.5min + queueWaitMs per case (v2 fix A, PIPELINE_TIMEOUT on exceed), partial-honest ok on exceed |
| Batch CLI | p-limit(3) concurrent cases; `_meta` stripped + `validateKit()` on cleaned object pre-write; `bypassDedupe:true` so reruns always fresh; 13min outer wall-clock (`BATCH_WALL_MS`) via Promise.race marks pending as BATCH_TIMEOUT; 5 cases ≈ 2 waves x 2.5min ≈ 5-7min normal, always writes <13min even with queueWait stretch, <15min hard req |
| Batch outer wall-clock (v3) | Top-level `Promise.race(batchPromise, setTimeout 13min)` in `evaluate.js` independent of per-case deadlines; on expiry mark any pending cases `failed {code: BATCH_TIMEOUT}` and flush `kits.json` immediately; gives 2min margin under 15min; prevents unbounded queueWaitMs from blowing contractual batch time |
| Retrieval | cheerio+robots-parser, keyword link scoring (no hard-coded paths), top-5, 10s/1MB per page, 60s crawl budget; `redirect:manual` + hop re-validation (max 3); safeLookup pin-then-connect DNS IP check on initial + every hop; Brave optional with honest fallback |
| Dedupe | `sha256(userId+norm(jd)+norm(url)+days)` unique for app (`POST /api/kits`, `kitsBatch`); CLI `evaluate.js` bypasses dedupe (`bypassDedupe:true`) so `cases.json` reruns are never stale |
| Batch upload (app) | `POST /api/kits/batch` JSON/CSV, 1MB/20-row caps, fan-out to jobs |
| Builder state | `origin: generated\|edited\|pinned` + `version` optimistic concurrency (If-Match/409); pinned survives regen; dnd-kit + keyboard |
| Practice | Confidence 1-3, least-confident-first; weak-spots + print one-pager |
| Deploy | FE Vercel, BE Render, Mongo Atlas; `ALLOW_LOCALHOST=true` only for evaluate tests |

## Existing Building Blocks
- `software-engineer-assignment.pdf` (spec, Appendices A/B exact)
- `.opencode/skills/{frontend-conventions,security-auditor,run-tests}` (patched for Next.js/SSRF/mandatory suites)
- `docs/superpowers/specs/2026-09-22-interview-prep-kit-design.md` (approved design)

## Design Overview
```
browser (Vercel origin) --same-site /api/*--> Next rewrites --> Express (Render)
POST /api/kits {jd, company_url, days} -> dedupe-check -> job(queued) -> worker: extract -> crawl/rank/fetch (hop-validated) -> interview-search -> brief -> 4x questions -> flashcards -> CODE schedule+coverage -> gap-fill (max2) -> validate -> done/failed
SSE /api/kits/:id/stream emits steps. PATCH /api/kits/:id {edits, If-Match: version} (409 on stale), POST /:id/regenerate {scope}, POST /:id/practice, GET /:id/weak-spots, POST /api/kits/batch (app multi-role).
CLI backend/evaluate.js imports runPipeline, p-limit(3), per-case 2.5min+queueWait budget, 13min outer Promise.race wall-clock (BATCH_TIMEOUT), strips _meta + validates cleaned kit, writes Appendix B with error enum.
```

## Changes by File
### Phase 0 — Scaffold (0.5 day) — unblocks 95+ auth + schema
- `package.json` (workspaces, scripts: dev/build/test/evaluate), `.env.example` (GROQ_API_KEY, BRAVE_API_KEY?, MONGODB_URI, SESSION_SECRET, API_URL, ALLOW_LOCALHOST, NEXT_PUBLIC_API_BASE), `.gitignore`
- `packages/kit-schema/{package.json,index.ts,errors.ts}` — Zod Appendix A + B exact + `ErrorCode` enum + `validateKit()` + `dedupeHash()`
- `backend/{package.json,src/{index.ts (trust proxy),db.ts,models/{User.ts,Kit.ts (dedupeHash unique, version),Job.ts},middleware/{session.ts (first-party cookie flags),owner.ts,validate.ts,rateLimit.ts (factory for login+register)}}}` — Express, limiters, healthz
- `frontend/` — Next.js App Router scaffold, Tailwind, `next.config.js rewrites`, `app/(auth)/login|register`, `app/kits/`, `loading.tsx/error.tsx`, no `dangerouslySetInnerHTML` lint rule
### Phase 1 — Pipeline core (1 day, highest points: extraction 20 + sequencing 10)
- `backend/src/services/{fetch.ts (redirect manual + safeLookup pin-then-connect per hop),crawl.ts (score+robots+budgets),search.ts (Brave w/ NO_DISCUSSION fallback)}`
- `backend/src/services/{llm.ts (Groq shared PQueue singleton that records queueWaitMs per wait, backoff, repair-once),extraction.ts (must/nice + kind rules, JD_TOO_THIN),generation.ts (4 category prompts + hiring-context injection)}`
- `backend/src/services/{scheduling.ts (exact N, musts-placed, hard-first, int min, 1/60-day),coverage.ts (gap detect)}` — pure + unit-tested; `runPipeline.ts` orchestrator (wall 2.5min + queueWaitMs, step events, partial-honest on timeout, bypassDedupe flag)
- `backend/src/routes/{kits.ts (dedupe for app),kitsBatch.ts (caps + fan-out reuse runPipeline),jobs.ts}` + `SSE stream (flush + no-transform + polling fallback)`, `backend/evaluate.js` CLI (p-limit 3, bypassDedupe:true, 13min outer wall-clock Promise.race -> BATCH_TIMEOUT, _meta strip + re-validate gate, continue-on-fail, localhost flag)
### Phase 2 — Builder + practice (0.75 day, builder 15 + practice/creative 10)
- `frontend/features/kits/{KitBuilder.tsx,QuestionList.tsx (dnd-kit + keyboard),BriefEditor.tsx,BatchUpload.tsx,RegenButton.tsx,KitGenerationProgress.tsx (SSE steps),EmptyKits.tsx,ThinKitNotice.tsx}` — optimistic PATCH with version, pinned preservation proof
- `frontend/features/practice/{FlashcardRunner.tsx (arrows/space/Esc),ConfidenceButtons.tsx,ProgressBar.tsx,WeakSpots.tsx}` + `app/kits/[id]/practice/page.tsx` + print CSS one-pager
- `backend/src/routes/{regen.ts (scope + merge pinned),practice.ts,weakSpots.ts}` — scope regen, confidence persistence
### Phase 3 — Harden + deploy + README/video (0.5-0.75 day, robustness 10 + code/README 10 + interaction 10)
- `backend/tests/{schedule.test,coverage.test,kit-validate.test,ssrf-redirect.test,dns-rebinding.test,batch-concurrency.test,batch-output-hygiene.test,batch-wall-clock.test,dedupe.test,dedupe-bypass.test,batch-upload.test,concurrency.test,llm-retry.test}` + fixtures (thin JD, no-hiring-page site, 302-to-private stub, mocked-DNS-private stub, localhost :8099 stub); `frontend` Vitest builder/practice tests
- Render/Vercel/Atlas wiring (proxy envs incl. trust proxy, CORS closed to Vercel origin only, CSP/security headers, SSE flush + no-transform), `README.md` (all required subsections incl. proxy-why, pin-then-connect closed, dedupe+CLI bypass, batch-timing arithmetic 3x2.5min/2 waves/shared-queue+queueWait bound + 13min outer wall-clock with BATCH_TIMEOUT, _meta strip, pinned+version, schedule algo, weak-spots why, trade-offs, limitations), seed `fixtures/cases.json` (5 cases incl. thin + no-hiring-page)
- Walkthrough video script (end-to-end paste->progress->kit, 2nd-pass gap close log, edit+reorder+regen-preserves, practice+schedule+weak-spots, 1 defended decision: CODE schedule/coverage)

## Auth Flows / API Contracts / Data Models
- Auth: POST /api/auth/{register,login (rate-limited),logout} (bcrypt 10 + first-party HttpOnly session via proxy); 401 + login redirect on expiry; owner-check on all /kits/:id; origin check on mutations.
- `POST /api/kits {jd, company_url, days} -> 202 {kitId, jobId} | 200 {kitId, deduped:true}` (server hash dedupe)
- `POST /api/kits/batch {items:[{jd, company_url, days}]} (≤20 rows, JSON or CSV) -> {batchId, kitIds[], rowErrors[]}`
- `GET /api/kits/:id/stream (SSE step+%)`, `GET /api/kits/:id`, `PATCH /api/kits/:id {edits, If-Match: version} -> 409 {kit} on stale`, `POST /api/kits/:id/regenerate {scope: brief|category:<name>|schedule}`, `POST /api/kits/:id/practice {cardId, confidence 1-3}`, `GET /api/kits/:id/weak-spots`
- Kit: Appendix A exact + `_meta:{origin, version}`; Batch I/O: Appendix B exact with ErrorCode enum (`PIPELINE_TIMEOUT` per-case, `BATCH_TIMEOUT` outer 13min); `failed` only when no kit at all (including wall-clock expiry).

## Tests (95+ matrix — deterministic, mocked LLM/fetch)
1. schedule: N days exact, all musts placed, int minutes, hard-first, 1-day packs all + 60-day spreads w/ review, question_ids exist
2. coverage: stable r-ids, refs valid, gaps detected, 2nd pass fills, thin JD invents nothing (JD_TOO_THIN)
3. kit-validate: exact names/enums, difficulty 1-3, minutes int, schedule refs exist
4. ssrf-redirect: 302 to 169.254/private blocked per hop; direct private blocked; localhost allowed only with flag; robots respected
5. dedupe: same user+jd+url+days in app returns same kit; different days/user creates new
6. dedupe-bypass: evaluate twice same cases.json with bypassDedupe -> two fresh generated_at, not cached
7. batch-upload: 21 rows / >1MB rejected VALIDATION; row errors don't abort batch; fan-out reuses runPipeline
8. concurrency: stale If-Match -> 409, no clobber; regen preserves pinned/edited
9. llm: 429 retries 3x then succeeds via shared queue; queueWaitMs counted; invalid JSON repaired once else LLM_INVALID_JSON; unreachable recorded COMPANY_UNREACHABLE not fatal
10. batch CLI: 5 local-URL cases <15min (2.5min+queueWait/case, p-limit 3), 1 forced fail continues, output shape exact, no _meta
11. FE: optimistic edit + pinned survives regen, keyboard reorder, practice least-confident ordering
12. batch-concurrency: 5 slow-mock cases finish <15min at p-limit 3; shared queue allows ≤1 simultaneous Groq call across jobs; case 3 does not spuriously PIPELINE_TIMEOUT from queue-wait (deadline = start+150s+queueWaitMs)
13. dns-rebinding: mocked-DNS private IP blocked at connect time (pin-then-connect), incl. on redirect hop
14. batch-output-hygiene: kits.json has no _meta/non-Appendix-A fields; cleaned object passes validateKit()
15. batch-wall-clock: mock 429 storms / pathological queue contention, whole run still terminates and writes output within 13min outer budget with pending cases as BATCH_TIMEOUT, not hang

## Verification
```bash
npm install
npm run test -- schedule.test; npm run test -- coverage.test; npm run test -- kit-validate.test
npm run test -- ssrf-redirect.test; npm run test -- dns-rebinding.test; npm run test -- dedupe.test; npm run test -- batch-upload.test; npm run test -- concurrency.test
npm run test -- batch-concurrency.test; npm run test -- batch-output-hygiene.test; npm run test -- batch-wall-clock.test
npm run typecheck; npm run lint
# proxy check: curl -i /api/health shows proxied + Set-Cookie SameSite=Lax HttpOnly
# local e2e: backend with ALLOW_LOCALHOST=true + node stub server on :8099 (normal + thin JD + no-hiring-page + 302-to-private)
npm run evaluate -- --input fixtures/cases.json --output /tmp/kits.json
time npm run evaluate -- --input fixtures/cases.json --output /tmp/kits.json   # expect well under 15min (≈5-7min)
# dedupe-bypass check:
npm run evaluate -- --input fixtures/cases.json --output /tmp/kits2.json && diff <(jq .kits[0].kit.source.researched_at /tmp/kits.json) <(jq .kits[0].kit.source.researched_at /tmp/kits2.json) # should differ (fresh run)
# prod SSE check:
curl -N https://<vercel-app>/api/kits/<id>/stream   # confirm incremental events, not buffered; else polling fallback engages
# 95+ gate: all 15 suites green + evaluate 5/5 processed + kits validate + schedule exact + zero invented reqs on thin fixture + no _meta in output + rerun fresh + wall-clock never exceeds 13min (BATCH_TIMEOUT path tested)
```

## Security Notes
Pin-then-connect SSRF (safeLookup on initial + every hop) + content-type/size + robots + UA + per-host limit + backoff per security-auditor Sec 8; crawl as DATA-only (delimiters, never system-prompt interpolate); keys server-only; first-party cookies (trust proxy) + login/register limiters + owner checks; validate all input with kit-schema; CSP + nosniff + no-dangerouslySetInnerHTML; Atlas 0.0.0.0/0 + strong password documented.

## Open Questions / Follow-ups
- Brave key availability? If none, ship search-stub + NO_DISCUSSION honest (documented, still `ok`).
- Groq observed TPM? Shared singleton locked to 1 + 500ms gap; add GROQ_DELAY_MS env if 429 persists.
- Atlas allowlist: 0.0.0.0/0 timebox documented; rotate password post-review.
- Native fetch pin-then-connect wiring: confirm dispatcher/connect.lookup path for chosen client version during Phase 1.

## Backlog
- Full SM-2 spaced repetition (chose simple sort, defended), JD overlap compare, team sharing (out-of-scope per brief).

## Status Update (2026-09-22, v3)
Plan hardened to 95+ incl. addendum + v2 + outer wall-clock (proxy + trust proxy + login/register limiters, pinned SSRF, dedupe + CLI bypassDedupe, batch upload, 2.5min+queueWait/p-limit-3/shared Groq queue with queueWaitMs, 13min outer Promise.race -> BATCH_TIMEOUT, 409 concurrency, error enum inc. PIPELINE_TIMEOUT/BATCH_TIMEOUT, _meta-strip gate, SSE curl-N + polling fallback, 15-suite matrix); awaiting go-ahead to start Phase 0 scaffold.
