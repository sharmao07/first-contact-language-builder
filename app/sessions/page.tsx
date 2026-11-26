"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, FolderOpen } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/layout/site";
import { EmptyState, Notice, PageHeader } from "@/components/ui/bits";
import { api } from "@/lib/client/api";

type Row = {
  code: string;
  name: string;
  description: string;
  isIllustrative: boolean;
  updatedAt: string;
  participants: Array<{ displayName: string; role: string }>;
  concepts: number;
  verified: number;
  pending: number;
};

export default function SessionsPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ sessions: Row[] }>("/api/sessions")
      .then((data) => setRows(data.sessions))
      .catch(() => setError("The local session list could not be loaded."));
  }, []);

  return (
    <>
      <SiteHeader />
      <main id="content" className="wrap page-pad stack-lg">
        <PageHeader
          eyebrow="Local directory"
          title="Sessions on this computer"
          description="Session codes are not listed publicly here. Join with the code you were given. A code opens a seat; it does not by itself expose another session's record."
          actions={<Link className="btn btn-primary" href="/start">Start or join</Link>}
        />

        {error ? (
          <Notice>
            Join from the start page with a session code. The directory is not available without a seat.
          </Notice>
        ) : null}

        {!rows && !error ? (
          <div className="grid-2">
            <div className="surface stack-sm"><div className="skeleton" /><div className="skeleton" style={{ width: "60%" }} /></div>
            <div className="surface stack-sm"><div className="skeleton" /><div className="skeleton" style={{ width: "55%" }} /></div>
          </div>
        ) : null}

        {rows && rows.length > 0 ? (
          <div className="grid-2">
            {rows.map((session) => (
              <article key={session.code} className="list-card stack">
                <div className="row-between">
                  <div className="stack-xs">
                    <h2>{session.name}</h2>
                    <p className="mono small" style={{ color: "var(--oxide)" }}>{session.code}</p>
                  </div>
                  {session.isIllustrative ? <span className="status-pill">Illustrative sample</span> : null}
                </div>
                <p className="small">
                  {session.participants.map((person) => `${person.displayName} (${person.role})`).join(", ") || "No seats yet"}
                </p>
                <div className="row-between" style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                  <span className="mono small muted">
                    {session.verified} verified · {session.pending} open · {session.concepts} concepts
                  </span>
                  <Link className="btn btn-sm" href={`/session/${session.code}`}>
                    Open
                    <ArrowRight size={14} strokeWidth={1.5} aria-hidden="true" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {rows && rows.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="No sessions yet"
            description="Create a two-seat session or join with a code from the other participant."
            action={<Link className="btn btn-primary" href="/start">Start a session</Link>}
          />
        ) : null}
      </main>
      <SiteFooter />
    </>
  );
}
