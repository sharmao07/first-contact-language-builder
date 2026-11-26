"use client";

import Link from "next/link";
import { useState } from "react";
import { PenLine } from "lucide-react";
import { useSessionContext } from "@/components/session/provider";
import { EmptyState, Field, Notice, PageHeader } from "@/components/ui/bits";
import { api, ApiError } from "@/lib/client/api";
import { ACTIVITY_LABEL, ACTIVITY_TYPES } from "@/lib/constants";

export function Practice() {
  const { state, identity, code, reload } = useSessionContext();
  const [message, setMessage] = useState<string | null>(null);
  if (!state || !identity) return null;
  const token = identity.token;
  const responses = state.activities.flatMap((activity) => activity.responses.map((response) => ({ ...response, type: activity.type, conceptId: activity.conceptId })));

  async function generate(type?: string) {
    setMessage(null);
    try {
      const result = await api<{ activityIds: string[] }>(`/api/sessions/${code}/activities`, {
        token,
        body: type ? { type } : {},
      });
      setMessage(`Added ${result.activityIds.length} activities from current entries.`);
      reload();
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : "No practice could be generated.");
    }
  }

  return (
    <div className="wrap page-pad stack-lg">
      <PageHeader
        eyebrow="Solo recall & ambiguity check"
        title="Practice"
        description="Activities are built only from meanings this session has verified. Practice here is solo: your own match stays with you, and the other person does not receive whether your answer matched. A miss is kept as evidence of ambiguity, with a clarification, rather than treated as a failed grade."
      />

      {repeatedMisses(responses).map((item) => (
        <Notice key={item.conceptId} tone="warning">
          The same concept has been missed {item.count} times. That pattern is a reason to reopen the meaning, not to mark the person wrong.
        </Notice>
      ))}

      <div className="surface stack-sm">
        <div className="row">
          <button type="button" className="btn btn-primary" onClick={() => void generate()}>
            Practice from current vocabulary
          </button>
          {ACTIVITY_TYPES.map((type) => (
            <button key={type} type="button" className="btn btn-sm" onClick={() => void generate(type)}>
              {ACTIVITY_LABEL[type]}
            </button>
          ))}
        </div>
        {message ? <Notice>{message}</Notice> : null}
      </div>

      {state.activities.length === 0 ? (
        <EmptyState
          icon={PenLine}
          title="No practice activities yet"
          description="Generate solo activities from your session-verified vocabulary above."
        />
      ) : (
        <div className="grid-2">
          {state.activities.map((activity) => (
            <article key={activity.id} className="list-card stack">
              <div className="row-between">
                <span className="status-pill">{ACTIVITY_LABEL[activity.type] ?? activity.type}</span>
                {activity.conceptId ? <Link className="small" href={`/session/${code}/concept/${activity.conceptId}`}>Revise this concept</Link> : null}
              </div>
              <p style={{ fontWeight: 500 }}>{activity.prompt}</p>
              <AnswerForm activityId={activity.id} options={activity.options} keyed={Boolean(activity.answerKey)} onDone={reload} />
              {activity.responses.map((response) => (
                <div key={response.id} className="surface-recessed stack-xs" style={{ padding: 10 }}>
                  <p className="small" style={{ color: "var(--ink)" }}>
                    <strong>{response.participantName}:</strong> {response.correct === null ? "No automatic judgment" : response.correct ? "Matched the current entry" : "Did not match the current entry"}
                  </p>
                  {response.clarification ? <p className="small muted">{response.clarification}</p> : null}
                </div>
              ))}
            </article>
          ))}
        </div>
      )}

      <section className="stack">
        <h2>Progress</h2>
        {responses.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>When</th><th>Activity</th><th>Person</th><th>Record</th></tr>
              </thead>
              <tbody>
                {responses.map((response) => (
                  <tr key={response.id}>
                    <td className="mono small">{new Date(response.createdAt).toLocaleString()}</td>
                    <td>{ACTIVITY_LABEL[response.type] ?? response.type}</td>
                    <td>{response.participantName}</td>
                    <td>{response.correct === null ? "Unjudged" : response.correct ? "Matched" : "Clarification"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="small muted">No practice answers yet.</p>}
      </section>
    </div>
  );
}

function AnswerForm({
  activityId,
  options,
  keyed,
  onDone,
}: {
  activityId: string;
  options: Array<{ id: string; label: string }>;
  keyed: boolean;
  onDone: () => void;
}) {
  const { code, identity } = useSessionContext();
  const [selected, setSelected] = useState(options[0]?.id ?? "");
  const [assessment, setAssessment] = useState<"matched" | "unsure" | "different">("unsure");
  const [notes, setNotes] = useState("");
  const [clarification, setClarification] = useState<string | null>(null);
  if (!identity) return null;
  return (
    <form
      className="stack-sm"
      onSubmit={async (event) => {
        event.preventDefault();
        const result = await api<{ clarification: string; correct: boolean | null }>(`/api/sessions/${code}/activities/${activityId}/respond`, {
          token: identity.token,
          body: keyed ? { selectedOptionId: selected, notes } : { selfAssessment: assessment, notes },
        });
        setClarification(result.clarification);
        onDone();
      }}
    >
      {keyed ? (
        <div className="stack-xs" role="radiogroup" aria-label="Your choice">
          {options.map((option) => (
            <button key={option.id} type="button" className={selected === option.id ? "btn btn-sm is-selected" : "btn btn-sm"} style={{ justifyContent: "flex-start" }} aria-pressed={selected === option.id} onClick={() => setSelected(option.id)}>
              {option.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="row" role="radiogroup" aria-label="Your own assessment">
          {([
            ["matched", "It matched the recorded entry"],
            ["unsure", "Unsure"],
            ["different", "It came out different"],
          ] as const).map(([value, label]) => (
            <button key={value} type="button" className={assessment === value ? "btn btn-sm is-selected" : "btn btn-sm"} aria-pressed={assessment === value} onClick={() => setAssessment(value)}>
              {label}
            </button>
          ))}
        </div>
      )}
      <Field label="Note"><input className="control" value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
      <div>
        <button className="btn btn-sm btn-primary" type="submit">Record answer</button>
      </div>
      {clarification ? <Notice>{clarification}</Notice> : null}
    </form>
  );
}

function repeatedMisses(responses: Array<{ conceptId: string | null; correct: boolean | null }>) {
  const counts = new Map<string, number>();
  for (const response of responses) {
    if (response.correct === false && response.conceptId) {
      counts.set(response.conceptId, (counts.get(response.conceptId) ?? 0) + 1);
    }
  }
  return [...counts.entries()].filter(([, count]) => count >= 2).map(([conceptId, count]) => ({ conceptId, count }));
}
