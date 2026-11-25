# Phase 8.1 security hardening report

Local only. Nothing was committed, pushed, or deployed. The app under test is `http://127.0.0.1:3010`. Health returned HTTP 200 in demo mode, with SQLite connected. No external model was called.

SHORE-1001 was not reset. After the temporary sessions were removed, it was the only session, with 8 concepts and 8 evidence rows. The numeric verification rule was not changed.

## 1. Demo reset

`POST /api/demo/reset` used to call `seedIllustrativeSession()` for any visitor. That rewrites the illustrative session.

The route now refuses the request before it reads or writes session data unless all of these are true:

- `ALLOW_DEMO_OPERATOR=1`
- `DEMO_OPERATOR_SECRET` is at least 24 characters
- `DEMO_OPERATOR_DISABLED` is not `1`
- `VERCEL_ENV` is not `production` or `preview`

The caller must send that secret in the `x-demo-operator` header. The comparison is timing-safe. A session code is not accepted as authorization. The secret is not in the browser bundle. The demo page no longer calls reset. `Origin` from another host, or `Sec-Fetch-Site: cross-site`, is refused with 403 even when the secret matches.

When the gate is off, the response is 403 `Demo operator actions are disabled.` A wrong secret is 401 `Operator authorization is required.` Loading the route, and calling it without the secret, left the concept and evidence counts unchanged. An ordinary server restart does not import or run the seed.

This is off in the current local environment. The running server was not given the operator secret.

## 2. Demo entry

`POST /api/demo/enter` used to return the stored recovery token for seat A or seat B. Two calls gave both seats to anyone.

The same operator gate now sits in front of the route. One authorized request asks for one role and returns one new demo credential. The response does not include the other seat, the stored recovery token, or the session id. The credential is scoped to that illustrative seat, expires in 120 minutes by default (`DEMO_ENTRY_TTL_MINUTES`), and replaces an earlier demo credential for that same seat. It is not written into the session list. Issuing it does not replace the stored recovery token, so existing local copies of the old illustrative key keep working until someone renews that seat.

The local operator workflow is on `/demo`:

1. Set `ALLOW_DEMO_OPERATOR=1` and `DEMO_OPERATOR_SECRET` in the server environment, then restart.
2. Request one seat from the shell, with the secret only in that shell: `curl -sS -X POST http://127.0.0.1:3010/api/demo/enter -H "content-type: application/json" -H "x-demo-operator: $DEMO_OPERATOR_SECRET" -d '{"role":"A"}'`
3. Paste that JSON into the page and open the seat. A second browser needs a second request with `{"role":"B"}`.
4. Reset, if wanted, is `curl -sS -X POST http://127.0.0.1:3010/api/demo/reset -H "x-demo-operator: $DEMO_OPERATOR_SECRET"`. It rewrites only the illustrative session.

Unauthorized enter tests returned 403 and did not contain a token. The authorized path was not called against SHORE-1001.

## 3. Session-code existence

Unauthenticated and unrecognized callers now get the same 404 and the same body, `No session is available for this request.`, for:

- an unknown code
- SHORE-1001 with no token
- a known code with no token
- an invalid token
- a token that belongs to another session
- join with an unknown code
- export with no token, a bad token, or a cross-session token

The access audit compared those bodies. A member who has left still gets 403. An expired or replaced key for the matching session gets 401. A member who is not the facilitator still gets 403 on export. Those distinctions happen only after the key matches that session.

Joining with a real code still succeeds. That is the invitation. A taken seat still returns 409, and that message includes the display name of the person in the seat.

Lookups for the session row and the credential run together. That reduces, and does not eliminate, timing differences.

## 4. Hypothesis changes

Accept, reject, and challenge are checked on the server before the hypothesis row is loaded. Only a community facilitator, or seat A in a research or general session, may change a hypothesis or create a concept that records an accepted reading. Participant A and Participant B receive 403 `Only the facilitator can change a hypothesis.` The body does not include the wording.

There is no edit or delete handler. PATCH and DELETE returned 405, and the body did not include the wording.

A host who presented a hypothesis id from another session received 404 without that wording, and the original hypothesis stayed open. Direct HTTP calls covered accept, reject, challenge, the missing methods, and the cross-session id. The community, reliability, and smoke journeys now accept with the facilitator or host token.

A participant can still propose a new open hypothesis. They cannot accept it.

## 5. Practice responses

Practice activities are solo. The serialized activity includes `practiceMode: "solo"`.

The answer key is sent only to the facilitator or host. Another participant receives an empty answer key. They receive their own response, including whether it matched, as private feedback from the answer call and from their own session read. They do not receive the other person's response, notes, clarification, or `correct` flag. The activity event payload is included for the author and for the facilitator or host, and is empty for the other participant.

There is no collaborative practice type. Solo results are not withheld for a second lock, because there is no shared lock on these activities. The direct session read was tested, not only the page.

## 6. Recovery-token lifecycle

New recovery keys are random 48-character hex secrets. The database stores SHA-256 of the secret in `AccessCredential`, and the participant row stores `issued:<id>` rather than the secret. The secret is returned once, from create, join, rejoin, or an authorized demo entry.

Default lifetime is 168 hours (`RECOVERY_TOKEN_TTL_HOURS`, clamped from 1 hour to 30 days). Demo entry credentials use a separate 120-minute default.

Leave sets `leftAt` and revokes current credentials. Rejoin with the key that was current at leave is allowed, issues a new key, and the presented key then fails as replaced. A key that was already replaced cannot be replayed. A key for another session gets the same 404 as an unknown code. An expired key for the matching session can be renewed by rejoin. A renewed key is what the browser must store. The start and session screens already save the rejoin response.

Compatibility: keys created before this change, including the illustrative seats, stay in `Participant.token` as plaintext and do not expire by the new clock. They keep working until that person leaves or rejoins. Renewal then stores only a hash and the old plaintext stops matching. Startup does not rewrite those rows. SHORE-1001's stored tokens were not rotated.

Tests covered a hashed key, expiry, replacement, a legacy plaintext key, a cross-session key, an invalid key, and an unknown code. The HTTP audit covered rejoin, the replaced key, and leave.

## 7. Tests and results

Unit tests: 10 files, 76 tests passed. That includes the new gate, denial, hash, expiry, replacement, and legacy-key tests, plus the existing access, community, reliability, and embedded Postgres rehearsal. The rehearsal is not a hosted Postgres or Supabase test. Unit files run one at a time so the rehearsal's check that the copy does not touch the SQLite file is not racing a test that writes sessions.

TypeScript and ESLint passed. The production build passed, then `next start` on port 3010. Health was HTTP 200.

These HTTP runs passed on that server:

- security hardening script
- API smoke
- reliability journey
- community journey
- experiment journey
- access audit
- two-browser experiment journey
- two-browser community journey

The authorized demo reset and authorized demo enter were not called. No live model was called.

## 8. Remaining limitations

- Illustrative recovery keys that already exist are still plaintext in the local database. They do not expire until that seat is renewed.
- A successful join confirms that the code exists. A taken seat still names the person in it.
- Credential and session lookups are parallel, not constant-time end to end.
- There is no request rate limit.
- The facilitator or host can still see solo practice scores and the answer key. The other participant cannot.
- A participant can still file an open hypothesis. They cannot accept, reject, or challenge one.
- A facilitator can still approve a draft experiment. Approval does not session-verify a meaning.
- If the operator variables are turned on and the port is reachable, anyone who learns the secret can reset the illustrative session. Cross-origin browser calls are refused. The secret is not in the page.
- Hosted Postgres, Supabase, and the production deployment were not tested. The frozen Postgres migration now also creates `AccessCredential`, and the local copy rehearsal included that empty table.

## 9. Local single-operator use

Safe on this machine at `http://127.0.0.1:3010`, with the demo operator gate left off. Restarting the server does not reset the database. SHORE-1001 is intact.

## 10. Controlled two-person testing

Reasonable for two people using this local server, each with only the recovery key for their own seat. The HTTP and two-browser checks covered session reads, exports, hypothesis changes, solo practice, leave, rejoin, and replacement. It is not a substitute for a review of a server other people can reach.

## 11. Shared-server deployment

Not safe. The local suite did not exercise a shared or hosted server. Existing plaintext recovery keys remain until renewal. Join still confirms a real code. There is no rate limit. Turning on the demo operator secret on a reachable server would make reset available to anyone who obtains that secret. Do not treat the passing local tests as clearance for volunteer use on a shared server.
