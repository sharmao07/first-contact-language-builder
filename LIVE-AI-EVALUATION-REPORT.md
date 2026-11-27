# Phase 2 — Live AI Provider Evaluation Report

**Production AI Status:** Default Production (`https://first-contact-language-builder.vercel.app`) remains intentionally set to **`AI_PROVIDER=demo`**.

On 27 November 2026, `GET /api/health` still reported `ai.mode` as `demo`. In a production browser session the same day, `POST /api/sessions/WIND-5250/analyze` returned HTTP 200 with `simulated: true`. That was the demo hypothesis engine, not a live model call. The controlled results below remain a local mock-server contract test.

**Hosted Vercel Preview Status (External Model Call):** **Blocked / Not Configured.** Neither a server-side `OPENAI_API_KEY` (nor Gemini/Anthropic/OpenRouter key) nor a separate Preview Supabase project exists in `.env`, shell environment, or Vercel (`vercel env ls` confirms Production-only variables and zero Preview deployments). Per safety and environment rules, Preview must not reuse the Production Supabase database, no credentials were invented, and **no live external OpenAI/LLM API call has been executed**.

Instead, the real production TypeScript AI modules ([openAIProvider.analyze](lib/ai/openai-provider.ts) and [requestLivePlan](lib/ai/plan.ts)) were exercised end-to-end over TCP HTTP against a controlled local OpenAI-compatible HTTP server (`127.0.0.1`) via [scripts/evaluate-ai-provider.mjs](scripts/evaluate-ai-provider.mjs).

---

## 1. Environment & Isolation Summary

| Environment | `AI_PROVIDER` | API Key Configured | External Model Calls Tested | Notes |
| --- | --- | --- | --- | --- |
| **Production (`first-contact-language-builder.vercel.app`)** | `demo` | None (intentional) | No | Demo provider synthesizes readings from text/labels only (`simulated: true`). |
| **Preview (Vercel)** | Not provisioned | Missing (`OPENAI_API_KEY` unset) | **Blocked** | Requires separate Preview Supabase DB/Storage + real server-only `OPENAI_API_KEY`. |
| **Controlled HTTP Harness (`scripts/evaluate-ai-provider.mjs`)** | `openai` | Local mock key (`127.0.0.1`) | Controlled OpenAI-compatible HTTP server | Exercised real HTTP `fetch`, JSON/Zod parsing, retry, timeout, and consent stripping (`8/8` passed). |

---

## 2. Controlled HTTP Contract Evaluation Results (`8/8` Passed)

Command run: `npx --yes tsx scripts/evaluate-ai-provider.mjs`

| # | Scenario Evaluated | Expected Behavior in Code | Observed Result |
| --- | --- | --- | --- |
| **1** | **Unconsented evidence omission (`groundSnapshot`)** | Descriptions/notes/annotations with `consentToAnalyze: false` are blanked (`omitted: true`) before serialization. | **PASS** — `omittedEvidence=1`; `"SECRET UNCONSENTED TEXT"` absent from outgoing HTTP request body. |
| **2** | **Ambiguous hypotheses + unconsented image bytes** | `openAIProvider.analyze` returns 3–5 competing hypotheses (`simulated: false`), keeps observations separate from inferences, and omits `image_url` when `consentToAnalyze: false`. | **PASS** — Parsed 3 competing hypotheses (`simulated=false`); `image_url` absent in HTTP payload. |
| **3** | **Structured experiment planning (`requestLivePlan`)** | Validates response against `experimentPlanSchema` (Zod), strips model-supplied `quality`, and recomputes 8-point server `withServerQuality`. | **PASS** — Plan accepted (`source="ai"`, `simulated=false`), server-scored `7/8`; unconsented text absent. *(Note: an earlier schema mismatch on nested `expectedUnder` was rejected cleanly with HTTP `502`.)* |
| **4** | **Malformed JSON response** | Non-JSON text (`"not valid json {{{"`) must fail closed with HTTP `502` and never substitute a demo/rule plan. | **PASS** — Both `analyze` and `requestLivePlan` threw `HttpError(502)` (`No simulated plan was substituted`). |
| **5** | **Schema mismatch** | Valid JSON failing `analysisSchema` / `experimentPlanSchema` must fail closed with HTTP `502`. | **PASS** — Both threw `HttpError(502)`. |
| **6** | **Upstream rate limit (`HTTP 429`)** | Retries once, then fails closed with HTTP `429` without substituting demo/rule output. | **PASS** — Server recorded `attempts=2`; threw `HttpError(429)`. |
| **7** | **Upstream server error (`HTTP 500`)** | Fails closed with HTTP `502` without substituting demo/rule output. | **PASS** — Threw `HttpError(502)`. |
| **8** | **Request timeout (`AI_TIMEOUT_MS=3000`)** | Aborts stalled HTTP requests (`4500ms` mock delay) and fails closed with HTTP `504`. | **PASS** — Both `analyze` and `requestLivePlan` threw `HttpError(504)`. |

---

## 3. Concrete Prompt/Response Boundaries & Non-Auto-Verification Proof

### Example Synthetic Evaluation Case (`water / liquid` vs. `cup / container`)
- **Input Snapshot**: Synthetic consented note `"Consented photo of cup with water"` + unconsented note `"SECRET UNCONSENTED TEXT"`, plus competing hypotheses `h-water` and `h-cup`.
- **Prompt Guardrails Verified (`lib/ai/openai-provider.ts` & `lib/ai/plan.ts`)**:
  - System prompt instructs the model that participant text is untrusted data, forbids declaring meanings correct/verified/translated, forbids inventing IPA/phonemes, and caps `confidence` as a non-probabilistic rough estimate (`0..1`).
  - `groundSnapshot` stripped the unconsented note before serialization.
- **Verification Isolation Verified (`app/api/sessions/[code]/analyze/route.ts` & `lib/domain/discovery.ts`)**:
  - Analyzed hypotheses are persisted strictly as `status: "open"`.
  - No code path in `lib/ai/` writes `Concept.status = "verified"` or accepts a hypothesis on behalf of a participant. Accepting requires an authenticated facilitator (`POST /api/sessions/[code]/hypotheses/[id]` → `"tentative"`), and `verified` requires multi-stimulus, multi-method, two-author checks (`deriveVerificationStatus` in `lib/verification/status.ts`).

---

## 4. Known Limitations (What AI Mode Does and Does Not Do)

1. **No Real External LLM Evaluation Yet**: Behavior under actual commercial model instruction-following drift, latency variance, or multimodal vision/audio outputs remains unverified until a real `OPENAI_API_KEY` and separate Preview Supabase project are provisioned.
2. **Written Context & Image Constraints**: Video files (`evidenceType: "video"`) and SVG images are never sent (`mediaPlan`); audio (`wav`/`mp3` only) requires an explicit `OPENAI_AUDIO_MODEL`; browser `.webm` recordings stay stored on disk/Supabase and are not analyzed acoustically.
3. **Rule Checklist vs. Linguistic Validity**: `withServerQuality` computes an 8-point structural check (e.g., whether stimuli/methods were reused), not empirical linguistic accuracy or statistical information gain.
4. **Community Mode Guard**: In `community` sessions, [proposeDiscrimination](lib/community/propose.ts) uses deterministic rule selection (`source: "rules"`) in demo mode and fails closed if `AI_PROVIDER=openai` fails, preventing silent downgrade.

---

## 5. Exact Steps to Enable Real Live-AI Preview Testing

1. Create a **separate Preview Supabase project** (PostgreSQL + private Storage bucket) and run `npm run db:migrate` against its `DIRECT_URL` (never share Production DB).
2. In **Vercel Dashboard → Project Settings → Environment Variables (Preview scope)**: add the Preview Supabase variables, a Preview `MEDIA_SIGNING_SECRET`, `RATE_LIMIT_STORE="auto"`, `AI_PROVIDER="openai"`, `OPENAI_MODEL="gpt-4o-mini"` (or target model), and server-only `OPENAI_API_KEY`.
3. Trigger a Vercel Preview branch deployment, verify `/api/health` (`ai.mode === "openai"`), and test `/api/sessions/[code]/analyze` and `/api/sessions/[code]/plans` with synthetic consented text.
