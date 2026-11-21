# Phase 2 report

## 1. Initial architecture audit

The app was already a working Next.js App Router product with Prisma, SQLite, guest sessions, multimodal capture, a demo AI provider, an OpenAI-compatible provider, verification, vocabulary, practice, research export, and a static force graph.

The weak points were scientific, not structural:

- Two correct answers could verify a meaning even when they came from the same experiment or the same kind of check.
- Demo mode was honest, but a configured model still did not separate observations from inferences, and audio or video had no truthful analysis path.
- Sync was a 2.5 second poll.
- The graph could not be panned, zoomed, or dragged.
- Exports were one concept CSV, one JSON blob, and a short Markdown report.
- The interface was already restrained, but the landing line and status language still said "verified" as if the session had established a linguistic fact.

The sample session `SHORE-1001` was left in place. A copy of the database before the schema change is in `data/backups/first-contact-before-phase2.db`.

## 2. Major improvements

- Session notes now include a research objective, archive, and restore.
- Evidence records a stance (observation, participant interpretation, confirmatory, contradictory), consent, duration, quality note, and structured gesture fields.
- Contradictory evidence attached to a concept reopens it. Earlier checks stay in the history and do not carry the new round.
- Video can be previewed. One frame can be captured in the browser and submitted as an image. The rest of the video is not sent.
- Practice calls out a concept missed twice. Expression trials store a context and a counterexample. Grammar notes stay hypotheses.
- Settings explains the facilitator, the verification rule, theme, and retention.

## 3. AI provider capabilities

The provider interface is unchanged in shape and stricter in content.

- Demo mode still does not inspect files. Each result is marked simulated and says what it could not determine.
- OpenAI-compatible chat completions still validate JSON with Zod. A bad shape, timeout, rate limit, or network failure is shown. Nothing is verified, and a failed live call is not replaced with a simulation.
- With consent, JPEG, PNG, GIF, and WebP under 4 MB can be sent for description. The prompt separates observations from inferences.
- Audio is sent only when the participant consents, `OPENAI_AUDIO_MODEL` is set, and the file is wav or mp3. The prompt forbids translation and invented phonemes. Browser webm recordings stay on disk.
- A whole video is never sent. A selected frame can be analyzed as an image, and the note says the rest of the video was not seen.

No API key was available in this environment, so the live vision and audio calls were not executed against a model. The dispatch rules are unit-tested.

## 4. Verification engine changes

Session-verified now requires all of the following in the current round:

- A participant accepted the wording.
- No recorded disagreement.
- Correct responses on at least two different stimuli.
- Those stimuli come from at least two different kinds of check.
- At least three quarters of the responses match.

The same stimulus key counts once. Repeating a demonstration, sound, or counterexample with the same note is rejected. A visual or contrast check that uses the same set of entries is rejected.

New check types: action demonstration, gesture reproduction, audio matching, and a participant counterexample.

States shown in the interface: Proposed, Awaiting participant response, Tentatively accepted, Under verification, Session-verified, Rejected, Disputed, Reopened, Archived.

"Session-verified" is agreement inside this session. It is not linguistic truth. Relationships keep their own status.

Existing rows in `SHORE-1001` kept the status text written when they were seeded. The new rule applies the next time a concept is recomputed. The sample still has 4 session-verified concepts, 1 disputed concept, and 8 concepts total.

## 5. Collaboration changes

Joined seats open a server-sent stream at `/api/sessions/[code]/stream`. The recovery key is sent as a header, not in the URL. The stream emits a full state only when the session revision changes, and presence otherwise. If the stream drops, the client polls and tries the stream again. There is no external realtime service.

## 6. Knowledge graph changes

The graph reads the session's relationships. Nodes can be dragged. The background can be panned. The wheel zooms. Search, category, and relationship type filter the view. Selecting a node can focus its neighbors. Confirmed lines are solid. Hypothesis lines are dashed. Adding a line still creates a hypothesis. Verifying a concept does not confirm its lines.

## 7. Research export changes

JSON still exports the session structure without tokens or file paths.

CSV datasets, chosen with `dataset=`:

- concepts
- hypotheses
- evidence
- checks
- relationships

The Markdown report now includes the methodology, disagreements, unresolved interpretations, and limitations. Illustrative sessions are still labeled as not fieldwork. Deleted media is omitted.

## 8. UI redesign summary

The visual language stayed a field ledger: warm paper, ink, one teal action, serif titles, and rules instead of cards. The landing headline is now "Meaning begins before language." Navigation distinguishes Overview, Sessions, Research, Settings, and, inside a session, Discovery, Vocabulary, Practice, Expressions, Graph, and Research.

Motion is limited to the landing exchange and respects reduced motion. Private images go through `next/image` with optimization disabled so the authorized media route stays in control. Camera previews use a labeled frame instead of a raw image element. The raw-image lint warnings are gone.

On a narrow screen the header stacks instead of squeezing the wordmark and the session code onto one line. The discovery workspace still uses its three panes, with a tab switch below 1040px.

## 9. Security improvements

- Media bytes are sent to a provider only after an explicit consent checkbox on that item.
- The stream does not put the recovery key in the query string.
- Upload type and size checks are unchanged. SVG uploads stay rejected.
- Cross-session media reads and deletes still fail. The smoke test covers both.
- API keys remain server-side. Exports do not include tokens.
- The session code is still the read secret for this local installation. That limitation is unchanged.

## 10. Test results

Executed after the phase 2 changes:

- Unit tests: 23 passed (`vitest run`).
- TypeScript: passed (`tsc --noEmit`).
- ESLint: passed with 0 errors and 0 warnings.
- Production build: passed (`next build`).
- HTTP smoke test against `http://127.0.0.1:3010`: passed. It creates a session, joins a second seat, uploads an image, checks that hypotheses are not auto-verified, requires two different checks before session-verified, builds practice and an expression, exports Markdown, blocks a foreign session code from reading media, blocks a cross-session delete, and deletes only the smoke session.
- Browser, on the production server: landing, demo entry as Researcher A, discovery workspace for `SHORE-1001`, vocabulary, practice, graph, research exports, and settings. A 390px-wide pass showed the session navigation wrapping too tightly. The header now stacks under 720px, and the production server was rebuilt with that change.

`SHORE-1001` was still present after the smoke test: 8 concepts, 4 verified, 1 disputed, 8 evidence items.

## 11. Known limitations

- No API key was configured, so a live vision or audio model was not called.
- Webm microphone recordings are stored and are not sent, even with consent, unless they are wav or mp3 and `OPENAI_AUDIO_MODEL` is set.
- The stream is server-sent events over a local poll of the database, not a websocket cluster.
- Two seats only. The session code remains the read secret. The recovery key remains in local storage.
- Gesture and expression practice can still be self-assessed. The app does not watch the person.
- The graph is a force layout with pan, zoom, and drag. It is not a full diagram editor, and a large graph can still need a pan to see every node.
- Sample concepts keep their original stored status sentences until something recomputes them.
- There is no account system and no encryption at rest.
- Nothing here creates a legal ownership right or trains a model.

## 12. Remaining work

- Run the OpenAI path against a real vision model and a real audio model with consent, using a non-illustrative session.
- Accept more audio containers without pretending they were transcribed.
- Replace the session code as a read secret with per-participant read tokens if this is ever hosted for more than one pair.
- Let a researcher configure a practice set explicitly, beyond generating from current entries.
- Keep a phonetic comparison tool that refuses to invent IPA for an undocumented language.

## Implemented versus deferred

Implemented in this phase: stronger verification, consent-gated multimodal dispatch, video keyframes, gesture structure, session archive and notes, server-sent sync with polling fallback, an interactive graph, richer exports, practice and expression notes, settings, and the design adjustments above.

Deferred: a second vendor SDK, phonetic analysis, hosted multi-pair auth, encryption at rest, and a live model call. Those need credentials or a deployment this phase was not allowed to create.
