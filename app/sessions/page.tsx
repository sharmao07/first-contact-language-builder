"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/layout/site";
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
      <main id="content" className="wrap section stack">
        <h1>Sessions on this computer</h1>
        <p className="muted">Session codes are not listed here. Join with the code you were given. A code opens a seat. It does not by itself show the record.</p>
        {error ? <p>Join from the start page with a session code. The directory is not available without a seat.</p> : null}
        {!rows && !error ? <div className="skeleton" /> : null}
        <div className="stack">
          {rows?.map((session) => (
            <article key={session.code} className="list-card stack-sm">
              <h2>{session.name}</h2>
              <p className="mono">{session.code}</p>
              <p className="small">{session.participants.map((person) => `${person.displayName} (${person.role})`).join(", ") || "No seats yet"}</p>
              <p className="small">{session.verified} verified, {session.pending} not verified, {session.concepts} concepts</p>
              {session.isIllustrative ? <p className="small">Illustrative sample</p> : null}
              <Link href={`/session/${session.code}`}>Open</Link>
            </article>
          ))}
        </div>
        {rows && rows.length === 0 ? <p>No sessions yet.</p> : null}
      </main>
    </>
  );
}
