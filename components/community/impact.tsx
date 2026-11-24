"use client";

import { useEffect, useState } from "react";
import { useSessionContext } from "@/components/session/provider";
import { api } from "@/lib/client/api";

type Summary = {
  sample: boolean;
  simulated: boolean;
  note: string;
  tasksAttempted: number;
  sessionVerified: number;
  unresolved: number;
  independentResponses: number;
  experiments: number;
  misunderstandingsCorrected: number;
  repeatedAttempts: number;
  minutesToFirstAgreement: number | null;
};

const rows: Array<[keyof Summary, string]> = [
  ["tasksAttempted", "Communication tasks attempted"],
  ["sessionVerified", "Session-verified concepts"],
  ["unresolved", "Unresolved concepts"],
  ["independentResponses", "Independent responses locked"],
  ["experiments", "Checks recorded"],
  ["misunderstandingsCorrected", "Disagreements or reopenings recorded"],
  ["repeatedAttempts", "Repeated attempts"],
];

export function ImpactReport() {
  const { code, identity } = useSessionContext();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!identity) return;
    let cancelled = false;
    void api<Summary>(`/api/sessions/${code}/impact`, { token: identity.token, method: "GET" })
      .then((result) => { if (!cancelled) setSummary(result); })
      .catch(() => { if (!cancelled) setError("The session record could not be counted."); });
    return () => { cancelled = true; };
  }, [code, identity]);

  async function download() {
    if (!identity) return;
    const response = await fetch(`/api/sessions/${code}/impact?format=md`, { headers: { "x-participant-token": identity.token } });
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${code}-impact.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="wrap section stack">
      <h1>Community record</h1>
      <p>Counts below come from this session. A prototype does not show that inequality has been reduced.</p>
      {error ? <p>{error}</p> : null}
      {summary ? (
        <>
          <p>{summary.note}</p>
          <p className="small">{summary.sample ? "Sample session." : "Recorded session."} {summary.simulated ? "Simulated." : "Not a simulation."}</p>
          <dl className="stack-sm">
            {rows.map(([key, label]) => (
              <div key={key} className="row" style={{ justifyContent: "space-between" }}>
                <dt>{label}</dt>
                <dd className="mono">{String(summary[key])}</dd>
              </div>
            ))}
            <div className="row" style={{ justifyContent: "space-between" }}>
              <dt>Time to first session-verified concept</dt>
              <dd className="mono">{summary.minutesToFirstAgreement === null ? "None yet" : `${summary.minutesToFirstAgreement} min`}</dd>
            </div>
          </dl>
          <button type="button" className="btn btn-primary" onClick={download}>Download this record</button>
        </>
      ) : null}
    </div>
  );
}
