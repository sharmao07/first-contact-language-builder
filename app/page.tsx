import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/layout/site";
import { Walkthrough } from "@/components/landing/walkthrough";
import { getAIPublicStatus } from "@/lib/ai/config";

export default function HomePage() {
  const ai = getAIPublicStatus();
  return (
    <>
      <SiteHeader />
      <main id="content">
        <section className="hero wrap">
          <div className="stack">
            <h1>Helping people communicate when no shared language exists.</h1>
            <p className="lede">First-Contact Language Builder helps two people discover what their expressions mean to each other. Don&apos;t assume meaning. Discover it together.</p>
            <div className="row">
              <Link className="btn btn-primary" href="/start">Start community access</Link>
              <Link className="btn" href="/demo">Explore a sample session</Link>
            </div>
          </div>
          <div className="exchange" aria-hidden="true">
            <svg className="glass-drawing" viewBox="0 0 120 200" fill="none">
              <path d="M34 28h52l-7 104a19 19 0 0 1-38 0L34 28z" stroke="currentColor" strokeWidth="1.5" />
              <g className="glass-water">
                <path d="M40 86h40l-4 40a14 14 0 0 1-32 0l-4-40z" fill="var(--oxide)" />
                <path className="glass-shine" d="M46 92h10l-1 18" stroke="var(--bg-elev)" strokeWidth="1.5" />
              </g>
              <path d="M46 28V16h28" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <div className="stack-sm">
              <p className="small">Seat A points at the glass and mimes a drink. Seat B draws it back.</p>
              <p className="guess-line"><span className="status status-open">Guess</span> the container</p>
              <p className="guess-line"><span className="status status-open">Guess</span> the water</p>
              <p className="guess-line"><span className="status status-open">Guess</span> the drink</p>
              <p className="small">The glass is evidence. None of these readings is session-verified.</p>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="wrap stack">
            <h2>The communication problem</h2>
            <div className="grid-3">
              <p className="rule">Translation tools assume both languages are already known. First contact does not have that luxury.</p>
              <p className="rule">A point, a mime, or a similar sound can mean an object, an action, a request, or a place. The picture does not decide.</p>
              <p className="rule">If software promotes a guess into a dictionary entry, the two people lose the disagreement that would have taught them something.</p>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="wrap stack">
            <h2>A guided workshop, not a translation.</h2>
            <p>One person opens a session and invites the other with a code or a QR. They keep separate seats. They can use pictures, drawings, gestures, demonstrations, audio, video, or written descriptions. Competing guesses stay open. A later check is planned so the two replies can tell those guesses apart. The replies stay hidden until both are locked. Only a meaning that meets the session&apos;s checks can be arranged as shared vocabulary. Anything unresolved or disputed stays labeled uncertain.</p>
            <ol className="ledger">
              <li><span>01</span>Start a session. Invite the other person with a code or QR. Each person has their own seat.</li>
              <li><span>02</span>Communicate without a shared vocabulary. Record a picture, drawing, gesture, demonstration, sound, video, or written description.</li>
              <li><span>03</span>Keep competing guesses. The app does not decide that an expression means the container, the water, drinking, or a request.</li>
              <li><span>04</span>Plan a check that names what each result would support or weaken. AI can propose the check. It cannot verify the meaning.</li>
              <li><span>05</span>Each person answers separately. The answers stay hidden until both are locked.</li>
              <li><span>06</span>Add a meaning to the shared board only after the session&apos;s checks pass. A guess, a facilitator-supported observation, and a dispute stay visible and uncertain.</li>
            </ol>
          </div>
        </section>

        <section className="section">
          <div className="wrap grid-2">
            <div className="stack">
              <h2>An illustrated pass</h2>
              <p>Follow one ambiguous glass through hypothesis, contrast, and a second check.</p>
            </div>
            <Walkthrough />
          </div>
        </section>

        <section className="section">
          <div className="wrap stack">
            <h2>What you can do here</h2>
            <div className="grid-3">
              <p className="rule">Capture evidence from the camera, microphone, a drawing, or a file on this computer.</p>
              <p className="rule">Keep AI output, participant interpretations, and verified entries visually distinct.</p>
              <p className="rule">Search a shared vocabulary and practice only entries the session has actually recorded.</p>
              <p className="rule">Inspect a concept&apos;s evidence, checks, and disagreements on one timeline.</p>
              <p className="rule">Draw relationships and mark each one as a hypothesis or as confirmed by the participants.</p>
              <p className="rule">Export the local record as JSON, CSV, or a Markdown report.</p>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="wrap stack">
            <h2>Who this can help</h2>
            <div className="grid-3">
              <p className="rule">A newcomer and a local volunteer can build a small practical vocabulary for everyday objects, actions, and needs. This supplements interpreters. It is not emergency or medical instruction.</p>
              <p className="rule">A researcher can keep alternative readings and the observations that support them during an early elicitation session.</p>
              <p className="rule">A team working across languages can check a procedure or an object with a demonstration instead of assuming a symbol already means the same thing to both people.</p>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="wrap grid-2">
            <div className="stack">
              <h2>Privacy and community ownership</h2>
              <p>Camera and microphone access are requested only when you start a capture. Recordings stay in this installation&apos;s data folder and are not published.</p>
              <p>The application does not train models on what you record. A setting in the app does not create a legal ownership right. It does keep deletion in the participants&apos; hands.</p>
              <p className="small muted">{ai.disclosure}</p>
              <Link href="/privacy">Read the privacy notice</Link>
            </div>
            <div className="stack">
              <h2>Begin with one concept</h2>
              <p>Open a session, invite the other person with the code or QR, and record one expression before asking for guesses. This installation has not been shown to work for people who truly share no language, and it is not ready for a shared public server.</p>
              <div className="row">
                <Link className="btn btn-primary" href="/start">Start a discovery session</Link>
                <Link className="btn" href="/demo">Explore a demo</Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
