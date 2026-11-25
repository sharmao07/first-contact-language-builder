# Phase 8 security report

Local only. Nothing was committed, pushed, or deployed. The app under test is `http://127.0.0.1:3010`. Health returned `ok: true`, `mode: demo`, SQLite connected, and the sync transport `stream`. No external model was called. `AI_PROVIDER` remains demo and `OPENAI_API_KEY` is empty.

SHORE-1001 was not edited. After the temporary sessions were removed, the database contained only that session, with 8 concepts.

## 1. Role-permission matrix

There is no research-administrator credential, and none was added. A global export role would recreate the unauthenticated export hole. Seat A in a research or general session is the host for that session only.

| Role | Who it is | Read one session | List sessions | Export that session | Session verification |
| --- | --- | --- | --- | --- | --- |
| Unauthenticated visitor | No recovery key | No. 401. A known code is not a credential. | No. 401. Codes are not listed. | No. 401, before any export query. | No. |
| Participant A | Community participant, or seat B in a research or general session | Participant view of that session only. | That session only. | No. 403. | Can record their own checks. Cannot export notes, hypotheses, or another person's private replies. |
| Participant B | The other community participant, or the other non-host seat | Same participant view, scoped to their own session. | Their own session only. | No. 403. | Same as Participant A. |
| Session facilitator | Community session, `communityRole` facilitator, seat A | Full session, including hypotheses, outcome mappings, and notes. | That session only. | JSON, CSV, and Markdown for that session only. | Can prepare checks. Cannot session-verify from their own checks alone. |
| Host | Seat A when the session is not a community session | Full session. | That session only. | That session only. | Same independence rule. One author's matches stay a facilitator-supported observation. |
| Research administrator | Not implemented | No cross-session access. | No. | No role can export every session. | None. |

Authorization is decided on the server from the `x-participant-token` header and the session row. Hiding a control in the page is not the check.

A session code is only the join key. Join and create still work. Reading, syncing, changing, and exporting require a seat in that session. A token from another session is 403. An unknown token is 403. A seat that has left is 403 until rejoin. There is no time-based expiry. Leaving is the inactivation that was tested. Rejoin restores the same token.

## 2. Endpoints inspected

Session discovery and records:

- `GET /api/sessions` returns only the caller's session, or 401 with no token.
- `POST /api/sessions`, `POST /api/sessions/join`, and `POST /api/sessions/rejoin` remain the invitation flow.
- `GET` and `PATCH` and `DELETE /api/sessions/[code]` require a seat. Delete still requires the code in the body.
- `GET /api/sessions/[code]/sync` and the stream at `GET /api/sessions/[code]/stream` call the same read check. In poll mode the stream route returns an empty state and does not include the session.
- `POST /api/sessions/[code]/leave`.

Writes, all behind `requireParticipant` for that code:

- Evidence, evidence delete, analyze.
- Hypotheses and hypothesis responses.
- Concepts and concept updates.
- Experiments and experiment responses.
- Experiment plans.
- Relationships.
- Practice activities and activity responses.
- Expressions.
- Notes.
- Community actions and impact.

Research:

- `GET /api/research?code=`
- `GET /api/research/export` for `json`, `csv` (`concepts`, `hypotheses`, `evidence`, `checks`, `relationships`), and `md`.

Media:

- `GET /api/media/[id]` still requires a same-session token or a signature. The smoke run recorded a foreign code as 404 and the same-session token as 200.

Left open on purpose and recorded below: `POST /api/demo/reset` and `POST /api/demo/enter`.

## 3. Findings fixed

- Unauthenticated `GET /api/sessions` no longer returns every session code. The unscoped list function was removed.
- A session code alone no longer loads private session data. The read check runs before the full session query.
- Research export is denied unless the caller is the facilitator or the host of that one session. The check runs before the export query. The query is limited to that session id.
- Community Participant A and Participant B do not receive the facilitator note, the hidden hypothesis, or the export file. Their session payload still omits hypotheses and outcome mappings.
- One person can no longer meet the existing numeric thresholds and receive `verified`. Those matches stay `awaiting`, with the reason "Facilitator-supported observation" and the words "not shared verification". Two people, on different stimuli and different methods, still reach `verified`. The label remains session-verified inside this session. The reason says it is not a claim of linguistic truth.
- The numeric rule is unchanged: accepted wording, no disagreement, at least two stimuli, at least two methods, at least two decisive correct responses, and a match rate of at least 0.75. The same stimulus still counts once. A disagreement still disputes the concept. A second person's evidence that does not meet the thresholds stays unverified, and the reason can say independent participant evidence is on record.
- Recommendations that can tie each competing reading to a different example are `ready`. The expected result names that example. Recommendations that cannot, including untagged or invented readings, are `draft`. Their outcomes do not distinguish, and the limitation says a facilitator has to review them. A draft is not described as a validated discriminating experiment.
- The participant experiments page now opens an approved check when one exists. It was opening a later unapproved draft, so the response box never appeared.

## 4. Tests and actual results

Unit tests: 9 files, 72 tests passed. That includes the new access-control and verification tests, the experiment and privacy tests, the community and reliability tests, and the embedded Postgres rehearsal. The rehearsal is not a hosted Postgres or Supabase test.

TypeScript: `tsc --noEmit` passed.

ESLint: `eslint . --max-warnings 0` passed.

Production build: `npm run build` passed, then `next start` on port 3010. Health was HTTP 200.

API smoke: passed, including export with the creating seat's token, two-author session verification, and deletion of only the smoke session. SHORE-1001 stayed at 8 concepts.

Reliability journey: passed. Unauthenticated read of SHORE-1001 was HTTP 401 and the body did not include "Water".

Community journey: passed, including two-author session verification, a rejected identical stimulus, and disagreement.

Experiment journey: passed. The participant response hid hypotheses and outcome mappings. The recorded outcome stayed unverified.

Access audit, on temporary sessions that the script deleted: passed.

- No token, session list: 401, and the body did not include SHORE-1001.
- Guessed code `TREE-0000`: 404.
- SHORE-1001 with no token: 401, body did not include "Water".
- Known code with no token: 401.
- Token from the other session: 403.
- Invalid token: 403, and the body did not include the session code.
- Participant session and sync: hypotheses length 0, and neither the hypothesis string nor the facilitator note appeared.
- Every export format and the research snapshot: no token 401, participant 403, facilitator 200. Denied bodies did not contain the hypothesis or the note. Facilitator JSON, the research snapshot, and the hypotheses CSV contained the hypothesis. Facilitator JSON and Markdown contained the note. Those facilitator responses did not contain the recovery token.
- Export with a token but no session code: 400.
- Facilitator session list: exactly one session, and not SHORE-1001.
- Left seat: 403. Rejoin: read restored.
- One person, two methods, two stimuli: status `awaiting`, reason included "not shared". A second person on a third method: `verified`.

Two-browser experiment journey: passed. The second browser did not show the outcome mapping, both people submitted, and reload kept the participant reply without the mapping.

Two-browser community journey: passed. The second browser did not see the private reading until both responses were locked.

After those runs, one leftover empty session from an earlier failed browser attempt was deleted. The database then contained only SHORE-1001, with 8 concepts.

Structural benchmark, recomputed in this phase from the local rule planner, not from a live model. "Weak" means at least one of the three recommendations failed a quality check. The best recommendation's checklist count is separate. Passing 8 of 8 is not a probability and is not information gain.

| Scenario | Sufficient | Distinguishes | Weak plan present | Best checklist |
| --- | --- | --- | --- | --- |
| Object versus substance | yes | yes | yes | 8 of 8 |
| Action versus object | yes | yes | yes | 7 of 8 |
| Direction versus destination | yes | yes | yes | 7 of 8 |
| Possession versus ownership | yes | yes | yes | 6 of 8 |
| Person versus relationship | yes | yes | yes | 6 of 8 |
| Quantity versus intensity | yes | yes | yes | 6 of 8 |
| Gesture versus action | yes | yes | yes | 6 of 8 |
| Sound versus noise | yes | yes | yes | 7 of 8 |
| Request versus a name | yes | yes | yes | 6 of 8 |
| Place versus object | yes | yes | yes | 6 of 8 |
| Too little to separate | no | no | no | 0 |
| A stimulus already used | yes | yes | yes | 6 of 8 |

The object-versus-substance visual recommendation was `ready` and named the holder examples. The unmapped pair "Blorp" and "Snath" produced a draft whose outcomes do not distinguish.

## 5. Remaining risks

- `POST /api/demo/reset` is still unauthenticated and would rewrite SHORE-1001. It was not called.
- `POST /api/demo/enter` still returns the illustrative seat's recovery token to anyone who asks for seat A or B. That token reads the demo session. It does not authorize any other session. It was not called in this run.
- Join and read use different status codes. An unknown code is 404. A known code without a token is 401. The private body is not returned, but the status reveals that the code exists.
- A community participant who already knows a hypothesis id can accept or reject it. Their session payload does not include the id. The community journey still uses the facilitator's id, so that route was not blocked.
- Practice responses still include the `correct` boolean for people in the session. The answer key itself is withheld from non-facilitators.
- A facilitator can approve a draft recommendation. Approval shows the neutral prompt. It does not session-verify a meaning.
- Recovery tokens do not expire on a clock. Leaving blocks them until the same token is used to rejoin.
- A participant can create a note and can read their own notes. They cannot read the facilitator's notes.
- Past checks from someone who later leaves still count. Withdrawal was tested as a loss of read access, not as a separate case that erases evidence.
- Server logs redact database URLs, bearer tokens, and JWT-shaped strings. They do not have a separate scrubber for an arbitrary API key that does not match those shapes. This phase did not log prompts, notes, or tokens.
- CSV datasets other than hypotheses were confirmed as 200 for the facilitator and as 401 or 403 without the private strings for everyone else. Those other facilitator CSV bodies were not separately scanned for the recovery token.
- No hosted Postgres, Supabase, or production deployment was tested. The embedded Postgres rehearsal only copies the local demo session.

## 6. Local-only use

Local use on this machine, bound to `127.0.0.1:3010`, is safe for one operator. Other machines cannot reach that address. Session reads and exports require a seat. SHORE-1001 is intact. The operator should not post the demo reset unless they intend to rewrite the illustrative session.

## 7. Shared-server volunteer testing

Shared-server volunteer testing is not safe yet.

The session and export checks in this report passed, and that is not enough for a server other people can reach. The unauthenticated demo reset can rewrite the illustrative session. The demo enter route hands out the illustrative recovery tokens. A known code can be distinguished from an unknown code. A participant who learns a hypothesis id can accept it. Practice responses still expose whether an answer was marked correct. Tokens do not expire except by leaving. Those routes were not locked in this phase, and no shared or hosted server was tested.
