import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/layout/site";
import { ThemeToggle } from "@/components/theme-toggle";
import { getAIPublicStatus } from "@/lib/ai/config";
import { METHODOLOGY } from "@/lib/verification/methodology";

export default function SettingsPage() {
  const ai = getAIPublicStatus();
  return (
    <>
      <SiteHeader />
      <main id="content" className="wrap section stack">
        <h1>Settings</h1>
        <p>These controls stay on this computer. Nothing here publishes a session or trains a model.</p>
        <section className="stack">
          <h2>Appearance</h2>
          <p>Light and dark use the same ink, paper, and teal. The choice is stored in this browser only.</p>
          <ThemeToggle />
        </section>
        <section className="stack">
          <h2>Facilitator</h2>
          <p>{ai.disclosure}</p>
          <p className="small">Mode: {ai.mode}. A file is sent to a provider only after a participant checks consent on that piece of evidence. Audio is not translated. A video is not analyzed unless someone captures a frame and submits that still.</p>
        </section>
        <section className="stack">
          <h2>What session-verified means</h2>
          <p>{METHODOLOGY}</p>
        </section>
        <section className="stack">
          <h2>Retention</h2>
          <p>Sessions, evidence, and recordings stay in the local database and the data/uploads folder. Delete a recording from the discovery workspace, or delete a whole session by typing its code. Archiving a session keeps the record and marks it inactive.</p>
          <p><Link href="/privacy">Privacy and deletion</Link></p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
