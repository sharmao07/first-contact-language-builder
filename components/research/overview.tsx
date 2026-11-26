"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Download } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/layout/site";
import { Notice, PageHeader, StatCard, StatusText } from "@/components/ui/bits";
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
      <main id="content" className="wrap page-pad stack-lg">
        <PageHeader
          eyebrow="Facilitator corpus & export"
          title={code ? `Research for ${code}` : "Research dashboard"}
          description={data?.localNote ?? "Counts come from the local database."}
          actions={
            code ? (
              <Link className="btn btn-sm" href={`/session/${code}`}>
                <ArrowLeft size={14} strokeWidth={1.5} aria-hidden="true" />
                Back to {code}
              </Link>
            ) : null
          }
        />

        {error ? <Notice>{error}</Notice> : null}

        {!data && !error ? (
          <div className="grid-3">
            <div className="surface stack-sm"><div className="skeleton" /><div className="skeleton" style={{ width: "45%" }} /></div>
            <div className="surface stack-sm"><div className="skeleton" /><div className="skeleton" style={{ width: "45%" }} /></div>
            <div className="surface stack-sm"><div className="skeleton" /><div className="skeleton" style={{ width: "45%" }} /></div>
          </div>
        ) : null}

        {data ? (
          <>
            <div className="grid-3">
              <StatCard label="Sessions" value={data.totals.sessions} detail={`${data.totals.illustrativeSessions} illustrative`} />
              <StatCard label="Concepts" value={data.totals.concepts} detail={`${data.totals.verified} session-verified, ${data.totals.disputed} disputed, ${data.totals.reopened} reopened`} />
              <StatCard label="Open hypotheses" value={data.totals.pendingHypotheses} detail={`${data.totals.tentative} tentative, ${data.totals.awaiting} awaiting`} />
              <StatCard label="Evidence" value={data.totals.evidence} detail="Files and notes stored locally" />
              <StatCard label="Checks" value={data.totals.checks} detail={`${data.totals.correct} marked as matching`} />
              <StatCard
                label="Match share"
                value={data.totals.verificationShare === null ? "No checks" : `${Math.round(data.totals.verificationShare * 100)}%`}
                detail="Share of recorded checks marked correct. Not a scientific success rate."
              />
            </div>

            <section className="surface stack-sm">
              <h2>Export local records</h2>
              <div className="row">
                <ExportLink code={code} format="json" label="Export JSON" />
                <ExportLink code={code} format="md" label="Research report" />
                <ExportLink code={code} format="csv" dataset="concepts" label="Concepts CSV" />
                <ExportLink code={code} format="csv" dataset="hypotheses" label="Hypotheses CSV" />
                <ExportLink code={code} format="csv" dataset="evidence" label="Evidence CSV" />
                <ExportLink code={code} format="csv" dataset="checks" label="Checks CSV" />
                <ExportLink code={code} format="csv" dataset="relationships" label="Relationships CSV" />
              </div>
            </section>

            <div className="grid-2">
              <section className="surface stack">
                <h2>Sessions</h2>
                {data.sessions.map((session) => (
                  <article key={session.code} className="surface-recessed stack-xs" style={{ padding: 14 }}>
                    <div className="row-between">
                      <h3>{session.name}</h3>
                      <span className="mono small" style={{ color: "var(--oxide)" }}>{session.code}</span>
                    </div>
                    {session.isIllustrative ? <p className="small muted">Illustrative sample, not fieldwork.</p> : null}
                    <p className="small">
                      {session.counts.concepts} concepts, {session.counts.verified} verified, {session.counts.disputed} disputed, {session.counts.evidence} evidence items.
                    </p>
                    <div>
                      <Link className="btn btn-sm" href={`/research/${session.code}`}>Session research</Link>
                    </div>
                  </article>
                ))}
              </section>

              <section className="surface stack">
                <h2>Concepts</h2>
                <div className="stack-xs">
                  {data.concepts.map((concept) => (
                    <div key={concept.id} className="row-between surface-recessed" style={{ padding: "8px 12px" }}>
                      <Link className="small" href={`/session/${concept.sessionCode}/concept/${concept.id}`}>
                        <span className="mono muted">{concept.conceptCode}</span> {concept.agreedMeaning || "Unnamed"}
                      </Link>
                      <StatusText status={concept.status} reason={concept.statusReason} />
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <section className="stack">
              <h2>Contributions</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Person</th><th>Session</th><th>Evidence</th><th>Checks</th><th>Notes</th><th>Proposals</th></tr>
                  </thead>
                  <tbody>
                    {data.contributions.map((row) => (
                      <tr key={`${row.sessionCode}-${row.displayName}-${row.role}`}>
                        <td>{row.displayName} ({row.role})</td>
                        <td className="mono">{row.sessionCode}</td>
                        <td className="mono">{row.evidence}</td>
                        <td className="mono">{row.checks}</td>
                        <td className="mono">{row.notes}</td>
                        <td className="mono">{row.proposals}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="surface stack">
              <h2>Timeline</h2>
              <ol className="timeline">
                {data.timeline.map((event) => (
                  <li key={event.id}>
                    <strong className="small" style={{ color: "var(--ink)" }}>{event.message}</strong>
                    <span>{new Date(event.createdAt).toLocaleString()} · {event.sessionCode}{event.actor ? ` · ${event.actor}` : ""}</span>
                  </li>
                ))}
              </ol>
            </section>
          </>
        ) : null}
      </main>
      <SiteFooter />
    </>
  );
}

function ExportLink({ code, format, dataset, label }: { code?: string; format: string; dataset?: string; label: string }) {
  const query = new URLSearchParams({ format });
  if (dataset) query.set("dataset", dataset);
  if (code) query.set("code", code);
  return (
    <a
      className="btn btn-sm"
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
      <Download size={13} strokeWidth={1.5} aria-hidden="true" />
      {label}
    </a>
  );
}
