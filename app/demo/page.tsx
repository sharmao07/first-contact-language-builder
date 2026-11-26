"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Terminal } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/layout/site";
import { Field, Notice, PageHeader } from "@/components/ui/bits";
import { writeIdentity } from "@/lib/client/identity";

type SeatCredential = {
  code: string;
  token: string;
  participantId: string;
  role: string;
  displayName: string;
};

export default function DemoPage() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [credential, setCredential] = useState("");

  function openSeat() {
    setMessage(null);
    try {
      const result = JSON.parse(credential) as Partial<SeatCredential>;
      if (!result.code || !result.token || !result.participantId || !result.role || !result.displayName) {
        throw new Error("Paste the one-seat response from the operator command.");
      }
      writeIdentity({
        code: result.code,
        token: result.token,
        participantId: result.participantId,
        role: result.role,
        displayName: result.displayName,
      });
      router.push(`/session/${result.code}`);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "That seat credential could not be opened.");
    }
  }

  return (
    <>
      <SiteHeader />
      <main id="content" className="wrap page-pad stack-lg">
        <PageHeader
          eyebrow="Sample session · SHORE-1001"
          title="Explore the illustrative session"
          description="The illustrative session is operator-issued one seat at a time. One response never contains both seats, and the server secret is never embedded in browser code."
        />

        <Notice tone="warning">
          Demo mode. This session is invented sample data, not fieldwork. Its hypotheses were not produced by a model looking at the files.
        </Notice>

        <div className="split-aside">
          <div className="surface stack">
            <div className="row" style={{ gap: 8 }}>
              <Terminal size={18} strokeWidth={1.5} style={{ color: "var(--oxide)" }} aria-hidden="true" />
              <h2>Operator steps</h2>
            </div>
            <ol className="stack" style={{ paddingLeft: 20, margin: 0 }}>
              <li className="small">
                In the server environment, set <code className="mono">ALLOW_DEMO_OPERATOR=1</code> and <code className="mono">DEMO_OPERATOR_SECRET</code> to a private value of at least 24 characters. Leave both unset on a shared server. <code className="mono">VERCEL_ENV=production</code> or <code className="mono">preview</code> disables the route even if those values are present.
              </li>
              <li className="small">Restart the local server so it reads the environment.</li>
              <li className="small">
                Request one seat from your shell:
                <pre className="surface-recessed mono small" style={{ marginTop: 8, overflowX: "auto", padding: 12 }}>
{`curl -sS -X POST http://127.0.0.1:3010/api/demo/enter \\
  -H "content-type: application/json" \\
  -H "x-demo-operator: $DEMO_OPERATOR_SECRET" \\
  -d '{"role":"A"}'`}
                </pre>
              </li>
              <li className="small">
                Paste that JSON on the right and open the seat. A second browser needs a second request with <code className="mono">{`{"role":"B"}`}</code>.
              </li>
            </ol>
            <div className="surface-recessed stack-xs">
              <p className="small" style={{ fontWeight: 500, color: "var(--ink)" }}>Resetting the sample</p>
              <p className="small">
                Reset is also operator-only: <code className="mono">curl -sS -X POST http://127.0.0.1:3010/api/demo/reset -H &quot;x-demo-operator: $DEMO_OPERATOR_SECRET&quot;</code>. It rewrites the illustrative session only. Sessions you created stay intact.
              </p>
            </div>
          </div>

          <div className="surface stack">
            <h2>Open a seat</h2>
            <Field label="One-seat credential">
              <textarea
                className="textarea mono"
                value={credential}
                onChange={(event) => setCredential(event.target.value)}
                rows={6}
                maxLength={4000}
                placeholder='{"code":"SHORE-1001","token":"...","participantId":"...","role":"A","displayName":"..."}'
              />
            </Field>
            <button className="btn btn-primary" type="button" onClick={openSeat}>Open this seat</button>
            {message ? <Notice tone="error">{message}</Notice> : null}
            <p className="small muted">Session code SHORE-1001. The credential expires, is not a recovery key, and is never listed to other visitors.</p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
