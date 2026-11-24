# Contribution log

Dates below are the dates of the work that is actually in the repository or in this working copy. They are not backdated, and they are not participation results.

## Already published before this pass

- 21 November 2026: the discovery application was committed and pushed as the initial public repository. That version already had sessions, evidence, hypotheses, verification, vocabulary, practice, expressions, the concept graph, and the illustrative session SHORE-1001.
- 22 November 2026: Speed Insights was added to the site and that commit was pushed. The current Vercel deployment is that published application, not the work below.

## Local work on 24 November 2026, not committed and not deployed

Reliability, carried forward so community sessions have a working local record:

- Health now reports database connectivity, storage, and the AI provider separately. `ok` requires a connected database and persistent storage.
- Uploads go through a storage interface. Local disk remains the development store. Supabase Storage is implemented behind server environment variables and has not been pointed at a real project.
- A PostgreSQL Prisma schema and a copy script exist. The copy script was not run. No production database credentials are configured.
- The local database was backed up before the schema change. SHORE-1001 still has 8 concepts and purpose `general`.

Community-access work for this submission:

- Session purpose: community, research, or general. Community access asks for a confirmation that the session is not emergency or professional interpretation.
- Guided situations, private responses, locked comparison, ambiguity, a rule-based discriminating check, and a recorded outcome.
- An OpenAI JSON suggestion path with Zod validation, used only when that provider is configured. This machine is in demo mode, so the tested path is the rule fallback. The suggestion does not claim an optimal information gain and does not verify a meaning.
- Shared board: select concept cards, arrange them, show the row, and record understood, not understood, or a request for clarification.
- Impact counts and a Markdown download computed from the session.
- Privacy note updated for private drafts and for not training on uploaded evidence.
- Landing headline set to "Everyone deserves a way to be understood." The earlier line "Meaning begins before language." remains on the page as the description of the method.

Research mode, discovery, vocabulary, practice, expressions, the graph, and SHORE-1001 were kept.
