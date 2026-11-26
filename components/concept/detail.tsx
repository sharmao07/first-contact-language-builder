"use client";

import Link from "next/link";
import { useState } from "react";
import { useSessionContext } from "@/components/session/provider";
import { Field, Notice, StatusText } from "@/components/ui/bits";
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
  if (!concept) return <div className="wrap section"><p>That concept is not in this session.</p></div>;
  const evidence = state.evidence.filter((item) => item.conceptId === concept.id);
  const hypotheses = state.hypotheses.filter((item) => item.conceptId === concept.id);
  const experiments = state.experiments.filter((item) => item.conceptId === concept.id);
  const notes = state.notes.filter((item) => item.conceptId === concept.id);
  const events = state.events.filter((event) => JSON.stringify(event.payload).includes(concept.id) || event.message.includes(concept.conceptCode));

  return (
    <div className="wrap section stack">
      <p className="mono small">{concept.conceptCode}</p>
      <h1>{concept.agreedMeaning || "Unnamed concept"}</h1>
      <StatusText status={concept.status} reason={concept.statusReason} />
      <p>{concept.statusReason}</p>
      <p className="small">Created {new Date(concept.createdAt).toLocaleString()}. Updated {new Date(concept.updatedAt).toLocaleString()}.</p>
      {concept.aiConfidence !== null ? <p className="small">AI-estimated confidence on record: {concept.aiConfidence.toFixed(2)}. Not a measured probability.</p> : null}
      <p>Notes: {concept.contextualNotes || "None."}</p>
      <p>Examples: {concept.exampleSituations || "None."}</p>
      <p>Alternatives: {concept.alternativeInterpretations || "None."}</p>
      <h2>Evidence</h2>
      {evidence.map((item) => (
        <article key={item.id} className="block stack-sm">
          <p className="small">{item.type} · {item.participantName}</p>
          <p>{item.description}</p>
          {item.notes ? <p className="small">{item.notes}</p> : null}
          {item.mediaUrl && item.mimeType?.startsWith("image/") ? <EvidenceImage alt={item.description || "Evidence"} src={item.mediaUrl} /> : null}
          {item.mediaUrl && item.mimeType?.startsWith("audio/") ? <audio controls src={item.mediaUrl} /> : null}
          {item.mediaUrl && item.mimeType?.startsWith("video/") ? <video className="thumb" controls src={item.mediaUrl} /> : null}
          {item.mediaUrl && item.mimeType?.startsWith("audio/") ? <audio controls src={item.mediaUrl} /> : null}
        </article>
      ))}
      {!evidence.length ? <p>No linked evidence.</p> : null}
      <h2>Hypotheses</h2>
      {hypotheses.map((item) => (
        <article key={item.id} className="block stack-sm">
          <p className="small">{item.source === "ai" ? "AI hypothesis" : "Participant interpretation"} · <StatusText status={item.status} /></p>
          <p>{item.proposedMeaning}</p>
          <p className="small">{item.explanation}</p>
          {item.simulated ? <p className="small muted">{item.providerNote}</p> : null}
        </article>
      ))}
      <h2>Verification history</h2>
      {experiments.map((experiment) => (
        <article key={experiment.id} className="block stack-sm">
          <p className="small">{EXPERIMENT_LABEL[experiment.type] ?? experiment.type} · round {experiment.round}</p>
          <p>{experiment.prompt}</p>
          {experiment.responses.map((response) => (
            <p key={response.id} className="small">{response.participantName}: {response.result}. {response.notes}</p>
          ))}
        </article>
      ))}
      {!experiments.length ? <p>No checks yet.</p> : null}
      <h2>Research notes</h2>
      {notes.map((note) => (
        <article key={note.id} className="block stack-sm">
          <h3>{note.title}</h3>
          <p>{note.body}</p>
          <p className="small">{note.authorName}</p>
        </article>
      ))}
      <form
        className="stack"
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
        <button className="btn" type="submit">Add note</button>
      </form>
      {message ? <Notice>{message}</Notice> : null}
      <h2>Session events that mention this concept</h2>
      {events.map((event) => <p key={event.id} className="small">{new Date(event.createdAt).toLocaleString()} · {event.message}</p>)}
      <Link href={`/session/${code}`}>Back to discovery</Link>
    </div>
  );
}
