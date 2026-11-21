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
            <h1>Meaning begins before language.</h1>
            <p className="lede">A collaborative discovery system for people who have no shared language. Build understanding through images, gestures, sounds, experiments, and human confirmation.</p>
            <div className="row">
              <Link className="btn btn-primary" href="/start">Start a discovery session</Link>
              <Link className="btn" href="/demo">Explore a demo</Link>
            </div>
          </div>
          <div className="exchange" aria-hidden="true">
            <article>
              <p className="small muted">Participant A</p>
              <p>Points at a glass. Mimes drinking.</p>
              <p className="small">Evidence, not a definition.</p>
            </article>
            <article>
              <p className="small muted">Participant B</p>
              <p>Draws the glass. Records a sound.</p>
              <p className="small">Water, drinking, or the cup?</p>
            </article>
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
            <h2>How first-contact discovery works</h2>
            <div className="grid-2">
              <p className="rule">Two people share a session code and keep their own seats. Either person can bring a photo, a drawing, a sound, a short video, or a description of a gesture.</p>
              <p className="rule">The facilitator proposes several meanings, names what is ambiguous, and suggests a check. A person has to accept, reject, or challenge each one.</p>
              <p className="rule">Checks use a different example: a contrast, a new context, or a reverse demonstration. One match is not verification.</p>
              <p className="rule">Agreed entries can be combined into an expression trial. Word order stays marked as a hypothesis, not a grammar.</p>
            </div>
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
            <h2>Research and language preservation</h2>
            <div className="grid-3">
              <p className="rule">Two neighbors can build a small working vocabulary when they do not share speech.</p>
              <p className="rule">A field worker can keep the community&apos;s corrections beside the model&apos;s suggestions instead of overwriting them.</p>
              <p className="rule">A family can record a home gesture system with its disputes intact, on a machine they control.</p>
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
              <p>Open a session, invite the other person with the code, and submit one piece of evidence before asking for hypotheses.</p>
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
