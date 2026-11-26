"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/layout/site";
import { StatusText } from "@/components/ui/bits";
import { readIdentity } from "@/lib/client/identity";

type Snapshot = {
  localNote: string;
  totals: {
    sessions: number;
    illustrativeSessions: number;
    concepts: number;
    verified: number;
    disputed: number;
    tentative: number;
    awaiting: number;
    reopened: number;
    pendingHypotheses: number;
    evidence: number;
    checks: number;
    correct: number;
    verificationShare: number | null;
  };
  sessions: Array<{ code: string; name: string; description: string; isIllustrative: boolean; counts: { concepts: number; verified: number; disputed: number; evidence: number } }>;
  concepts: Array<{ id: string; sessionCode: string; conceptCode: string; agreedMeaning: string; status: string; statusReason?: string; category: string; updatedAt: string }>;
  timeline: Array<{ id: string; sessionCode: string; message: string; actor: string | null; createdAt: string }>;
  contributions: Array<{ sessionCode: string; displayName: string; role: string; evidence: number; checks: number; notes: number; proposals: number }>;
};

export function ResearchView({ code }: { code?: string }) {
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const query = code ? `?code=${code}` : "";

  useEffect(() => {
    if (!code) {
      setError("Open a session you facilitate, then use its research page. Exports are not available for every session.");
      return;
    }
    const token = readIdentity(code)?.token;
    if (!token) {
      setError("Join that session as the facilitator before opening the research record.");
      return;
    }
    fetch(`/api/research${query}`, { headers: { "x-participant-token": token } })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Could not load research.");
        setData(body);
      })
      .catch((caught: Error) => setError(caught.message));
  }, [code, query]);

  return (
    <>
      <SiteHeader />
      <main id="content" className="wrap section stack">
        <h1>{code ? `Research for ${code}` : "Research dashboard"}</h1>
        <p>{data?.localNote ?? "Counts come from the local database."}</p>
        {error ? <p>{error}</p> : null}
        {!data && !error ? <div className="skeleton" /> : null}
        {data ? (
          <>
            <div className="grid-3">
              <Stat label="Sessions" value={`${data.totals.sessions}`} detail={`${data.totals.illustrativeSessions} illustrative`} />
              <Stat label="Concepts" value={`${data.totals.concepts}`} detail={`${data.totals.verified} session-verified, ${data.totals.disputed} disputed, ${data.totals.reopened} reopened`} />
              <Stat label="Open hypotheses" value={`${data.totals.pendingHypotheses}`} detail={`${data.totals.tentative} tentative, ${data.totals.awaiting} awaiting`} />
              <Stat label="Evidence" value={`${data.totals.evidence}`} detail="Files and notes stored locally" />
              <Stat label="Checks" value={`${data.totals.checks}`} detail={`${data.totals.correct} marked as matching`} />
              <Stat label="Match share" value={data.totals.verificationShare === null ? "No checks" : `${Math.round(data.totals.verificationShare * 100)}%`} detail="Share of recorded checks marked correct. Not a scientific success rate." />
            </div>
            <div className="row">
              <ExportLink code={code} format="json" label="Export JSON" />
              <ExportLink code={code} format="csv" dataset="concepts" label="Concepts CSV" />
              <ExportLink code={code} format="csv" dataset="hypotheses" label="Hypotheses CSV" />
              <ExportLink code={code} format="csv" dataset="evidence" label="Evidence CSV" />
              <ExportLink code={code} format="csv" dataset="checks" label="Checks CSV" />
              <ExportLink code={code} format="csv" dataset="relationships" label="Relationships CSV" />
              <ExportLink code={code} format="md" label="Research report" />
            </div>
            <h2>Sessions</h2>
            {data.sessions.map((session) => (
              <article key={session.code} className="block stack-sm">
                <h3>{session.name}</h3>
                <p className="mono small">{session.code}</p>
                {session.isIllustrative ? <p className="small">Illustrative sample, not fieldwork.</p> : null}
                <p className="small">{session.counts.concepts} concepts, {session.counts.verified} verified, {session.counts.disputed} disputed, {session.counts.evidence} evidence items.</p>
                <Link href={`/research/${session.code}`}>Session research</Link>
              </article>
            ))}
            <h2>Concepts</h2>
            <div className="stack">
              {data.concepts.map((concept) => (
                <p key={concept.id} className="small">
                  <Link href={`/session/${concept.sessionCode}/concept/${concept.id}`}>{concept.conceptCode} {concept.agreedMeaning || "Unnamed"}</Link>
                  {" "}
                  <StatusText status={concept.status} reason={concept.statusReason} />
                </p>
              ))}
            </div>
            <h2>Timeline</h2>
            {data.timeline.map((event) => (
              <p key={event.id} className="small">{new Date(event.createdAt).toLocaleString()} · {event.sessionCode} · {event.actor ? `${event.actor}: ` : ""}{event.message}</p>
            ))}
            <h2>Contributions</h2>
            <table>
              <thead>
                <tr><th>Person</th><th>Session</th><th>Evidence</th><th>Checks</th><th>Notes</th><th>Proposals</th></tr>
              </thead>
              <tbody>
                {data.contributions.map((row) => (
                  <tr key={`${row.sessionCode}-${row.displayName}-${row.role}`}>
                    <td>{row.displayName} ({row.role})</td>
                    <td className="mono">{row.sessionCode}</td>
                    <td>{row.evidence}</td>
                    <td>{row.checks}</td>
                    <td>{row.notes}</td>
                    <td>{row.proposals}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : null}
      </main>
    </>
  );
}

function ExportLink({ code, format, dataset, label }: { code?: string; format: string; dataset?: string; label: string }) {
  const query = new URLSearchParams({ format });
  if (dataset) query.set("dataset", dataset);
  if (code) query.set("code", code);
  return (
    <a
      className="btn"
      href={`/api/research/export?${query.toString()}`}
      onClick={(event) => {
        const token = code ? readIdentity(code)?.token : null;
        if (!token) return;
        event.preventDefault();
        void fetch(`/api/research/export?${query.toString()}`, { headers: { "x-participant-token": token } })
          .then(async (response) => {
            if (!response.ok) return;
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = response.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "first-contact-export";
            link.click();
            URL.revokeObjectURL(url);
          });
      }}
    >
      {label}
    </a>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rule stack-sm">
      <p className="small">{label}</p>
      <p style={{ fontFamily: "var(--font-display)", fontSize: "1.8rem" }}>{value}</p>
      <p className="small muted">{detail}</p>
    </div>
  );
}
