# Participant Testing Plan (Two-Seat Protocol Preparation)

This package prepares a supervised usability and workflow evaluation of **First-Contact Language Builder** (`https://first-contact-language-builder.vercel.app`). **No participants have been recruited, contacted, or tested.**

---

## 1. Short Participant Onboarding Guide

### What You Are Doing
You and a partner will take two separate browser seats (**Seat A — Facilitator** and **Seat B — Participant**) to record everyday gestures, sketches, photos, or notes, compare possible interpretations, and test whether those guesses hold up across different examples.

### Quick Start
1. **Seat A (Facilitator)**: Open `/start`, enter a session title and display name, leave community mode consent checked, and click **Create session**. Share the generated join code (e.g., `TREE-4821`) or QR code with Seat B.
2. **Seat B (Participant)**: Open `/start`, enter the shared session code and a display name, choose **Participant B**, and click **Join**.
3. **Keep Your Recovery Key**: Each browser receives a unique 48-character key saved in local browser storage (viewable under session recovery). If you switch browsers, use **Rejoin an existing seat with a recovery key** on `/start`.
4. **How Meanings Work**: Nothing suggested by the software (or accepted by one person) is treated as proven. A meaning only becomes **Session-verified** after **both** participants record matching checks across **at least two different stimuli** and **two different check methods**, with **zero disagreements** and **at least 75% matching responses**.

---

## 2. Consent and Privacy Notice (Pre-Session Briefing)

> **Before starting a session, read this aloud or share it cleanly with both participants:**
>
> - **Participation is voluntary.** You may pause, dispute any interpretation, leave the session, or ask for the entire session to be deleted at any time.
> - **Do not upload identifiable faces, personal documents, or private audio without explicit consent from everyone recorded.** For initial usability testing, use drawings, objects, or consented non-identifying hand gestures.
> - **Where data is stored:** In hosted testing, session text and metadata are stored in private PostgreSQL (`mogsdvdgfwpsssvcjjoc` with Row Level Security enforced and Supabase Data API disabled). Uploaded images/drawings/audio/video are stored in a private Supabase Storage bucket (`session-media`) accessible only through expiring server-signed URLs (`15m` TTL) or an active session participant token.
> - **AI analysis is opt-in per item (and currently in Demo Mode on Production):** Hosted Production (`AI_PROVIDER=demo`) does **not** send files or notes to any external LLM—hypotheses are rule-simulated from typed descriptions only. Even when an external model is enabled later, a file is sent **only** if consent is explicitly checked for that piece of evidence, and whole videos or unconfigured audio are never transmitted.
> - **No account or behavioral tracking:** There are no user accounts, email tracking, or session-content analytics.

---

## 3. Task-Based Testing Script (5 Guided Tasks)

| Task | Seat(s) | Page | Participant Prompt | Success / Safety Criterion Observed |
| --- | --- | --- | --- | --- |
| **Task 1: Create & Join** | A then B | `/start` | *"Create a community session and share the code so Partner B joins from their own device."* | Both browsers land on `/session/[code]/community` showing Seat A and Seat B without sharing tokens. |
| **Task 2: Capture Two Modalities** | A & B | `/session/[code]` | *"Partner A: submit a sketch or object photo with description. Partner B: submit a gesture description."* | Both evidence items appear in both seats; signed media renders cleanly for Seat B. |
| **Task 3: Blinded Response & Lock** | A & B | `/session/[code]/community` or `/experiments` | *"Partner A: open a check. Partner B: save a private draft first without locking; then Partner B locks; then Partner A responds and locks."* | Before both lock, neither browser displays the other participant's draft/locked response; after both lock, both reveal together. |
| **Task 4: Threshold & Disagreement Check** | A & B | `/session/[code]` & `/experiments` | *"Accept one hypothesis, run one visual check (both agree), check whether it is verified yet, then run a second method on a new example."* | Accepting shows `tentative` (not verified); 1 stimulus/1 participant stays `awaiting`; 2nd stimulus + 2nd method + both participants reaches `verified`. Recording `disagree` immediately sets `disputed`. |
| **Task 5: Solo Practice & Export / Delete** | A & B | `/session/[code]/learn`, `/research` | *"Try one practice prompt (Seat B) and locate session export & delete controls (Seat A)."* | Only session-verified entries appear in practice; Seat B's practice result stays private; Seat A can delete session with confirm code. |

---

## 4. Usability Observation Sheet (Blank Facilitator Log)

Use one copy per test pair. Do not record legal names if testing anonymously—use `Pair-01`, `Seat A`, `Seat B`.

```markdown
Session Code: __________________   Date: ______________   Facilitator Observer: ______________
Browser / Device (Seat A): _____________________   Browser / Device (Seat B): _____________________

1. Onboarding & Join (Task 1)
- Time to join: ______   Any confusion with code / seat selection / recovery key? [ ] Yes [ ] No
- Notes: _____________________________________________________________________________________

2. Evidence & Consent Comprehension (Task 2)
- Did participant understand what demo mode vs. consent checkbox does? [ ] Clear [ ] Partial [ ] Unclear
- Any friction uploading/drawing/recording? __________________________________________________

3. Blinded Reveal & Isolation (Task 3)
- Did participant notice their draft stayed hidden before locking? [ ] Yes [ ] No
- Any lag noticed (~2.5s Vercel polling)? ____________________________________________________

4. Verification Rules & Labeling (Task 4)
- Did participant distinguish "Tentative" / "Facilitator-supported" vs "Session-verified"? [ ] Yes [ ] No
- Did participant understand "Session-verified ≠ universal linguistic truth"? [ ] Yes [ ] No
- Quotes / confusion points: _________________________________________________________________

5. Privacy, Disagreement & Deletion (Task 5)
- Could participants find "Dispute / Disagree" and "Delete session"? [ ] Yes [ ] No
- Technical errors / HTTP statuses observed (if any): __________________________________________
```

---

## 5. Session Deletion and Retention Procedure

### Retention Policy for Usability Testing
- **Test sessions are ephemeral.** Unless participants sign explicit written retention consent for a research archive, delete every test session immediately at the end of the testing block (maximum retention for unarchived test sessions: **24 hours**).

### Deletion Procedure (Verified End-to-End)
1. **In the UI (Facilitator / Seat A)**: Open session **Settings / Session Management**, type the exact session code (`confirmCode`), and click **Delete session** (`DELETE /api/sessions/[code]`).
2. **Server Cascade**: Deleting a session atomically cascades deletion across all PostgreSQL child tables (`Participant`, `AccessCredential`, `Evidence`, `Concept`, `ConceptHypothesis`, `VerificationExperiment`, `VerificationResponse`, `CommunicationTask`, `IndependentResponse`, `ExperimentProposal`, `SessionEvent`, `Expression`, `LearningActivity`, `ResearchNote`) and invokes `supabaseStore.removePrefix(sessionId)` to purge uploaded objects from private Storage bucket `session-media`.
3. **Browser Cleanup**: Clear `fclb:identity:<CODE>` from `localStorage` on both test browsers (or run in Incognito/Private windows so keys vanish on window close).
4. **Post-Session Audit**: Confirm `GET /api/sessions/<CODE>` returns **HTTP 404** and confirm zero orphaned files remain in `session-media`.
