"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { useSessionContext } from "@/components/session/provider";
import { Notice, PageHeader, StatCard } from "@/components/ui/bits";
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
    <div className="wrap page-pad stack-lg">
      <PageHeader
        eyebrow="Session metrics"
        title="Community record"
        description="Counts below come from this session. A prototype does not show that inequality has been reduced."
        actions={
          summary ? (
            <button type="button" className="btn btn-primary" onClick={download}>
              <Download size={15} strokeWidth={1.5} aria-hidden="true" />
              Download this record
            </button>
          ) : null
        }
      />

      {error ? <Notice tone="error">{error}</Notice> : null}

      {summary ? (
        <>
          <Notice>
            {summary.note} ({summary.sample ? "Sample session." : "Recorded session."} {summary.simulated ? "Simulated." : "Not a simulation."})
          </Notice>

          <div className="grid-4">
            {rows.map(([key, label]) => (
              <StatCard key={key} label={label} value={String(summary[key])} />
            ))}
            <StatCard
              label="Time to first session-verified concept"
              value={summary.minutesToFirstAgreement === null ? "None yet" : `${summary.minutesToFirstAgreement} min`}
            />
          </div>
        </>
      ) : !error ? (
        <div className="grid-4">
          <div className="surface stack-sm"><div className="skeleton" /><div className="skeleton" style={{ width: "40%" }} /></div>
          <div className="surface stack-sm"><div className="skeleton" /><div className="skeleton" style={{ width: "40%" }} /></div>
          <div className="surface stack-sm"><div className="skeleton" /><div className="skeleton" style={{ width: "40%" }} /></div>
          <div className="surface stack-sm"><div className="skeleton" /><div className="skeleton" style={{ width: "40%" }} /></div>
        </div>
      ) : null}
    </div>
  );
}
