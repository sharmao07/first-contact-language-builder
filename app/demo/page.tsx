"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SiteHeader } from "@/components/layout/site";
import { Notice } from "@/components/ui/bits";
import { api, ApiError } from "@/lib/client/api";
import { writeIdentity } from "@/lib/client/identity";

export default function DemoPage() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function enter(role: "A" | "B") {
    setPending(true);
    setMessage(null);
    try {
      const result = await api<{ code: string; token: string; participantId: string; role: string; displayName: string }>("/api/demo/enter", {
        body: { role },
      });
      writeIdentity(result);
      router.push(`/session/${result.code}`);
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : "The demo could not be opened.");
      setPending(false);
    }
  }

  async function reset() {
    setPending(true);
    setMessage(null);
    try {
      await api("/api/demo/reset", { body: {} });
      setMessage("The illustrative session was reset. Enter a seat to view it.");
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : "Reset failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <SiteHeader />
      <main id="content" className="wrap section stack">
        <h1>Explore the illustrative session</h1>
        <Notice>Demo mode. This session is invented sample data, not fieldwork. Its hypotheses were not produced by a model looking at the files.</Notice>
        <p>First Contact Experiment 001 already contains a glass, a drinking mime, a disputed movement gesture, verified entries, and an expression trial. Open it as either seat. Two browsers can enter the two seats at the same time.</p>
        <div className="row">
          <button className="btn btn-primary" type="button" disabled={pending} onClick={() => void enter("A")}>Enter as Researcher A</button>
          <button className="btn" type="button" disabled={pending} onClick={() => void enter("B")}>Enter as Participant B</button>
          <button className="btn" type="button" disabled={pending} onClick={() => void reset()}>Reset illustrative data</button>
        </div>
        {message ? <Notice>{message}</Notice> : null}
        <p className="small muted">Session code SHORE-1001. Resetting replaces the sample only. Sessions you created yourself stay in the database.</p>
      </main>
    </>
  );
}
