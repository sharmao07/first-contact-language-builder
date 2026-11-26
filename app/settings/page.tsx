import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/layout/site";
import { ThemeToggle } from "@/components/theme-toggle";
import { PageHeader } from "@/components/ui/bits";
import { getAIPublicStatus } from "@/lib/ai/config";
import { METHODOLOGY } from "@/lib/verification/methodology";

export default function SettingsPage() {
  const ai = getAIPublicStatus();
  return (
    <>
      <SiteHeader />
      <main id="content" className="wrap page-pad stack-lg">
        <PageHeader
          eyebrow="Installation preferences"
          title="Settings"
          description="These controls stay on this computer. Nothing here publishes a session or trains a model."
        />

        <div className="grid-2">
          <section className="surface stack">
            <h2>Appearance</h2>
            <p className="small">Light and dark modes share the same warm stone paper, carbon ink, and terracotta accent. Your preference is stored in this browser only, or toggle anytime with <span className="kbd">T</span>.</p>
            <div className="row">
              <ThemeToggle />
              <span className="small muted">Switch light / dark paper</span>
            </div>
          </section>

          <section className="surface stack">
            <div className="row-between">
              <h2>Facilitator</h2>
              <span className="status-pill">Mode: {ai.mode}</span>
            </div>
            <p className="small">{ai.disclosure}</p>
            <p className="small muted">
              A file is sent to a provider only after a participant checks consent on that piece of evidence. Audio is not translated. A video is not analyzed unless someone captures a frame and submits that still.
            </p>
          </section>
        </div>

        <section className="surface stack">
          <h2>What session-verified means</h2>
          <p className="small" style={{ color: "var(--ink)", lineHeight: "22px" }}>{METHODOLOGY}</p>
        </section>

        <section className="surface stack">
          <h2>Retention & deletion</h2>
          <p className="small">
            Sessions, evidence, and recordings stay in the local database and the <code className="mono">data/uploads</code> folder. Delete a recording from the discovery workspace, or delete a whole session by typing its code. Archiving a session keeps the record and marks it inactive.
          </p>
          <div>
            <Link className="btn btn-sm" href="/privacy">Privacy and deletion</Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
