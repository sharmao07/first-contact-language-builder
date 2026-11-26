"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, BookOpen, Pencil } from "lucide-react";
import { useSessionContext } from "@/components/session/provider";
import { EmptyState, Field, Notice, PageHeader, StatusText } from "@/components/ui/bits";
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
    <div className="wrap page-pad stack-lg">
      <PageHeader
        eyebrow="Session lexicon"
        title="Shared vocabulary"
        description="Session-verified entries met this session's checks. Guesses, accepted readings, facilitator-supported observations, and disputed meanings stay visible and uncertain. Search does not promote any of them."
        actions={<Link className="btn btn-sm" href={`/session/${code}`}>Return to discovery</Link>}
      />

      <div className="surface stack">
        <div className="grid-3">
          <Field label="Search">
            <input className="control" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Meaning, code, or note" />
          </Field>
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
        <div className="row-between">
          <label className="row small" style={{ gap: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />
            Show archived
          </label>
          <span className="mono small muted">{items.length} of {state.concepts.length} entries</span>
        </div>
      </div>

      {items.length > 0 ? (
        <div className="vocab-grid">
          {items.map((concept) => (
            <VocabCard key={concept.id} conceptId={concept.id} onDone={reload} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={BookOpen}
          title="No entries match"
          description="Accept a hypothesis in discovery, or clear the filters above."
          action={<Link className="btn btn-sm" href={`/session/${code}`}>Open discovery</Link>}
        />
      )}
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
      <div className="row-between">
        <span className="mono small muted">{current.conceptCode}</span>
        <span className="status-pill">{CATEGORY_LABEL[current.category as keyof typeof CATEGORY_LABEL] ?? current.category}</span>
      </div>
      <h2>{current.agreedMeaning || "Unnamed"}</h2>
      <StatusText status={current.status} reason={current.statusReason} />
      <p className="small">{current.statusReason}</p>
      {current.aiConfidence !== null ? (
        <p className="small muted">AI-estimated confidence <span className="mono">{current.aiConfidence.toFixed(2)}</span>, not a measured probability.</p>
      ) : null}
      <p className="small muted">Updated {new Date(current.updatedAt).toLocaleDateString()}</p>

      {editing ? (
        <form className="stack-sm block" onSubmit={save}>
          <Field label="Meaning"><input className="control" value={meaning} onChange={(event) => setMeaning(event.target.value)} required /></Field>
          <Field label="Notes"><textarea className="textarea" value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
          <Field label="Examples"><textarea className="textarea" value={examples} onChange={(event) => setExamples(event.target.value)} /></Field>
          <Field label="Alternatives"><textarea className="textarea" value={alternatives} onChange={(event) => setAlternatives(event.target.value)} /></Field>
          <div className="row">
            <button className="btn btn-sm btn-primary" type="submit">Save</button>
            <button className="btn btn-sm" type="button" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <div className="row" style={{ marginTop: "auto", paddingTop: 8 }}>
          <button type="button" className="btn btn-sm" onClick={() => setEditing(true)}>
            <Pencil size={13} strokeWidth={1.5} aria-hidden="true" />
            Edit
          </button>
          <Link className="btn btn-sm btn-tonal" href={`/session/${code}/concept/${current.id}`}>
            History
            <ArrowUpRight size={13} strokeWidth={1.5} aria-hidden="true" />
          </Link>
        </div>
      )}
      {message ? <Notice tone="error">{message}</Notice> : null}
    </article>
  );
}
