"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SiteHeader } from "@/components/layout/site";
import { Field, Notice } from "@/components/ui/bits";
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
      <main id="content" className="wrap section stack">
        <h1>Explore the illustrative session</h1>
        <Notice>Demo mode. This session is invented sample data, not fieldwork. Its hypotheses were not produced by a model looking at the files.</Notice>
        <p>The illustrative session is not open from this page. A local operator issues one seat at a time. One response never contains both seats, and the server secret is not part of this page.</p>
        <ol className="stack">
          <li>In the server environment, set <code>ALLOW_DEMO_OPERATOR=1</code> and <code>DEMO_OPERATOR_SECRET</code> to a private value of at least 24 characters. Leave both unset on a shared server. <code>VERCEL_ENV=production</code> or <code>preview</code> disables the route even if those values are present.</li>
          <li>Restart the local server so it reads the environment.</li>
          <li>Request one seat. Replace the secret in your shell, not in this page: <code>curl -sS -X POST http://127.0.0.1:3010/api/demo/enter -H &quot;content-type: application/json&quot; -H &quot;x-demo-operator: $DEMO_OPERATOR_SECRET&quot; -d &apos;{`{"role":"A"}`}&apos;</code></li>
          <li>Paste that JSON below and open the seat. A second browser needs a second request with <code>{`{"role":"B"}`}</code>.</li>
        </ol>
        <p className="small">Reset is also operator-only: <code>curl -sS -X POST http://127.0.0.1:3010/api/demo/reset -H &quot;x-demo-operator: $DEMO_OPERATOR_SECRET&quot;</code>. It rewrites the illustrative session only. Sessions you created stay in the database. An ordinary restart does not reset anything.</p>
        <Field label="One-seat credential">
          <textarea className="control" value={credential} onChange={(event) => setCredential(event.target.value)} rows={5} maxLength={4000} />
        </Field>
        <button className="btn btn-primary" type="button" onClick={openSeat}>Open this seat</button>
        {message ? <Notice>{message}</Notice> : null}
        <p className="small muted">Session code SHORE-1001. The credential expires. It is not the stored recovery key, and it is not listed to other visitors.</p>
      </main>
    </>
  );
}
