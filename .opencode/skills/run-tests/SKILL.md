---
name: run-tests
description: Run Vitest/Jest tests for frontend and Node/Express backend with proper environment setup, single-file and coverage runs, and failure analysis. Includes mandatory schedule/coverage/validation suites for FS-AI-INTERVIEW-01.
compatibility: opencode
metadata:
  audience: developers
  workflow: testing
---

## How to Run Tests

### Full Test Suite
```bash
npm run test
```

### Watch Mode (developing a specific test)
```bash
npm run test -- --watch
```

### Run a Specific File / Pattern
```bash
npm run test -- src/web/components/atoms/Button/Button.test.tsx
npm run test -- Button
npm run test -- schedule.test
npm run test -- coverage.test
npm run test -- kit-validate.test
```

### Coverage
```bash
npm run test -- --coverage
```

### Setup Notes
- Frontend: tests run in jsdom via Vitest (see `vitest.config` / `vite.config`).
- React Testing Library for component tests; `@testing-library/jest-dom` for matchers.
- Mock API layers (TanStack Query hooks, axios, auth storage) — do not hit real backends in unit tests.
- CI runs `vitest run` (see `.gitlab-ci.yml` / `amplify.yml`).

### Mandatory Suites — FS-AI-INTERVIEW-01 Sec 14 (scored, must protect)
Brief Sec 14 requires automated tests for schedule allocation, coverage checking, structure validation.
Keep these deterministic (no LLM/network) and fast:
- `schedule.test` (allocation is arithmetic in code, Sec 8): days count == days requested;
  every must-have appears somewhere; minutes are integers; harder/higher-priority earlier;
  edge cases 1-day and 60-day; question_ids all exist.
- `coverage.test` (deterministic gap check, Sec 3-4): requirement ids stable (r1..), every question
  refs existing requirement_ids; uncovered must-haves detected; second pass fills gaps and re-checks;
  passes count recorded; thin JD (2-line stub) yields thin honest kit, no invented requirements.
- `kit-validate.test` (Appendix A exactness): field names match exactly
  (`source/company_brief/role/requirements/questions/flashcards/schedule/coverage`);
  `kind` in technical|behavioural|domain, `priority` in must|nice, `category` in
  technical|behavioural|system-design|company-fit, difficulty 1-3, minutes int.
- Mock LLM + fetch (fixtures for JD, company pages, interview discussion); test retry/backoff,
  invalid-JSON recovery, unreachable-site recorded not fatal, duplicate submit idempotent.
- Verify `npm run typecheck` passes; verify batch contract `npm run evaluate -- --input cases.json --output kits.json`
  shape (version/generated_at/kits[{id,status,kit,error}]) with a local-URL fixture.

### Failure Analysis
- Read the failing test's expected vs received output first.
- Check whether the failure is an assertion mismatch, a missing mock, or an environment issue (window/localStorage/sessionStorage mocks).
- Verify `npm run typecheck` passes — type errors often surface as test-time import failures.
