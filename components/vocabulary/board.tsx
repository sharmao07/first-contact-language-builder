"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSessionContext } from "@/components/session/provider";
import { Field, Notice, StatusText } from "@/components/ui/bits";
import { EvidenceImage } from "@/components/ui/media";
import { api, ApiError } from "@/lib/client/api";
import { CATEGORIES, CATEGORY_LABEL } from "@/lib/constants";

const statuses = ["all", "verified", "tentative", "awaiting", "hypothesis", "disputed", "archived"];

export function VocabularyBoard() {
  const { state, identity, code, reload } = useSessionContext();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  if (!state || !identity) return null;

  const items = state.concepts.filter((concept) => {
    if (!showArchived && concept.status === "archived" && status !== "archived") return false;
    if (category !== "all" && concept.category !== category) return false;
    if (status !== "all" && concept.status !== status) return false;
    const haystack = `${concept.agreedMeaning} ${concept.conceptCode} ${concept.contextualNotes} ${concept.alternativeInterpretations}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });

  return (
    <div className="wrap section stack">
      <h1>Shared vocabulary</h1>
      <p className="small">Entries keep their verification status. A search does not promote a hypothesis into a verified meaning.</p>
      <div className="grid-3">
        <Field label="Search"><input className="control" value={query} onChange={(event) => setQuery(event.target.value)} /></Field>
        <Field label="Category">
          <select className="select" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="all">All categories</option>
            {CATEGORIES.map((item) => <option key={item} value={item}>{CATEGORY_LABEL[item]}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select className="select" value={status} onChange={(event) => setStatus(event.target.value)}>
            {statuses.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </Field>
      </div>
      <label className="small"><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} /> Show archived</label>
      <div className="vocab-grid">
        {items.map((concept) => (
          <VocabCard key={concept.id} conceptId={concept.id} onDone={reload} />
        ))}
      </div>
      {!items.length ? <p>No entries match. Accept a hypothesis in discovery, or clear the filters.</p> : null}
      <p className="small"><Link href={`/session/${code}`}>Return to discovery</Link></p>
    </div>
  );
}

function VocabCard({ conceptId, onDone }: { conceptId: string; onDone: () => void }) {
  const { state, identity, code } = useSessionContext();
  const concept = state?.concepts.find((item) => item.id === conceptId);
  const [editing, setEditing] = useState(false);
  const [meaning, setMeaning] = useState(concept?.agreedMeaning ?? "");
  const [notes, setNotes] = useState(concept?.contextualNotes ?? "");
  const [examples, setExamples] = useState(concept?.exampleSituations ?? "");
  const [alternatives, setAlternatives] = useState(concept?.alternativeInterpretations ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const evidence = useMemo(() => state?.evidence.filter((item) => item.conceptId === conceptId) ?? [], [state, conceptId]);
  if (!concept || !identity) return null;
  const current = concept;
  const token = identity.token;
  const image = evidence.find((item) => item.mediaUrl && item.mimeType?.startsWith("image/"));

  async function save(event: React.FormEvent) {
    event.preventDefault();
    try {
      await api(`/api/sessions/${code}/concepts/${current.id}`, {
        method: "PATCH",
        token,
        body: { agreedMeaning: meaning, contextualNotes: notes, exampleSituations: examples, alternativeInterpretations: alternatives },
      });
      setEditing(false);
      onDone();
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : "The edit was not saved.");
    }
  }

  return (
    <article className="stack-sm">
      {image?.mediaUrl ? <EvidenceImage alt={current.agreedMeaning || "Concept evidence"} src={image.mediaUrl} /> : null}
      <p className="mono small">{current.conceptCode}</p>
      <h2>{current.agreedMeaning || "Unnamed"}</h2>
      <StatusText status={current.status} />
      <p className="small">{CATEGORY_LABEL[current.category as keyof typeof CATEGORY_LABEL] ?? current.category}</p>
      <p className="small">{current.statusReason}</p>
      {current.aiConfidence !== null ? <p className="small">AI-estimated confidence {current.aiConfidence.toFixed(2)}, not a measured probability.</p> : null}
      <p className="small">Updated {new Date(current.updatedAt).toLocaleString()}</p>
      {editing ? (
        <form className="stack-sm" onSubmit={save}>
          <Field label="Meaning"><input className="control" value={meaning} onChange={(event) => setMeaning(event.target.value)} required /></Field>
          <Field label="Notes"><textarea className="textarea" value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
          <Field label="Examples"><textarea className="textarea" value={examples} onChange={(event) => setExamples(event.target.value)} /></Field>
          <Field label="Alternatives"><textarea className="textarea" value={alternatives} onChange={(event) => setAlternatives(event.target.value)} /></Field>
          <button className="btn btn-primary" type="submit">Save</button>
        </form>
      ) : (
        <div className="row">
          <button type="button" className="btn" onClick={() => setEditing(true)}>Edit</button>
          <Link href={`/session/${code}/concept/${current.id}`}>History</Link>
        </div>
      )}
      {message ? <Notice>{message}</Notice> : null}
    </article>
  );
}
