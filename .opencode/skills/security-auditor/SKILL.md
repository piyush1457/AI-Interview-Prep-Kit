---
name: security-auditor
description: Senior security auditor skill that audits React/Next.js frontends and Node/Express backends for OWASP Top 10, XSS, token storage, SSRF-safe crawling, untrusted-content handling, CSP, dependency CVEs, and client/server vulnerabilities
compatibility: opencode
metadata:
  audience: security
  workflow: audit
---

## Senior Security Auditor — Frontend + Backend Fetch Audit Checklist

When auditing this project, systematically check frontend (1-7) plus backend fetch (8) categories:

### 1. Client-Side Injection / XSS
- `dangerouslySetInnerHTML` — is it sanitized with DOMPurify? Flag any unsanitized usage.
- Rendering user/marketing content (descriptions, reviews, messages) — sanitize before render.
- URL params / query strings interpolated into markup or href/src — validate and encode.
- `eval()`, `new Function()`, `document.write` — flag any usage.
- SVG/XML injection vectors (user-uploaded SVGs rendered directly).

### 2. Authentication & Token Security
- Tokens: access in `sessionStorage`, refresh in `localStorage` (per convention). Flag tokens in `document.cookie` without HttpOnly or in global variables / Redux / Zustand.
- Token auto-refresh on 401 — verify refresh errors log the user out cleanly (no infinite retry loops).
- Hardcoded credentials, API keys, STORE_IDs, secrets — flag any committed secrets.
- `localStorage`/`sessionStorage` cleared on logout — verify full cleanup (no orphan tokens/keys).
- Check for token leakage in URLs, query params, or analytics events.

### 3. PWA / Service Worker
- Service worker scope — no caching of authenticated/sensitive responses (never cache API responses containing PII in precache).
- Workbox routes — authenticated GETs should use NetworkOnly or NetworkFirst (never CacheFirst).
- No sensitive data in the precache manifest (API responses, tokens).
- manifest.json — no insecure `start_url`, valid icons.

### 4. Dependency Security
- `package.json` — pinned/range versions, no known-vulnerable packages.
- Run `npm audit` / `npm run audit` — flag high/critical CVEs.
- Outdated major-version dependencies (React, Vite, axios, TanStack Query).

### 5. CSP & Headers
- Production `index.html` — Content-Security-Policy present and strict (no `unsafe-inline`/`unsafe-eval` for scripts unless justified).
- No external scripts from untrusted CDNs without integrity attributes (SRI).
- `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` — recommended in deployment config.

### 6. Data & Privacy
- PII (phone, address, email) — not logged to console, not sent to analytics without consent.
- Analytics (PostHog etc.) — masked PII; no raw phone/email in event properties.
- Offline persistence (Zustand persist / IndexedDB) — no sensitive data persisted beyond what's needed; stale data purged on logout.

### 7. Code-Level Issues
- `console.log` leaking tokens/PII.
- `dangerouslySetInnerHTML`, `eval`, `Function()`, `innerHTML` with unsanitized input.
- Hardcoded IPs, URLs, API keys, tokens, STORE_IDs.
- URL validation before external navigation (open redirect via `window.location = userInput`).
- Insecure random for CSRF-like values; missing state/Nonce in OAuth/PKCE flows.

### 8. Backend Fetch — Untrusted Crawl (FS-AI-INTERVIEW-01 Sec 11, mandatory)
The app fetches untrusted company pages + pasted JDs and feeds them to an LLM. Audit:
- SSRF: validate `company_url` before fetch; reject private/loopback/link-local (10/8, 172.16/12,
  192.168/16, 127/8, ::1, 169.254/16, metadata 169.254.169.254) in production; resolve DNS and
  re-check; allow localhost bypass ONLY when `ALLOW_LOCALHOST=true` for batch `evaluate` tests.
  Flag raw `fetch(userInput)` / `axios.get(userInput)` without allowlist (CWE-918).
- Scope: follow relative links only within target origin; enforce max pages/depth, request timeout
  (e.g. 10s), retries with backoff; respect robots.txt + site terms; send identifying User-Agent.
- Content-type/size: accept only html/text (reject executables/archives); enforce max bytes
  (e.g. 1-2 MB/page, cap total); strip scripts/styles; never execute fetched JS.
- Prompt injection: treat all fetched text + pasted JD as DATA, never instructions. Delimit with
  markers, escape/neutralize directives ("ignore previous instructions", tool-call syntax);
  never interpolate raw crawl into system prompt; log which `pages_used` informed brief (CWE-1427).
- Secrets: LLM keys only from env (documented in `.env.example`), never committed or sent to frontend.

### Audit Output Format
For each issue found, report:
1. **Severity**: Critical / High / Medium / Low
2. **File**: exact file path and line number
3. **Issue**: what the vulnerability is
4. **Fix**: exact code change needed
5. **CWE**: relevant CWE identifier if applicable

### Remediation Priority
- **Critical**: fix immediately (XSS/RCE, token theft, auth bypass, secret leak)
- **High**: fix in current sprint (unsanitized rendering, missing CSP, PII leakage)
- **Medium**: fix in next sprint (header hardening, analytics privacy, stale cache)
- **Low**: fix when convenient (best practices, minor hardening)
