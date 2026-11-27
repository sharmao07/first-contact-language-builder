# Phase 2 — Workflow Validation Report (Checkpoint Summary)

**Status:** **Partial.** The Phase 2 notes, screenshots, and scripts were committed on `main` as `58b1b14`. Local checks and the controlled AI contract test were recorded as passing. The live workflow on `https://first-contact-language-builder.vercel.app` did not finish `10c`, `10d`, or `10e`. `docs/screenshots/06-vocabulary-verified.png` is still the earlier `BROOK-1509` frame: three entries labeled accepted, not session-verified. Interrupted hosted sessions were not deleted.

Production on 27 November 2026 is still commit `58b1b14`, deployment `dpl_7VqmLivoupFN3bwTJHm6U7wkTT4t`. A later two-browser pass is recorded in `FINAL-JUDGING-READINESS-REPORT.md`. It does not replace the unfinished `10c`–`10e` results below.

---

## 1. Part 1 — Phase 1 Checkpoint & Local Integrity

- **Git & Committed Security State**:
  - When this checkpoint was first written, `origin/main` was `9ea5af7` (*Harden Supabase RLS, role privileges, default ACLs, and Data API posture*), with Phase 1 history `924c914` → `478d527` → `c22dd12` → `9ea5af7`. Phase 2 was committed afterward as `58b1b14`.
  - Only `.env.example` is tracked by Git (`git ls-files '.env*'`).
  - Both RLS security migrations (`20261127195500_harden_rls_and_privileges`, `20261127200000_revoke_global_function_default_execute`) are committed and recorded in production `_prisma_migrations` (`PHASE-1-SECURITY-CLOSURE-REPORT.md`).
- **Deployed Production URL**:
  - `https://first-contact-language-builder.vercel.app` (`https://first-contact-language-builder-8due51he5-sharm-07.vercel.app`, `● Ready`, Production).
- **Stale Documentation Fixed (`README.md`)**:
  - Updated `README.md` (`7 insertions`, `6 deletions`) so solo practice scope references `session-verified` entries only, media access documentation reflects `/api/media/[id]` with short-lived HMAC signed URLs or `x-participant-token` + private Supabase Storage, `Production data` reflects `PRODUCTION-SETUP-CHECKLIST.md` / `RATE_LIMIT_STORE` / pool settings, and rejoin instructions reflect seat keys rather than bare session codes.
- **Local Verification Suite (Post-Edits to `README.md` & Docs)**:
  - `npx vitest run`: **11 test files, 90 tests passed** (includes `9` experiment-engine threshold tests in `tests/experiment-engine.test.ts`).
  - `npm run typecheck`: **0 errors** (`tsc --noEmit`).
  - `npm run lint`: **0 errors** (`1` pre-existing unused-variable warning in `scripts/security-hardening.mjs:98`).
  - `npm run env:check`: passed (`development environment and migrations are valid`).
  - `npm run build`: **Next.js 15.5.29 production build succeeded**.
- **Local `SHORE-1001` Integrity**:
  - Intact in `data/first-contact.db`: `1` session (`SHORE-1001`) with `8` concepts, `8` evidence items, `11` hypotheses, and `12` experiments.

---

## 2. Part 2 — Live Two-Browser Playwright Workflow Results

Script: [scripts/full-workflow-browser.mjs](scripts/full-workflow-browser.mjs) against `https://first-contact-language-builder.vercel.app`.

### Observed Results in Live Run `task-1173` (Session `BROOK-2322`)

| Check | Outcome | Observed Evidence |
| --- | --- | --- |
| `1. create community session (Browser 1)` | **PASS** | `code=BROOK-2322` |
| `2. independent join (Browser 2)` | **PASS** | `seatB_joined=BROOK-2322` |
| `3. independent evidence from both participants` | **PASS** | `evA=201 evB=201` (PNG upload + gesture) |
| `4. competing hypotheses created & not auto-verified` | **PASS** | `hypsA=4 hypsB_blinded=0 concepts=0` |
| `5. discriminating experiment approved in UI` | **PASS** | `BROOK-2322` |
| `6a. draft hidden from other participant before lock` | **PASS** | `hidden before lock` |
| `6b. response stays hidden after only one lock` | **PASS** | `hidden after 1 lock` |
| `7 & 8. responses reveal only after both lock` | **PASS** | `revealed=true outcome_mappings_hidden=true` |
| `9a. participant blocked from accepting hypothesis` | **PASS** | `status=403` |
| `9b. accepting hypothesis stays tentative (not verified)` | **PASS** | `status=tentative` |
| `10a. single participant meeting numeric thresholds stays awaiting` | **PASS** | `status=awaiting` |
| `10b. single stimulus cannot session-verify` | **PASS** | `status=awaiting` |
| `10c. single method across two stimuli cannot session-verify` | **FAIL** | Returned `status=undefined` (`acceptC`/`chkC2`/`respond` non-2xx not yet isolated before stopping) |
| `9c. multi-stimulus + multi-method + two participants verifies` | **PASS** | `status=verified` |
| `11. cleanup test session & SHORE-1001 intact` | **PASS** | `del=200 after=404 shore=8` |
| **Post-`9c` vocabulary navigation & `10d` / `10e`** | **Incomplete** | `page.goto(.../session/BROOK-2322/vocabulary)` hit `net::ERR_TIMED_OUT`, aborting before `06-vocabulary-verified.png` refresh, `10d` (disagreement → `disputed`), and `10e` (`<75%` match rate). Note: a later retry (`task-1219`, `FIELD-7141`) was stopped at user request after passing steps `1` and `2`. |

---

## 3. Hosted leftovers and what is already in git

- Because runs `task-1111` (`STAR-5168`) and `task-1219` (`FIELD-7141`) were cancelled mid-flight, those test rows and associated `storage.objects` were still in the hosted project when this report was written. They were not removed in the documentation correction.
- The Phase 2 files below are committed on `main` at `58b1b14`, not sitting uncommitted: `README.md`, `scripts/full-workflow-browser.mjs`, `scripts/evaluate-ai-provider.mjs`, `docs/screenshots/01-landing.png` through `06-vocabulary-verified.png`, `LIVE-AI-EVALUATION-REPORT.md`, `PARTICIPANT-TESTING-PLAN.md`, `HACKATHON-DEMO-SCRIPT.md`, and this report. `06-vocabulary-verified.png` is the pre-verification `BROOK-1509` frame.
