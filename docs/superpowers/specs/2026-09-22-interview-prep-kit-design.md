  # Design: AI Interview Prep Kit (FS-AI-INTERVIEW-01) — 95+ Target

  Date: 2026-09-22 · Status: Approved + Hardened for 95+ · Author: piyus + agent
  TRAO_ASSESSMENT_ID: FS-AI-INTERVIEW-01 | LLM: Groq llama-3.1-8b-instant | Stack: Next.js + Express + Mongo Atlas | Deploy: Vercel + Render + Atlas
  Target: Automated ≥52/55, Human ≥43/45 → total ≥95/100

  ## 1. Purpose / Success Criteria
  Turn JD text + company_url + days into a scored kit (Appendix A exact): company_brief, role breakdown, categorised questions, flashcards, schedule + coverage. Auto 55pts (extraction 20, coverage+schedule 15, sequencing 10, robustness 10) + human 45pts (builder 15, interaction 10, code/README 10, practice+creative 10). Must survive Groq 429, 90s runs, thin JDs, missing hiring pages, and `npm run evaluate` 5-cases/15min from clean clone.
  95+ bar: extraction invents nothing + must/nice correct; every must has ≥1 question; schedule exactly N days with all musts + int minutes + hard-first; crawl genuinely ranks links (no hard-coded paths); kits validate exact; unreachable recorded not fatal; login/demo never breaks cross-origin; builder regen preserves pinned; loading/empty/error + keyboard + responsive polished.

  ## 2. Decisions
  | Decision | Choice + rationale |
  |---|---|
  | Pipeline shape | Option A Job+SSE: POST /kits -> job -> worker runPipeline() -> SSE progress. Survives timeouts, reuses same code for batch, required for visible progress/failure states. |
  | Auth transport (95+ fix #1) | Same-site via Next.js proxy: browser calls `/api/*` on Vercel origin; `next.config.js rewrites()` forwards to Render `API_URL`. Session cookie stays first-party: `HttpOnly, SameSite=Lax, Secure in prod`. No cross-site cookies, no ITP breakage. Fallback bearer header supported for CLI only. CSRF: SameSite + origin check on mutations. |
  | LLM | Groq llama-3.1-8b-instant JSON mode, 1 call per step via single module-level shared queue (`llm.ts` PQueue singleton, concurrency 1 + 500ms gap across ALL jobs; queue tracks per-case `queueWaitMs`), per-call timeout 45s, retry 3x exponential on 429/5xx, repair-once on invalid JSON then honest fallback. Per-case wall budget 2.5min + queueWaitMs (effective deadline = start + 150s + queueWait, so queue-contention doesn't eat into generation; recommended fix A). On exceed -> save partial honest kit (status ok with PIPELINE_TIMEOUT gap), never hang batch. Batch runs max 3 concurrent cases (p-limit) -> 5 cases in ~2 waves x 2.5min ≈ 5-7min incl. serial LLM queue, under 15min. Batch outer wall-clock 13min (below) caps total even if per-case deadlines stretch. Addendum v2: dedupe bypass for CLI (below). |
  | Batch wall-clock (outer budget, v3) | One top-level timer in `evaluate.js`: 13min outer wall-clock (`BATCH_WALL_MS=780_000`) independent of per-case deadlines. `Promise.race` over batch promise vs timeout; on expiry mark any still-pending cases `failed` with `BATCH_TIMEOUT` and write output immediately with whatever completed. Guarantees contractual "5 cases within 15min" even if queueWaitMs stretches per-case deadlines on a bad Groq day. Leaves 2min margin under the 15min hard requirement. |
  | Retrieval | cheerio + robots-parser, link-score keywords, top-5 fetch (10s timeout, 1MB cap, 60s crawl budget total), Brave Search API for interview discussion, honest empty if missing. |
  | SSRF hardened (95+ fix #2, addendum: pin-then-connect) | `redirect:manual`, max 3 hops, re-validate every hop (scheme http/https). Custom `safeLookup()` DNS resolver passed into fetch client so the IP validated is the IP connected to (pin-then-connect, closes DNS-rebinding check-then-connect gap), applied on initial + every redirect hop; reject 10/8,172.16/12,192.168/16,127/8,::1,169.254/16 incl. 169.254.169.254 at connect time; same-origin relative links only; `ALLOW_LOCALHOST=true` bypass only for evaluate; identifying User-Agent. |
  | Dedupe (95+ fix #3, v2: CLI bypass) | Server hash `sha256(userId + norm(jd) + norm(company_url) + days)` with unique index; App `POST /api/kits` + `POST /api/kits/batch` dedupe -> 200 `{deduped:true}`. CLI `npm run evaluate` bypasses dedupe entirely (`runPipeline(...,{bypassDedupe:true})` / `evaluate.js` flag) so repeated runs of same `cases.json` always re-run pipeline, never return stale cached kits — batch tool is "run now" by contract, not cache. |
  | Multi-role upload (95+ fix #4) | In-app `POST /api/kits/batch` (JSON array or CSV `jd,company_url,days`) capped 1MB / 20 rows, per-row Zod validation, fans out to N jobs reusing runPipeline, returns `{batchId, kitIds}` + per-row errors; UI `BatchUpload.tsx` with drag-drop + row preview. Separate from CLI Sec 9. |
  | Deterministic in code | Schedule allocation + coverage gap check in code, never LLM. Max 2 coverage passes then ship honest uncovered list. |
  | Builder state + concurrency (95+ fix) | origin: generated\|edited\|pinned; hand edit -> edited+pinned; category regen preserves pinned; Kit doc `version` increments per mutation; PATCH requires `If-Match: version`, 409 + fresh doc on stale (covers 2-tab race). dnd-kit reorder optimistic + debounced PATCH + full keyboard reorder (arrows + space). |
  | Practice ordering | Confidence 1-3 per card, next session sorted least-confident first (simple weighted sort, defended in README vs SM-2: timebox + transparent). |
  | Creative | Weak-spots report (low-confidence + uncovered musts) — reuses existing data, cheapest 10pt path. Plus printable one-pager export (window.print CSS) as near-free second win. |
  | Error taxonomy (95+ fix) | `COMPANY_UNREACHABLE, NO_HIRING_PAGE, NO_DISCUSSION, JD_TOO_THIN, LLM_INVALID_JSON, RATE_LIMITED, SCHEMA_INVALID, PIPELINE_TIMEOUT, BATCH_TIMEOUT, VALIDATION, AUTH, DEDUPED` — batch `error.code` always from enum; partial-research stays `ok` with gaps, only no-kit-at-all is `failed` (BATCH_TIMEOUT for outer budget, PIPELINE_TIMEOUT for per-case). |

  ## 3. Architecture
  ```
  monorepo/
    frontend/ (Next.js App Router, Vercel): app/(auth)/, app/kits/, app/kits/[id]/practice, components/atoms|molecules|organisms, features/kits|practice (+BatchUpload), next.config.js rewrites /api/* -> API_URL
    backend/ (Express, Render): routes/auth|kits|kitsBatch|jobs, services/retrieval|extraction|generation|scheduling|coverage|batch, middleware/session+owner-check+validate+rateLimit, evaluate.js CLI
    packages/kit-schema/ (shared Zod: Appendix A exact names/enums, Appendix B batch shape, error-code enum)
  Mongo: users, kits {owner, dedupeHash unique, version, status, steps[], kit:{...Appendix A + _meta origin}, practice[]}, jobs {kitId, step, status, error}
  Flow: browser POST /api/kits (same-origin, proxied) {jd, company_url, days} -> 202 {kitId} -> SSE GET /api/kits/:id/stream {step,status} -> GET /api/kits/:id -> PATCH with If-Match version -> POST /:id/regenerate {scope}
  Batch UI: POST /api/kits/batch {items[]} -> {batchId, kitIds[], rowErrors[]}
  ```
  Auth: bcrypt(10) + express-rate-limit on login AND register (20/15min/IP, limiter factory) + session httpOnly first-party cookie; Express `app.set('trust proxy', 1)` so Secure cookies + limiter IPs are correct behind Render; 401 -> login redirect; owner-check on all /kits/:id.

  ## 4. Retrieval Detail
  1. Validate company_url (http/https, custom safeLookup DNS -> IP check SSRF block private/loopback/metadata at connect time = pin-then-connect; ALLOW_LOCALHOST=true only for evaluate).
  2. Fetch with `redirect:manual`; on 3xx re-validate + safeLookup Location hop (max 3 hops, same pin-then-connect check each hop); else abort hop as COMPANY_UNREACHABLE-recorded.
  3. GET homepage (10s timeout, 1MB cap, html/text only, UA `InterviewPrepKit/1.0`), check robots.txt (robots-parser, respect Disallow + crawl-delay), parse <a> with cheerio, score href+anchor for careers|hiring|jobs|about|handbook|blog|engineering|interview, fetch top-5 same-origin relative links within 60s crawl budget.
  4. Clean (strip scripts/styles, text-only, truncate), record pages_used[].
  5. Interview discussion: Brave Search `<company> interview process` (Glassdoor/Leetcode/Reddit); no key or zero hits -> sources:[] + NO_DISCUSSION honest.
  6. Any source fail -> skip + record, never abort run. Thin/empty crawl -> honest thin brief ("site exposes no hiring page"), never fabricate.
  7. LLM safety: all crawl+JD wrapped as `<<<UNTRUSTED-DATA>>>` delimiters, system prompt forbids following embedded instructions; never `dangerouslySetInnerHTML` on render (React escape default) + CSP `default-src 'self'`.

  ## 5. Generation Sequencing (genuine, per-category) — extraction 20pts
  - S1 extract requirements [{id:r1.., text, kind:technical|behavioural|domain, priority:must|nice}] from JD only. must/nice rule: required|must|years|proficient -> must; bonus|nice-to-have|plus|preferred -> nice. kind rule: tools/stack/years -> technical; mentoring/communication/leadership -> behavioural; industry/regulatory -> domain. 2-line JD -> 1-3 reqs + JD_TOO_THIN flag, invent nothing.
  - S2 company_brief {summary, what_they_do, sources} from crawl only; thin crawl -> honest thin brief.
  - S3 questions: 4 separate Groq calls (technical / behavioural / system-design / company-fit) with relevant reqs + hiring context (take-home vs system-design round changes output). Every question {id:q.., requirement_ids:[r..] (non-empty, valid), category, difficulty 1-3}.
  - S4 flashcards [{id, front, back, requirement_ids}] from questions (1 per must minimum).
  - S5 CODE: schedule (sort musts+diff3 first, distribute across exactly N days, 45-90 min/day scaled, int minutes, 1-day packs all musts, 60-day spreads + review days) + coverage (every must has ≥1 question).
  - S6 gaps -> 1 targeted gen call -> re-check; passes<=2; coverage {uncovered_requirement_ids, passes}. Residual uncovered musts -> still `ok` with honest list (only no-kit-at-all is `failed`).
  - Validate with kit-schema Zod before save; invalid -> repair-once else failed job with SCHEMA_INVALID/LLM_INVALID_JSON.

  ## 6. Builder / Practice / Schedule / Batch — builder 15pts + interaction 10pts
  - Builder: inline edit, dnd-kit + keyboard reorder + move category, add/delete, regen single section (brief | one category | schedule) via POST /api/kits/:id/regenerate {scope, If-Match}; pinned survives; 409 shows "refreshed, re-apply" instead of clobber. Skeleton + optimistic UI, no per-keystroke round-trip.
  - Interaction: SSE progress steps (queued→crawling→extracting→generating→scheduling→done/failed) with % + retry button on fail; flush + `Cache-Control: no-transform, no-buffering` so Vercel streams incrementally (prod check `curl -N`); polling fallback `GET /api/kits/:id` every 3s if SSE stalls. Empty (no kits), thin-kit notice ("JD had N requirements, kit is intentionally thin"), error states; responsive Tailwind breakpoints; keyboard: tab order, arrows step flashcards, Enter edit, Esc close, visible focus rings.
  - Practice: step-through, reveal, confidence 1-3, covered/uncovered bar, next queue = least-confident; weak-spots = low-confidence cards + uncovered musts + suggested day focus; print CSS one-pager.
  - Schedule: {days_available:N, days:[{day, focus, question_ids (exist), minutes:int}]}; every must placed; hard first; exactly N days.
  - Batch CLI: `npm run evaluate -- --input cases.json --output kits.json` imports `runPipeline()` with `bypassDedupe:true`, max 3 concurrent via p-limit, reads [{id,jd,company_url,days}], per-case budget 2.5min + queueWaitMs (partial-honest ok on exceed), outer wall-clock 13min total (`BATCH_WALL_MS`) via `Promise.race` that on expiry marks pending cases `failed` `BATCH_TIMEOUT` and flushes output, strips `_meta`/non-Appendix-A then `validateKit()` on cleaned object as pre-write gate, writes {version:"1.0", generated_at, kits:[{id,status:ok|failed,kit,error:{code,message}}]}, continues on fail, env from .env.example, no setup beyond npm install; localhost allowed only with ALLOW_LOCALHOST=true; normal 5 cases ≈ 2 waves x 2.5min ≈ 5-7min <13min; worst-case still writes within 13min with BATCH_TIMEOUT for stragglers, never hangs to 15min; second run on same input re-runs all cases (no dedupe). |

  ## 7. Security / Edge / Tests — robustness 10pts + code/README 10pts
  - Security: SSRF hop-validated guard, content-type html/text only, size caps, UA + crawl-delay + per-host rate-limit + backoff, crawl as DATA-only, keys server-env only, first-party session cookie + login rate-limit, owner-only access, CSP + `X-Content-Type-Options, Referrer-Policy, X-Frame-Options`, Atlas 0.0.0.0/0 + strong password documented as timebox limitation.
  - Edges: invalid/404/timeout URL -> COMPANY_UNREACHABLE (kit still ok if JD usable); no hiring page -> NO_HIRING_PAGE honest brief; 2-line JD -> JD_TOO_THIN thin kit; no discussion -> NO_DISCUSSION; invalid LLM JSON -> repair-once else LLM_INVALID_JSON retry; 429 -> RATE_LIMITED backoff; duplicate in app -> DEDUPED return; CLI duplicate is NOT deduped (bypass, always re-runs); 1/60 days exact; batch upload >20 rows/1MB -> VALIDATION reject. |
  - Tests (deterministic, mocked LLM/fetch): schedule.test, coverage.test, kit-validate.test, ssrf-redirect.test (302 to private IP blocked), dns-rebinding.test (mocked DNS private IP blocked at connect + on hop), dedupe.test (app dedupes, CLI bypassDedupe re-runs), batch-upload.test (caps + fan-out), batch-concurrency.test (5 slow-mock cases <15min, shared queue ≤1 Groq call, no spurious PIPELINE_TIMEOUT from queue-wait), batch-output-hygiene.test (no _meta, cleaned passes validateKit), batch-wall-clock.test (mock 429 storm, whole run writes within 13min outer budget with pending as BATCH_TIMEOUT, not hang), concurrency.test (409 on stale version), dedupe-bypass.test (evaluate twice same cases.json -> two fresh generated_at), llm-retry.test + unreachable/batch-contract; FE: builder pinned-survives + keyboard reorder + practice ordering (Vitest). |
  - README must cover: overview+stack justification (proxy why), setup local+deployed + evaluate commands, LLM+model, architecture, retrieval+sources, sequencing+each-step responsibility, generated/edited/pinned + version, schedule allocation, batch-timing arithmetic (3 x 2.5min, 2 waves, shared-queue serial bound, 13min outer wall-clock with BATCH_TIMEOUT), DNS pin-then-connect closed, _meta strip step, creative why, decisions/trade-offs, limitations (Atlas, Brave optional). |

  ## 8. Self-review (2026-09-22, hardened)
  - Placeholders: none; env (GROQ_API_KEY, BRAVE_API_KEY optional, MONGODB_URI, SESSION_SECRET, API_URL, ALLOW_LOCALHOST, NEXT_PUBLIC_API_BASE) documented in .env.example at implementation.
  - Consistency: Appendix A names/enums match kit-schema + error enum; schedule/coverage in code not LLM; batch UI + CLI both reuse runPipeline; proxy keeps cookies first-party.
  - Scope: single spec covers BE+FE+batch; implementation split into phased plans (schema/pipeline first, then builder/practice, then batch/deploy+video).
  - Ambiguity resolved: Brave optional with honest fallback; 2 passes max; confidence sort (not SM-2) + print export; DNS-rebinding CLOSED via pin-then-connect safeLookup (not residual).
  - 95+ checklist: proxy auth + trust proxy + login/register limiters, hop-validated + pinned SSRF, server dedupe hash + CLI bypassDedupe, batch upload caps, budgets (60s crawl / 2.5min+queueWait case / p-limit 3 / shared Groq queue / 13min outer wall-clock with BATCH_TIMEOUT), version 409, error enum, _meta-strip + re-validate gate, keyboard+responsive+SSE (curl -N + polling fallback), weak-spots + one-pager, full 15-test matrix (v3). |

  ## 9. Next
  User approved Sec1-4 + review hardening for 95+. Next: phased implementation plan in ai_agents/plans/ (updated).
