# First-Contact Language Builder — Hackathon Demo Script & Architecture Overview

**Live Deployment:** `https://first-contact-language-builder.vercel.app` (Demo Mode active; zero unconsented external model calls)

---

## 1. Problem & Solution

### Problem
When two people do not share a spoken or signed language, existing translation tools and single-user AI apps assume the software already knows the target language—or quietly present one plausible guess as truth. Pointing at an object, holding a vessel, or miming an action is inherently ambiguous (e.g., *water* vs. *cup* vs. *drinking* vs. *offering*). In collaborative fieldwork or cross-linguistic experimentation, premature agreement or unblinded suggestion biases both participants.

### Solution
**First-Contact Language Builder** treats language discovery as a **two-seat, falsifiable protocol** rather than instant translation:
- Two participants join separate browser seats with independent access keys (`Participant A / Facilitator` and `Participant B`).
- Competing hypotheses stay labeled as unverified guesses (`simulated` in Demo mode; non-authoritative estimates even when an external model is configured).
- **Blinded locking**: In community & experiment workflows, neither participant can view the other's response until **both** seats lock independently.
- **Strict session verification rule**: A concept reaches **Session-verified** (`verified`) only inside that session after **both** participants record matching checks across **at least two distinct stimuli** and **two distinct check methods**, with **zero disagreements** and **at least 75% match rate**. A single participant, single stimulus, single method, disagreement, or `< 75%` match rate prevents verification.

---

## 2. 2–3 Minute Live Demo Script

### Beat 1 (0:00–0:30) — Setup & Problem Statement
- **Screen**: Landing page (`docs/screenshots/01-landing.png`) → `/start` (`docs/screenshots/02-start-join.png`).
- **Say**: *"Most AI language tools assume a dictionary already exists. Here, two people start with zero shared vocabulary. In Browser 1, Ada opens a community session (`RIDGE`/`WAVE`-style code) and shares the join link; in Browser 2, Bao joins independently on Seat B."*
- **Action**: Point out the **Demo mode disclosure banner** on the page—explicitly stating no model inspects uploaded media in Demo mode.

### Beat 2 (0:30–1:15) — Multimodal Evidence & Competing Hypotheses
- **Screen**: Discovery workspace `/session/[code]` → **Hypotheses** tab (`docs/screenshots/03-discovery-hypotheses.png`).
- **Say**: *"Ada uploads a photo of cupped hands near a vessel; Bao adds an independent inward scooping gesture. Asking for readings generates four competing guesses—substance (`water`), container (`cup`), action (`drinking`), and request—each marked `Guess` with explicit missing information and ambiguities. None are auto-verified, and Seat B cannot see the facilitator's hypothesis panel in community mode."*

### Beat 3 (1:15–2:00) — Blinded Discriminating Check & Lock/Reveal
- **Screen**: Experiments page `/session/[code]/experiments` before both lock (`docs/screenshots/04-experiments-blinded.png`) → after both lock (`docs/screenshots/05-experiments-revealed.png`).
- **Say**: *"Next, Ada approves a discriminating visual check (`Separate the liquid, the container, and the motion`). Only a neutral instruction goes to Bao—expected outcome mappings stay hidden with the facilitator. Bao saves and locks a response first; Ada still sees `Locked. Hidden until both responses are in.` Only after Ada also locks do both replies reveal together without bias."*

### Beat 4 (2:00–2:35) — Earned Verification & Gated Vocabulary / Practice
- **Screen**: Shared vocabulary `/session/[code]/vocabulary` (`docs/screenshots/06-vocabulary-verified.png`). This frame is session `BROOK-1509`. All three entries (`drinking action`, `clay bowl`, `pouring vessel`) are labeled **Accepted, not session-verified**. The later capture, after a meaning actually reached session verification, timed out and was not saved.
- **Say**: *"Accepting a hypothesis leaves it tentative. One participant matching across two checks stays a facilitator-supported observation. Session-verified needs both people, two stimuli, two methods, at least a 75% match rate, and no disagreement. This screenshot is the earlier accepted state, not that completed bar. A disagreement moves a meaning to Disputed."*

### Beat 5 (2:35–3:00) — Production Hardening & Closing
- **Say**: *"Under the hood on Vercel and Supabase, uploads go to a private Storage bucket served only through short-lived HMAC-signed URLs, distributed PostgreSQL rate limiting guards every join/upload/AI endpoint, all 21 Postgres tables enforce Row Level Security with Supabase Data API disabled, and local SQLite sample `SHORE-1001` stays cleanly isolated from hosted production."*

---

## 3. Architecture Diagram

```mermaid
flowchart LR
  B1["Browser 1 (Seat A / Facilitator)<br/>localStorage token + UI"] -->|HTTPS + x-participant-token| V["Vercel Next.js App Router<br/>Zod Validation + Distributed Rate Limiter"]
  B2["Browser 2 (Seat B / Participant)<br/>localStorage token + UI"] -->|HTTPS + x-participant-token| V

  V -->|Prisma ORM (postgres role)| PG["Supabase PostgreSQL (ap-southeast-2)<br/>21 Tables w/ RLS Enabled<br/>Data API Disabled (/rest/v1 & /graphql/v1)"]
  V -->|Server-only service_role| ST["Supabase Private Storage (session-media)<br/>public=false · 0 anon policies"]
  V -->|/api/media/id?exp=&sig=| HMAC["HMAC-SHA256 Media Proxy<br/>15m TTL + seat auth"]
  V -->|AI_PROVIDER=demo default| AI_D["Deterministic Rule / Demo Engine<br/>simulated=true"]
  V -.->|Optional AI_PROVIDER=openai| AI_L["OpenAI-Compatible Endpoint<br/>Consent-gated · fail-closed"]
```

---

## 4. Real Deployment Screenshots

Screenshots captured from `https://first-contact-language-builder.vercel.app`. Items 1–5 are from the Phase 2 two-browser workflow. Item 6 is the earlier `BROOK-1509` vocabulary frame; the post-verification recapture did not finish.

1. **Landing and demo-mode disclosure**: [01-landing.png](docs/screenshots/01-landing.png)
2. **Two-seat start and join**: [02-start-join.png](docs/screenshots/02-start-join.png)
3. **Competing simulated hypotheses**: [03-discovery-hypotheses.png](docs/screenshots/03-discovery-hypotheses.png)
4. **Blinded experiment before both seats lock**: [04-experiments-blinded.png](docs/screenshots/04-experiments-blinded.png)
5. **Reveal after both seats lock**: [05-experiments-revealed.png](docs/screenshots/05-experiments-revealed.png)
6. **Vocabulary before session verification** (`BROOK-1509`; three accepted, not session-verified entries): [06-vocabulary-verified.png](docs/screenshots/06-vocabulary-verified.png)

---

## 5. Development Provenance (What Was Built When)

| Phase / Commit Window | Scope Completed |
| --- | --- |
| **Baseline Core (`4fb3e7e` and prior)** | Two-seat discovery domain model, PostgreSQL/SQLite Prisma schemas, verification state machine (`lib/verification/status.ts`), blinded community/experiment visibility rules, consent-gated OpenAI adapter, local `SHORE-1001` illustrative seed. |
| **UI Redesign (`57c2e7d`)** | Ground-up visual redesign of landing, start/join, discovery workspace, composer, hypothesis board, experiment engine, shared vocabulary, practice, concept dossier, force graph, research dashboard, and accessibility/motion tokens. |
| **Phase 1 Production & Security (`924c914`..`9ea5af7`)** | Provisioned Supabase PostgreSQL + private `session-media` bucket, server-side HMAC media signing, distributed `RateLimitBucket` limiter across create/join/rejoin/upload/AI routes, legacy sample token isolation on hosted deployments, PgBouncer pool tuning, RLS enabled on all 21 `public` tables, `PUBLIC`/`anon`/`authenticated` privilege revocation + global/schema default-ACL locking, and Supabase Data API disabled. |
| **Phase 2 Validation & Prep (`58b1b14`)** | Fixed stale `README.md` claims, added the two-browser workflow script (`scripts/full-workflow-browser.mjs`) and the controlled AI HTTP harness (`scripts/evaluate-ai-provider.mjs`), and added participant-testing and demo notes. The live workflow did not finish the single-method, disagreement, and below-75% checks. |

---

## 6. AI & Honest Limitations Disclosures

- **AI Disclosure**: Hosted production runs in **Demo mode (`AI_PROVIDER=demo`)**—no external LLM inspects uploaded files, and every generated hypothesis and check plan is explicitly marked `simulated` / rule-based. External `AI_PROVIDER=openai` behavior was verified against a controlled OpenAI-compatible HTTP test server (`8/8` checks); a live external OpenAI API call in Vercel Preview has **not** run yet because no `OPENAI_API_KEY` or separate Preview Supabase instance is provisioned.
- **No Linguistic Truth Claim**: `Session-verified` means only that two participants inside one session passed the check thresholds (`>= 2` stimuli, `>= 2` methods, `>= 2` authors, `>= 75%` match rate, `0` disagreements). It does not establish external linguistic accuracy.
- **Infrastructure & Product Limitations**: Vercel (`iad1`) ↔ Supabase (`ap-southeast-2`) cross-region polling (~2.5s interval) introduces latency compared to local SSE; audio acoustic analysis requires WAV/MP3 + `OPENAI_AUDIO_MODEL` and whole videos are not analyzed; bearer seat keys stored in `localStorage` act as seat credentials until left/rotated/expired; no real human participant study has been conducted yet.
- **Future Work**: Co-locate Vercel region or add Upstash Redis (`RATE_LIMIT_STORE=redis`), provision Preview Supabase + live `OPENAI_API_KEY` for empirical multimodal prompt evaluation, run supervised human pair testing using `PARTICIPANT-TESTING-PLAN.md`, and explore end-to-end encrypted or offline field synchronization.
