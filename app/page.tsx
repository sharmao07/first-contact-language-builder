import Link from "next/link";
import { ArrowRight, BookOpen, Camera, GitBranch, Lock, ShieldCheck, Users } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/layout/site";
import { HeroSpecimen } from "@/components/landing/hero-specimen";
import { Walkthrough } from "@/components/landing/walkthrough";
import { getAIPublicStatus } from "@/lib/ai/config";

const PROTOCOL_STEPS = [
  ["01", "Invite", "Start a session. Invite the other person with a code or QR. Each person has their own seat."],
  ["02", "Observe", "Communicate without a shared vocabulary. Record a picture, drawing, gesture, demonstration, sound, video, or written description."],
  ["03", "Hold", "Keep competing guesses. The app does not decide that an expression means the container, the water, drinking, or a request."],
  ["04", "Design", "Plan a check that names what each result would support or weaken. AI can propose the check. It cannot verify the meaning."],
  ["05", "Lock", "Each person answers separately. The answers stay hidden until both are locked."],
  ["06", "Verify", "Add a meaning to the shared board only after the session's checks pass. A guess, a facilitator-supported observation, and a dispute stay visible and uncertain."],
] as const;

const CAPABILITIES = [
  [Camera, "Multimodal evidence", "Capture evidence from the camera, microphone, a drawing, or a file on this computer."],
  [Lock, "Epistemic separation", "Keep AI output, participant interpretations, and verified entries visually distinct."],
  [BookOpen, "Grounded vocabulary", "Search a shared vocabulary and practice only entries the session has actually recorded."],
  [GitBranch, "Concept dossier & graph", "Inspect a concept's evidence, checks, disagreements, and relationships on one timeline."],
  [Users, "Guided community access", "Walk through everyday situations step by step with independent locked replies."],
  [ShieldCheck, "Portable local records", "Export the local record as JSON, CSV, or a Markdown report."],
] as const;

export default function HomePage() {
  const ai = getAIPublicStatus();
  return (
    <>
      <SiteHeader />
      <main id="content">
        <section className="hero wrap">
          <div className="stack-lg">
            <div className="stack">
              <p className="eyebrow">Meaning begins before language</p>
              <h1>Helping people communicate when no shared language exists.</h1>
              <p className="lede">
                First-Contact Language Builder helps two people discover what their expressions mean to each other. Don&apos;t assume meaning. Discover it together.
              </p>
            </div>
            <div className="row">
              <Link className="btn btn-primary btn-lg" href="/start">
                Start community access
                <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
              </Link>
              <Link className="btn btn-lg" href="/demo">Explore a sample session</Link>
            </div>
          </div>
          <HeroSpecimen />
        </section>

        <section className="section">
          <div className="wrap stack-lg">
            <div className="stack-sm" style={{ maxWidth: "40rem" }}>
              <h2>The communication problem</h2>
              <p className="small">Why standard translation tools break down at first contact.</p>
            </div>
            <div className="grid-3">
              <article className="surface stack-sm">
                <p className="mono small" style={{ color: "var(--oxide)" }}>01 · Shared premise missing</p>
                <h3>Translation assumes known lexicons</h3>
                <p className="small">Translation tools assume both languages are already known. First contact does not have that luxury.</p>
              </article>
              <article className="surface stack-sm">
                <p className="mono small" style={{ color: "var(--oxide)" }}>02 · Ambiguous reference</p>
                <h3>A single picture never decides</h3>
                <p className="small">A point, a mime, or a similar sound can mean an object, an action, a request, or a place. The picture does not decide.</p>
              </article>
              <article className="surface stack-sm">
                <p className="mono small" style={{ color: "var(--oxide)" }}>03 · Premature certainty</p>
                <h3>Disagreement is diagnostic</h3>
                <p className="small">If software promotes a guess into a dictionary entry, the two people lose the disagreement that would have taught them something.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="wrap stack-lg">
            <div className="split-aside">
              <div className="stack-sm">
                <h2>A guided workshop, not a translation.</h2>
                <p className="small">
                  One person opens a session and invites the other with a code or a QR. They keep separate seats, hold competing guesses open, answer checks independently before seeing each other&apos;s reply, and promote meanings only when checks across distinct examples agree.
                </p>
              </div>
              <div className="surface-recessed stack-xs">
                <p className="mono small" style={{ color: "var(--ink)" }}>Session-verified rule</p>
                <p className="small">Two participants · two distinct stimuli · two check methods · zero disagreements · at least 75% match.</p>
              </div>
            </div>
            <ol className="ledger">
              {PROTOCOL_STEPS.map(([num, title, copy]) => (
                <li key={num}>
                  <span className="ledger-num">{num}</span>
                  <div className="stack-xs">
                    <h3>{title}</h3>
                    <p className="small">{copy}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="section">
          <div className="wrap split-aside" style={{ alignItems: "center" }}>
            <div className="stack">
              <h2>An illustrated pass</h2>
              <p className="small">Follow one ambiguous glass through hypothesis, contrast, blinded locking, and a second check.</p>
              <div className="surface-recessed stack-xs">
                <p className="small" style={{ color: "var(--ink)", fontWeight: 500 }}>Why two checks matter</p>
                <p className="small">A single match on one prop can be coincidence. Testing an empty glass against water separates the object from the substance.</p>
              </div>
            </div>
            <Walkthrough />
          </div>
        </section>

        <section className="section">
          <div className="wrap stack-lg">
            <div className="stack-sm">
              <h2>What you can do here</h2>
              <p className="small">Tools built around field documentation rather than automated guessing.</p>
            </div>
            <div className="grid-3">
              {CAPABILITIES.map(([Icon, title, copy]) => (
                <article key={title} className="surface stack-sm">
                  <div className="row" style={{ gap: 10 }}>
                    <Icon size={18} strokeWidth={1.5} style={{ color: "var(--oxide)", flex: "none" }} aria-hidden="true" />
                    <h3>{title}</h3>
                  </div>
                  <p className="small">{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section">
          <div className="wrap stack-lg">
            <h2>Who this can help</h2>
            <div className="grid-3">
              <article className="rule stack-xs">
                <h3>Newcomers and volunteers</h3>
                <p className="small">A newcomer and a local volunteer can build a small practical vocabulary for everyday objects, actions, and needs. This supplements interpreters. It is not emergency or medical instruction.</p>
              </article>
              <article className="rule stack-xs">
                <h3>Field linguists and researchers</h3>
                <p className="small">A researcher can keep alternative readings and the observations that support them during an early elicitation session.</p>
              </article>
              <article className="rule stack-xs">
                <h3>Cross-language teams</h3>
                <p className="small">A team working across languages can check a procedure or an object with a demonstration instead of assuming a symbol already means the same thing to both people.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="wrap grid-2">
            <div className="surface stack">
              <h2>Privacy and community ownership</h2>
              <p className="small">Camera and microphone access are requested only when you start a capture. Recordings stay in this installation&apos;s data folder and are not published.</p>
              <p className="small">The application does not train models on what you record. A setting in the app does not create a legal ownership right. It does keep deletion in the participants&apos; hands.</p>
              <p className="small muted">{ai.disclosure}</p>
              <div>
                <Link className="btn btn-sm" href="/privacy">Read the privacy notice</Link>
              </div>
            </div>
            <div className="surface-accent stack" style={{ justifyContent: "space-between" }}>
              <div className="stack">
                <h2>Begin with one concept</h2>
                <p className="small" style={{ color: "var(--ink)" }}>
                  Open a session, invite the other person with the code or QR, and record one expression before asking for guesses. This installation has not been shown to work for people who truly share no language, and it is not ready for a shared public server.
                </p>
              </div>
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
