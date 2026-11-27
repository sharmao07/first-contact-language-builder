# Final judging readiness

**Date:** 27 November 2026  
**Verdict:** **READY WITH DISCLOSED LIMITATIONS**

The deployed application can be demonstrated. Production is in demo mode, says so, and a two-browser pass created a community session, joined it from a separate browser, saved evidence from both seats, and kept the other seat from seeing the hypotheses. This pass did not finish the blinded lock step or delete its last session, because the browser connection timed out. No application code was changed.

## 1. Critical issues found

No confirmed P0 or P1 defect in the application.

The earlier `POST /api/sessions` HTTP 400 was the browser test submitting before React kept the form values. The server message was accurate: the request had no display name and `consent` was not true. The create form already requires **Your name** (`displayName`) and the shared-discovery checkbox (`consent`). Validation was not weakened.

| Class | Finding |
| --- | --- |
| P0 | None confirmed. |
| P1 | None confirmed in the product. The final community-page load returned `net::ERR_TIMED_OUT` before the lock step. The server had already answered the earlier requests in that session. |
| P2 | Two disposable sessions may remain because cleanup did not send a successful delete: `MARSH-3890` and `WIND-5250`. `FIELD-4184` and `PATH-1309` were deleted. |
| P3 | Not pursued. |

## 2. Bugs fixed

The earlier HTTP 400 was a test submitting before the form kept its values. Validation was not changed.

A later code fix stops a community participant from seeing the hidden-hypothesis count, requesting readings, or deleting the other person's evidence. The facilitator still sees the count, can request readings, and can delete evidence. Each person can still delete their own evidence.

## 3. Files changed

Documentation only:

- `README.md` — local files stay in `data/uploads`; production files stay in private storage. Prisma uses SQLite locally and PostgreSQL in production.
- `HACKATHON-DEMO-SCRIPT.md` — the 2–4 minute script now says which beats this pass actually repeated.
- `PHASE-2-WORKFLOW-VALIDATION-REPORT.md` — points at this report and keeps the unfinished `10c`–`10e` result.
- `LIVE-AI-EVALUATION-REPORT.md` — records the 27 November health check and the simulated analyze response.
- `FINAL-JUDGING-READINESS-REPORT.md` — this file.

## 4. Focused tests actually run

No unit tests were run. No application source file changed, and the full suite, security audit, and full workflow script were not repeated.

What was run:

- `GET https://first-contact-language-builder.vercel.app/api/health`
- One production Playwright pass that reached hypotheses, then timed out opening the community page.
- One earlier pass the same day that created `FIELD-4184`, saved both notes, opened a community situation, and was deleted. The client abandoned the lock request at 40 seconds. Production logs show that later community `POST` and the `DELETE` both returned HTTP 200.
- Vercel request logs for those windows. No new live model call.

## 5. Two-browser demonstration results

Deployed site: `https://first-contact-language-builder.vercel.app`  
Browser: Playwright driving installed Headless Chrome, two separate browser contexts.  
Session that reached the hypothesis check: `WIND-5250`.

| Step | Result |
| --- | --- |
| Landing demo disclosure, earlier the same evening | Visible. The page says hypotheses are simulated and that no model inspects the image, drawing, or audio. |
| Community create through the form | HTTP **201**. Request `bom1::iad1::mmkkw-1795803119475-47a4fc2264eb`. Name `Seat Ada`, shared-discovery confirmation checked, purpose Community access. |
| Independent join through the join form | HTTP **200**. Request `bom1::iad1::9qg4m-1795803144539-33b48c116d61`. Seat B, name `Seat Bao`. A reload still showed Seat Bao. |
| Evidence from each seat | Both HTTP **201**. Written notes. Seat A could see both notes. |
| Hypotheses | Analyze HTTP **200**, `simulated: true`. Request `bom1::iad1::nknn2-1795803215798-547d5f5a3677`. Seat A showed **Hypotheses (4)**. The panel did not say a live model ran and did not say the readings were session-verified. Seat B showed **Hypotheses (0)**. |
| Experiment, lock, and reveal | **Not reached.** Opening `/session/WIND-5250/community` failed with `net::ERR_TIMED_OUT`. |
| Cleanup | **Not confirmed.** The follow-up navigation died with `chrome-error://chromewebdata/`. No delete request for `WIND-5250` appears in the production request log for that window. |

The session banner during `WIND-5250` read: “Demo mode is active. Hypotheses are simulated from the written description, evidence type, and action label. No model inspects the image, drawing, or audio.”

## 6. Production deployment commit

| Item | Value |
| --- | --- |
| Production deployment | `dpl_7VqmLivoupFN3bwTJHm6U7wkTT4t` |
| Production commit | `58b1b14831afcf985d7ad45d8a174494c3e3f73f` |
| Commit message | Phase 2: verification edge case tests, workflow validation, AI evaluation, participant testing plan, hackathon demo script |
| Health | HTTP 200, `ok: true`, database connected, PostgreSQL, private Supabase storage, signed media, database rate limiting, sync poll, `ai.mode` `demo` |
| Local `main` before this report | `b7c4e64`, one documentation commit ahead of `origin/main` and not deployed |

This documentation commit does not change the running application.

## 7. Known limitations

- Production AI is demo mode. There is no live provider key in this environment, and no live model result was produced.
- The controlled `8/8` AI evaluation used a local mock HTTP server. It is not a live OpenAI call.
- Phase 2 checks `10c`, `10d`, and `10e` were not rerun. Screenshot `docs/screenshots/06-vocabulary-verified.png` is still `BROOK-1509` with three entries labeled accepted, not session-verified.
- No human participant study was run.
- `SHORE-1001` was not opened or modified.
- `MARSH-3890` and `WIND-5250` may still exist in production. Their recovery keys were not retained, so this pass could not delete them.

## 8. Features that remain simulated

- Hypothesis generation on production. The analyze response observed here had `simulated: true`.
- Experiment suggestions while `AI_PROVIDER` is `demo`. The community planner uses the rule selector and labels the source `rules`. It does not claim a live model.
- The illustrative session `SHORE-1001`.
- The landing walkthrough. It is an illustration, not an analysis of an uploaded image.

A configured live provider is fail-closed: a failed live plan is not replaced with a demo plan, and the planner does not accept a hypothesis or mark a concept session-verified. That live path was not called.

## 9. What could still disrupt a judge demonstration

- A slow or dropped connection between the browser and Vercel. That is what stopped the community page in this pass. Reload the session code rather than starting over if the page stalls.
- Cross-region delay between Vercel and the hosted database. Saving a step can take long enough that a short client wait gives up even when the server later returns HTTP 200.
- The two leftover sessions above. They do not block a new code, but they are leftover records.
- Do not describe screenshot 06 as a session-verified vocabulary. It is not.

## 10. Verdict

**READY WITH DISCLOSED LIMITATIONS**

A judge can open the deployed site, create a community session, join from a second browser, record evidence, and show simulated hypotheses that the other seat does not see. The page labels that output as demo mode. The blinded lock and reveal should be shown from the existing Phase 2 path and screenshots; this pass did not repeat that step to completion. Do not tell judges that a live model read the session.

## Demo flow for a 2–4 minute showing

1. Landing. Read the demo-mode sentence. Say that the software does not decide the meaning.
2. `/start`. Seat A creates a community session, enters a name, and checks the shared-discovery confirmation. Copy the code.
3. A second browser. Seat B joins with that code.
4. Discovery. Each person submits one written note. Seat A requests hypotheses. Show four open guesses and the demo label. Switch to Seat B and show **Hypotheses (0)**.
5. Community. Open “Asking for an everyday item.” Each person writes a reading and locks it. Show that the first lock stays hidden. After the second lock, show both readings. Approve the suggested check and read the line that approval does not session-verify anything.
6. Close by stating the session-verified bar: two people, two stimuli, two methods, no disagreement, and at least a 75% match, inside this session only.

If the community page stalls, reload that session URL once. If it still does not load, stop on the hypothesis contrast rather than claiming the lock step happened.
