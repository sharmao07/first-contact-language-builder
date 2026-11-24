# Testing results

Recorded on 24 November 2026 against the local working copy. Commands were run in `/Users/ojussharma/Downloads/language/first-contact-language-builder`. Nothing here was inferred from a skipped command.

## Automated checks

- `npx vitest run`: 36 tests passed (core 23, reliability 6, community 7).
- `npx tsc --noEmit`: passed.
- `npx eslint . --max-warnings 0`: passed.
- `npm run build`: passed. The build includes `/session/[code]/community`, `/board`, and `/impact`.

The community unit tests cover consent, hidden drafts, comparison release, the water / drinking / container check, an unfamiliar pair of readings, and impact counts that use only the rows they are given.

## Local HTTP

Server: `next start` on http://127.0.0.1:3010

- `scripts/smoke.mjs`: passed.
- `scripts/reliability-journey.mjs`: passed. Image, drawing, audio, and gesture evidence were stored. A hypothesis stayed simulated and was not auto-verified. Accepting it left the concept tentative. A second, different check made it session-verified. The same stimulus was not used as that second check. Contradictory evidence reopened it. The journey session was deleted. SHORE-1001 remained at 8 concepts.
- `scripts/community-journey.mjs`: passed after the board and dispute calls were sent as PATCH, which is the method those routes already used. The passing run checked consent, a private response hidden from the other token, comparison after both locks, a rules-based check, a participant blocked from approving, approval that left the concept tentative, session-verified status only after two methods, rejection of an identical stimulus, a recorded disagreement, a board clarification, another-round outcome, the impact download, reload, and deletion. SHORE-1001 remained at 8 concepts.

## Two browsers

`scripts/community-browser.mjs` launched system Chrome through Playwright and used two browser contexts, so the two people did not share local storage.

The last passing session code was PATH-8764. Facilitator Ada created a community session. Participant Bao joined from the second context. Bao's page did not contain Ada's reading "water" before Bao locked. After both locks, both pages showed "water" and "cup". The facilitator approved a check and recorded another round. The script then deleted that session. SHORE-1001 still had 8 concepts.

An earlier browser assertion failed because it read the participant page before the session request returned. Waiting for the comparison heading fixed the assertion. The privacy behavior itself had already passed.

## Production

Checked on 24 November 2026, without deploying this working copy:

- `GET /api/health` returned HTTP 200 and the previous payload: `ok: true`, `mode: demo`, and no database field.
- `POST /api/sessions` returned HTTP 500, `{"error":"Unexpected server error."}`.

This build's health check and community routes are not what that deployment is running. Production was not marked ready.
