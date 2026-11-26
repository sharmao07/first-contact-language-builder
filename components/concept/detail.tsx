"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useSessionContext } from "@/components/session/provider";
import { Field, Notice, PageHeader, StatusText } from "@/components/ui/bits";
import { EvidenceImage } from "@/components/ui/media";
import { api } from "@/lib/client/api";
import { EXPERIMENT_LABEL } from "@/lib/constants";

export function ConceptDetail({ id }: { id: string }) {
  const { state, identity, code, reload } = useSessionContext();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  if (!state || !identity) return null;
  const concept = state.concepts.find((item) => item.id === id);
  if (!concept) {
    return (
      <div className="wrap page-pad">
        <div className="surface stack">
          <p>That concept is not in this session.</p>
          <div>
            <Link className="btn btn-sm" href={`/session/${code}`}>Back to discovery</Link>
          </div>
        </div>
      </div>
    );
  }
  const evidence = state.evidence.filter((item) => item.conceptId === concept.id);
  const hypotheses = state.hypotheses.filter((item) => item.conceptId === concept.id);
  const experiments = state.experiments.filter((item) => item.conceptId === concept.id);
  const notes = state.notes.filter((item) => item.conceptId === concept.id);
  const events = state.events.filter((event) => JSON.stringify(event.payload).includes(concept.id) || event.message.includes(concept.conceptCode));

  return (
    <div className="wrap page-pad stack-lg">
      <PageHeader
        eyebrow={`Concept dossier · ${concept.conceptCode}`}
        title={concept.agreedMeaning || "Unnamed concept"}
        description={concept.statusReason}
        actions={
          <div className="row">
            <StatusText status={concept.status} reason={concept.statusReason} pill />
            <Link className="btn btn-sm" href={`/session/${code}`}>
              <ArrowLeft size={14} strokeWidth={1.5} aria-hidden="true" />
              Back to discovery
            </Link>
          </div>
        }
      />

      <div className="split-aside">
        <div className="stack-lg">
          <section className="surface stack">
            <div className="row-between">
              <h2>Evidence</h2>
              <span className="mono small muted">{evidence.length} items</span>
            </div>
            {evidence.map((item) => (
              <article key={item.id} className="surface-recessed stack-sm" style={{ padding: 14 }}>
                <div className="row-between">
                  <span className="status-pill">{item.type}</span>
                  <span className="small muted">{item.participantName}</span>
                </div>
                <p>{item.description}</p>
                {item.notes ? <p className="small muted">{item.notes}</p> : null}
                {item.mediaUrl && item.mimeType?.startsWith("image/") ? <EvidenceImage alt={item.description || "Evidence"} src={item.mediaUrl} /> : null}
                {item.mediaUrl && item.mimeType?.startsWith("audio/") ? <audio controls src={item.mediaUrl} style={{ width: "100%" }} /> : null}
                {item.mediaUrl && item.mimeType?.startsWith("video/") ? <video className="thumb" controls src={item.mediaUrl} /> : null}
              </article>
            ))}
            {!evidence.length ? <p className="small muted">No linked evidence.</p> : null}
          </section>

          <section className="surface stack">
            <div className="row-between">
              <h2>Hypotheses</h2>
              <span className="mono small muted">{hypotheses.length}</span>
            </div>
            {hypotheses.map((item) => (
              <article key={item.id} className="surface-recessed stack-xs" style={{ padding: 14 }}>
                <div className="row-between">
                  <span className="small muted">{item.source === "ai" ? "AI hypothesis" : "Participant interpretation"}</span>
                  <StatusText status={item.status} />
                </div>
                <p style={{ fontWeight: 500 }}>{item.proposedMeaning}</p>
                <p className="small">{item.explanation}</p>
                {item.simulated ? <p className="small muted">{item.providerNote}</p> : null}
              </article>
            ))}
          </section>

          <section className="surface stack">
            <div className="row-between">
              <h2>Verification history</h2>
              <span className="mono small muted">{experiments.length} checks</span>
            </div>
            {experiments.map((experiment) => (
              <article key={experiment.id} className="surface-recessed stack-xs" style={{ padding: 14 }}>
                <p className="small muted">{EXPERIMENT_LABEL[experiment.type] ?? experiment.type} · round {experiment.round}</p>
                <p style={{ fontWeight: 500 }}>{experiment.prompt}</p>
                {experiment.responses.map((response) => (
                  <p key={response.id} className="small">
                    <strong>{response.participantName}:</strong> {response.result}. {response.notes}
                  </p>
                ))}
              </article>
            ))}
            {!experiments.length ? <p className="small muted">No checks yet.</p> : null}
          </section>

          <section className="surface stack">
            <h2>Research notes</h2>
            {notes.map((note) => (
              <article key={note.id} className="surface-recessed stack-xs" style={{ padding: 14 }}>
                <div className="row-between">
                  <h3>{note.title}</h3>
                  <span className="small muted">{note.authorName}</span>
                </div>
                <p className="small" style={{ color: "var(--ink)" }}>{note.body}</p>
              </article>
            ))}
            <form
              className="stack block"
              onSubmit={async (event) => {
                event.preventDefault();
                await api(`/api/sessions/${code}/notes`, { token: identity.token, body: { title, body, conceptId: concept.id } });
                setTitle("");
                setBody("");
                setMessage("Note saved.");
                reload();
              }}
            >
              <Field label="Note title"><input className="control" value={title} onChange={(event) => setTitle(event.target.value)} required /></Field>
              <Field label="Note"><textarea className="textarea" value={body} onChange={(event) => setBody(event.target.value)} required /></Field>
              <div>
                <button className="btn btn-primary" type="submit">Add note</button>
              </div>
            </form>
            {message ? <Notice tone="success">{message}</Notice> : null}
          </section>
        </div>

        <aside className="stack">
          <div className="surface stack-sm">
            <h3>Concept record</h3>
            <p className="small muted">
              Created {new Date(concept.createdAt).toLocaleString()}. Updated {new Date(concept.updatedAt).toLocaleString()}.
            </p>
            {concept.aiConfidence !== null ? (
              <p className="small">AI-estimated confidence on record: <span className="mono">{concept.aiConfidence.toFixed(2)}</span>. Not a measured probability.</p>
            ) : null}
            <div className="stack-xs block">
              <p className="small"><strong>Notes:</strong> {concept.contextualNotes || "None."}</p>
              <p className="small"><strong>Examples:</strong> {concept.exampleSituations || "None."}</p>
              <p className="small"><strong>Alternatives:</strong> {concept.alternativeInterpretations || "None."}</p>
            </div>
          </div>

          <div className="surface stack-sm">
            <h3>Session events</h3>
            {events.length ? events.map((event) => (
              <p key={event.id} className="small muted">
                <span className="mono">{new Date(event.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span> · {event.message}
              </p>
            )) : <p className="small muted">No events mention this concept yet.</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}
