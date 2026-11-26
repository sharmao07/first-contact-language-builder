"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Composer } from "@/components/discovery/composer";
import { LeaveButton } from "@/components/session/frame";
import { useSessionContext } from "@/components/session/provider";
import { Field, Notice, StatusText } from "@/components/ui/bits";
import { EvidenceImage } from "@/components/ui/media";
import { api, ApiError } from "@/lib/client/api";
import { canMutateHypotheses } from "@/lib/access/policy";
import { CATEGORIES, CATEGORY_LABEL, displayStatus, EXPERIMENT_LABEL, EXPERIMENT_TYPES } from "@/lib/constants";
import { METHODOLOGY } from "@/lib/verification/methodology";
import type { EvidenceDTO, HypothesisDTO } from "@/lib/types";

const panes = ["Session", "Discovery", "Concept"] as const;

export function Workspace() {
  const { code, state, identity, reload } = useSessionContext();
  const [pane, setPane] = useState<(typeof panes)[number]>("Discovery");
  const [tab, setTab] = useState<"evidence" | "hypotheses" | "checks">("evidence");
  const [conceptId, setConceptId] = useState<string>("");
  if (!state || !identity) return null;
  const selected = state.concepts.find((concept) => concept.id === conceptId) ?? state.concepts.find((concept) => concept.status !== "archived") ?? null;

  return (
    <div>
      <div className="panel-switch">
        {panes.map((item) => (
          <button key={item} type="button" className={pane === item ? "btn btn-primary" : "btn"} onClick={() => setPane(item)}>{item}</button>
        ))}
      </div>
      <div className="bench">
        <section className={`bench-col ${pane === "Session" ? "is-active" : ""}`}>
          <SessionSide />
        </section>
        <section className={`bench-col ${pane === "Discovery" ? "is-active" : ""}`}>
          <div
            className="segment"
            role="tablist"
            aria-label="Discovery"
            onKeyDown={(event) => {
              const order = ["evidence", "hypotheses", "checks"] as const;
              const index = order.indexOf(tab);
              if (event.key === "ArrowRight") setTab(order[(index + 1) % order.length]);
              if (event.key === "ArrowLeft") setTab(order[(index - 1 + order.length) % order.length]);
            }}
          >
            <button type="button" role="tab" id="tab-evidence" aria-selected={tab === "evidence"} aria-controls="discovery-panel" className="btn" onClick={() => setTab("evidence")}>Evidence</button>
            <button type="button" role="tab" id="tab-hypotheses" aria-selected={tab === "hypotheses"} aria-controls="discovery-panel" className="btn" onClick={() => setTab("hypotheses")}>Hypotheses</button>
            <button type="button" role="tab" id="tab-checks" aria-selected={tab === "checks"} aria-controls="discovery-panel" className="btn" onClick={() => setTab("checks")}>Verification</button>
          </div>
          <div id="discovery-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} key={tab} className="page-enter">
          {tab === "evidence" ? (
            <div className="stack">
              <Composer code={code} token={identity.token} concepts={state.concepts} purpose={state.session.purpose} onDone={reload} />
              <EvidenceList evidence={state.evidence} code={code} token={identity.token} onDone={reload} />
            </div>
          ) : null}
          {tab === "hypotheses" ? <HypothesisBoard onDone={reload} onOpenConcept={setConceptId} /> : null}
          {tab === "checks" ? <Checks onDone={reload} /> : null}
          </div>
        </section>
        <aside className={`bench-col ${pane === "Concept" ? "is-active" : ""}`}>
          <ConceptSide selectedId={selected?.id ?? ""} onSelect={setConceptId} onDone={reload} />
        </aside>
      </div>
    </div>
  );
}

function SessionSide() {
  const { state, identity, code } = useSessionContext();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);
  if (!state || !identity) return null;
  return (
    <div className="stack">
      <div>
        <h2>{state.session.name}</h2>
        <p className="mono">{state.session.code}</p>
      </div>
      <p className="small">{state.session.description}</p>
      {state.session.objective ? <p className="small">Objective: {state.session.objective}</p> : null}
      <SessionNotes />
      <button
        type="button"
        className="btn"
        aria-live="polite"
        onClick={() => {
          void navigator.clipboard.writeText(state.session.code);
          setCopied(true);
        }}
      >
        {copied ? "Code copied" : "Copy session code"}
      </button>
      <p className="small">On the other device, open this app, choose Join, and enter {state.session.code}. Pick the open seat.</p>
      <div className="stack-sm">
        <h3>Seats</h3>
        {state.participants.map((person) => {
          const presence = person.leftAt ? "left" : person.connected ? "here" : "quiet";
          const presenceLabel = presence === "left" ? "Left" : presence === "here" ? "Here" : "Quiet";
          return (
            <p key={person.id} className="seat small">
              <span className="seat-mark" data-state={presence} aria-hidden="true" />
              {person.role}. {person.displayName}. {presenceLabel}
            </p>
          );
        })}
        {state.participants.length < 2 ? <p className="small muted">One seat is still open.</p> : null}
      </div>
      <div className="stack-sm">
        <h3>Progress</h3>
        <p className="small">{state.counts.established} session-verified meanings</p>
        <p className="small">{state.counts.pending} concepts still open</p>
        <p className="small">{state.counts.openHypotheses} open hypotheses</p>
        <p className="small">{state.counts.evidence} evidence items</p>
      </div>
      <details>
        <summary>Recovery key</summary>
        <p className="mono small">{identity.token}</p>
        <p className="small muted">Keep this key if you want to rejoin from another browser.</p>
      </details>
      <div className="stack-sm">
        <h3>Recent activity</h3>
        {state.events.slice(0, 8).map((event) => (
          <p key={event.id} className="small">{event.message}</p>
        ))}
      </div>
      <LeaveButton />
      <DeleteSession />
      <p className="small"><Link href={`/session/${code}/vocabulary`}>Open vocabulary</Link></p>
    </div>
  );
}

function SessionNotes() {
  const { state, identity, code, reload } = useSessionContext();
  const [name, setName] = useState(state?.session.name ?? "");
  const [description, setDescription] = useState(state?.session.description ?? "");
  const [objective, setObjective] = useState(state?.session.objective ?? "");
  const [message, setMessage] = useState<string | null>(null);
  if (!state || !identity) return null;
  return (
    <form
      className="stack-sm"
      onSubmit={async (event) => {
        event.preventDefault();
        try {
          await api(`/api/sessions/${code}`, {
            method: "PATCH",
            token: identity.token,
            body: { name, description, objective },
          });
          setMessage("Session notes saved.");
          reload();
        } catch (caught) {
          setMessage(caught instanceof ApiError ? caught.message : "The notes were not saved.");
        }
      }}
    >
      <h3>Session notes</h3>
      <Field label="Name"><input className="control" value={name} onChange={(event) => setName(event.target.value)} /></Field>
      <Field label="Description"><textarea className="textarea" value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
      <Field label="Research objective"><textarea className="textarea" value={objective} onChange={(event) => setObjective(event.target.value)} /></Field>
      <div className="row">
        <button className="btn" type="submit">Save notes</button>
        <button
          className="btn"
          type="button"
          onClick={() => void api(`/api/sessions/${code}`, { method: "PATCH", token: identity.token, body: { action: state.session.status === "archived" ? "restore" : "archive" } }).then(() => reload())}
        >
          {state.session.status === "archived" ? "Restore session" : "Archive session"}
        </button>
      </div>
      {message ? <p className="small">{message}</p> : null}
    </form>
  );
}

function DeleteSession() {
  const { code, identity, state, reload } = useSessionContext();
  const [confirmCode, setConfirmCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  if (!identity || !state) return null;
  return (
    <form
      className="stack-sm"
      onSubmit={async (event) => {
        event.preventDefault();
        setMessage(null);
        try {
          await api(`/api/sessions/${code}`, { method: "DELETE", token: identity.token, body: { confirmCode } });
          window.location.href = "/";
        } catch (caught) {
          setMessage(caught instanceof ApiError ? caught.message : "The session was not deleted.");
          reload();
        }
      }}
    >
      <Field label="Delete this session" hint="Type the session code. This removes its files from this computer.">
        <input className="control mono" value={confirmCode} onChange={(event) => setConfirmCode(event.target.value.toUpperCase())} />
      </Field>
      <button className="btn btn-danger" type="submit">Delete session</button>
      {message ? <Notice>{message}</Notice> : null}
    </form>
  );
}

function EvidenceList({ evidence, code, token, onDone }: { evidence: EvidenceDTO[]; code: string; token: string; onDone: () => void }) {
  if (!evidence.length) return <p>No evidence yet. A photo, drawing, or gesture description is enough to begin.</p>;
  return (
    <div className="stack">
      {evidence.map((item) => (
        <article key={item.id} className="block stack-sm">
          <p className="small">{item.type} by {item.participantName}</p>
          <p>{item.description || "No description."}</p>
          {item.notes ? <p className="small muted">{item.notes}</p> : null}
          {item.actionCategory ? <p className="small">Action: {item.actionCategory}</p> : null}
          {item.mediaUrl && item.mimeType?.startsWith("image/") ? <EvidenceImage src={item.mediaUrl} alt={item.description || "Evidence image"} /> : null}
          {item.mimeType?.startsWith("video/") && item.mediaUrl ? <video className="thumb" controls src={item.mediaUrl} /> : null}
          {item.mimeType?.startsWith("audio/") && item.mediaUrl ? <audio controls src={item.mediaUrl} /> : null}
          {item.durationMs ? <p className="small">Duration {Math.round(item.durationMs / 100) / 10}s. {item.qualityNote}</p> : null}
          {item.stance !== "observation" ? <p className="small">Record type: {item.stance.replaceAll("_", " ")}.</p> : null}
          {item.gestureDirection ? <p className="small">Gesture: {item.gestureDirection}, {item.gestureRepetition}. {item.gestureBody}</p> : null}
          {item.mediaUrl && item.mimeType?.startsWith("audio/") ? <audio controls src={item.mediaUrl} /> : null}
          {item.mediaUrl && item.mimeType?.startsWith("video/") ? <video controls src={item.mediaUrl} style={{ width: "100%" }} /> : null}
          <div className="row">
            <button
              type="button"
              className="btn"
              onClick={async () => {
                await api(`/api/sessions/${code}/analyze`, { token, body: { evidenceId: item.id } });
                onDone();
              }}
            >
              Request hypotheses
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={async () => {
                await api(`/api/sessions/${code}/evidence/${item.id}`, { method: "DELETE", token, body: {} });
                onDone();
              }}
            >
              Delete
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function HypothesisBoard({ onDone, onOpenConcept }: { onDone: () => void; onOpenConcept: (id: string) => void }) {
  const { state, identity, code } = useSessionContext();
  const [meaning, setMeaning] = useState("");
  const [explanation, setExplanation] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  if (!state || !identity) return null;
  const statuses = [...new Set(state.hypotheses.map((hypothesis) => hypothesis.status))];
  const shown = state.hypotheses.filter((hypothesis) => filter === "all" || hypothesis.status === filter);
  return (
    <div className="stack">
      <p className="small">Accepting a hypothesis records a participant interpretation. It does not verify the meaning. AI-estimated confidence is not a measured probability.</p>
      {statuses.length > 1 ? (
        <div className="segment" role="tablist" aria-label="Hypothesis status">
          <button type="button" className="btn" role="tab" aria-selected={filter === "all"} onClick={() => setFilter("all")}>All</button>
          {statuses.map((status) => (
            <button key={status} type="button" className="btn" role="tab" aria-selected={filter === status} onClick={() => setFilter(status)}>{displayStatus(status)}</button>
          ))}
        </div>
      ) : null}
      {shown.map((hypothesis) => (
        <HypothesisCard key={hypothesis.id} hypothesis={hypothesis} onDone={onDone} onOpenConcept={onOpenConcept} />
      ))}
      {!state.hypotheses.length ? <p>No hypotheses yet. Submit evidence to request some, or propose one yourself.</p> : null}
      {state.hypotheses.length > 0 && shown.length === 0 ? <p>No readings with that status.</p> : null}
      <form
        className="stack"
        onSubmit={async (event) => {
          event.preventDefault();
          try {
            await api(`/api/sessions/${code}/hypotheses`, {
              token: identity.token,
              body: { proposedMeaning: meaning, explanation, alternatives: "" },
            });
            setMeaning("");
            setExplanation("");
            setMessage("Your interpretation was added. It is not verified.");
            onDone();
          } catch (caught) {
            setMessage(caught instanceof ApiError ? caught.message : "Could not save that interpretation.");
          }
        }}
      >
        <h3>Propose your own reading</h3>
        <Field label="Meaning"><input className="control" value={meaning} onChange={(event) => setMeaning(event.target.value)} required /></Field>
        <Field label="Why you think so"><textarea className="textarea" value={explanation} onChange={(event) => setExplanation(event.target.value)} required /></Field>
        <button className="btn" type="submit">Add participant interpretation</button>
        {message ? <Notice>{message}</Notice> : null}
      </form>
    </div>
  );
}

function HypothesisCard({
  hypothesis,
  onDone,
  onOpenConcept,
}: {
  hypothesis: HypothesisDTO;
  onDone: () => void;
  onOpenConcept: (id: string) => void;
}) {
  const { code, identity, state } = useSessionContext();
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("other");
  const [meaning, setMeaning] = useState(hypothesis.proposedMeaning);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  if (!identity) return null;
  const token = identity.token;
  const editor = state?.viewer
    ? canMutateHypotheses({ purpose: state.session.purpose, role: state.viewer.role, communityRole: state.viewer.communityRole })
    : false;
  const label = hypothesis.source === "participant" ? "Participant interpretation" : hypothesis.simulated ? "Simulated hypothesis" : "AI hypothesis";

  async function act(action: "accept" | "reject" | "challenge") {
    setMessage(null);
    setPending(action);
    try {
      const result = await api<{ conceptId?: string }>(`/api/sessions/${code}/hypotheses/${hypothesis.id}`, {
        token,
        body: { action, category, meaning },
      });
      if (result.conceptId) onOpenConcept(result.conceptId);
      onDone();
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : "That response was not saved.");
    } finally {
      setPending(null);
    }
  }

  return (
    <article className="block stack-sm">
      <p className="small">{label} · <StatusText status={hypothesis.status} /></p>
      <h3>{hypothesis.proposedMeaning}</h3>
      <p>{hypothesis.explanation}</p>
      <p className="small">Support: {hypothesis.supportingEvidence}</p>
      <p className="small">Alternatives: {hypothesis.alternatives || "None recorded."}</p>
      {hypothesis.missingInformation ? <p className="small">Missing: {hypothesis.missingInformation}</p> : null}
      {hypothesis.culturalAmbiguity ? <p className="small">Context that could change the reading: {hypothesis.culturalAmbiguity}</p> : null}
      {hypothesis.cannotDetermine ? <p className="small">Not determined: {hypothesis.cannotDetermine}</p> : null}
      <p className="small">Suggested check: {hypothesis.suggestedExperiment}</p>
      {hypothesis.source === "ai" ? <p className="small">AI-estimated confidence {hypothesis.confidence.toFixed(2)}. This is not a measured probability.</p> : null}
      {hypothesis.providerNote ? <p className="small muted">{hypothesis.providerNote}</p> : null}
      {editor && (hypothesis.status === "open" || hypothesis.status === "challenged") ? (
        <div className="stack-sm">
          <Field label="Wording to record">
            <input className="control" value={meaning} onChange={(event) => setMeaning(event.target.value)} />
          </Field>
          <Field label="Category">
            <select className="select" value={category} onChange={(event) => setCategory(event.target.value as (typeof CATEGORIES)[number])}>
              {CATEGORIES.map((item) => <option key={item} value={item}>{CATEGORY_LABEL[item]}</option>)}
            </select>
          </Field>
          <div className="row">
            <button type="button" className="btn btn-primary" aria-busy={pending === "accept"} disabled={Boolean(pending)} onClick={() => void act("accept")}>{pending === "accept" ? "Recording the interpretation…" : "Accept as tentative"}</button>
            <button type="button" className="btn" aria-busy={pending === "reject"} disabled={Boolean(pending)} onClick={() => void act("reject")}>{pending === "reject" ? "Recording the rejection…" : "Reject"}</button>
            <button type="button" className="btn btn-danger" aria-busy={pending === "challenge"} disabled={Boolean(pending)} onClick={() => void act("challenge")}>{pending === "challenge" ? "Recording the challenge…" : "Challenge"}</button>
          </div>
        </div>
      ) : null}
      {!editor && (hypothesis.status === "open" || hypothesis.status === "challenged") ? (
        <p className="small">Only the person guiding this session can accept, reject, or challenge a guess. Doing so still does not session-verify it.</p>
      ) : null}
      {message ? <Notice>{message}</Notice> : null}
      {state?.concepts.find((concept) => concept.id === hypothesis.conceptId) ? (
        <p className="small">Linked concept: {state.concepts.find((concept) => concept.id === hypothesis.conceptId)?.conceptCode}</p>
      ) : null}
    </article>
  );
}

function Checks({ onDone }: { onDone: () => void }) {
  const { state, identity, code } = useSessionContext();
  const [conceptId, setConceptId] = useState("");
  const [type, setType] = useState<(typeof EXPERIMENT_TYPES)[number]>("contrast_testing");
  const [stimulusNote, setStimulusNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  if (!state || !identity) return null;
  const eligible = state.concepts.filter((concept) => concept.agreedMeaning && concept.status !== "archived");
  return (
    <div className="stack">
      <p>{METHODOLOGY}</p>
      <form
        className="stack"
        onSubmit={async (event) => {
          event.preventDefault();
          try {
            await api(`/api/sessions/${code}/experiments`, { token: identity.token, body: { conceptId, type, stimulusNote } });
            setStimulusNote("");
            setMessage("Check created. A response still has to be recorded by a person.");
            onDone();
          } catch (caught) {
            setMessage(caught instanceof ApiError ? caught.message : "Could not create the check.");
          }
        }}
      >
        <Field label="Concept">
          <select className="select" value={conceptId} onChange={(event) => setConceptId(event.target.value)} required>
            <option value="">Choose</option>
            {eligible.map((concept) => <option key={concept.id} value={concept.id}>{concept.agreedMeaning}</option>)}
          </select>
        </Field>
        <Field label="Check type">
          <select className="select" value={type} onChange={(event) => setType(event.target.value as (typeof EXPERIMENT_TYPES)[number])}>
            {EXPERIMENT_TYPES.map((item) => <option key={item} value={item}>{EXPERIMENT_LABEL[item]}</option>)}
          </select>
        </Field>
        <Field label="What is different about this example?" hint="Required when you repeat a demonstration, a sound, or a counterexample. The same note cannot be used twice.">
          <input className="control" value={stimulusNote} onChange={(event) => setStimulusNote(event.target.value)} />
        </Field>
        <button className="btn" type="submit">Create check</button>
      </form>
      {message ? <Notice>{message}</Notice> : null}
      {state.experiments.map((experiment) => {
        const concept = state.concepts.find((item) => item.id === experiment.conceptId);
        const mine = experiment.responses.some((response) => response.participantId === identity.participantId);
        return (
          <article key={experiment.id} className="block stack-sm">
            <p className="small">{EXPERIMENT_LABEL[experiment.type] ?? experiment.type} · check {experiment.round} · {concept?.agreedMeaning}</p>
            <p>{experiment.prompt}</p>
            <ResponseForm experimentId={experiment.id} options={experiment.options} disabled={mine} onDone={onDone} />
            {experiment.responses.map((response) => (
              <p key={response.id} className="small">{response.participantName}: {response.result}{response.notes ? ` — ${response.notes}` : ""}</p>
            ))}
          </article>
        );
      })}
    </div>
  );
}

function ResponseForm({
  experimentId,
  options,
  disabled,
  onDone,
}: {
  experimentId: string;
  options: Array<{ id: string; label: string }>;
  disabled: boolean;
  onDone: () => void;
}) {
  const { code, identity } = useSessionContext();
  const [selected, setSelected] = useState(options[0]?.id ?? "");
  const [result, setResult] = useState("correct");
  const [notes, setNotes] = useState("");
  if (!identity) return null;
  if (disabled) return <p className="small muted">You already responded.</p>;
  return (
    <form
      className="stack-sm"
      onSubmit={async (event) => {
        event.preventDefault();
        await api(`/api/sessions/${code}/experiments/${experimentId}/respond`, {
          token: identity.token,
          body: { result, selectedOptionId: selected, notes },
        });
        onDone();
      }}
    >
      {options.length ? (
        <Field label="Choice">
          <select className="select" value={selected} onChange={(event) => setSelected(event.target.value)}>
            {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </Field>
      ) : null}
      <Field label="Your judgment">
        <select className="select" value={result} onChange={(event) => setResult(event.target.value)}>
          <option value="correct">Matched the intended meaning</option>
          <option value="incorrect">Matched something else</option>
          <option value="ambiguous">Ambiguous</option>
          <option value="disagree">We disagree</option>
        </select>
      </Field>
      <Field label="Note"><input className="control" value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
      <button className="btn" type="submit">Record response</button>
    </form>
  );
}

function ConceptSide({ selectedId, onSelect, onDone }: { selectedId: string; onSelect: (id: string) => void; onDone: () => void }) {
  const { state, identity, code } = useSessionContext();
  const [meaning, setMeaning] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("other");
  if (!state || !identity) return null;
  const concept = state.concepts.find((item) => item.id === selectedId) ?? null;
  const evidence = state.evidence.filter((item) => item.conceptId === concept?.id);
  const hypotheses = state.hypotheses.filter((item) => item.conceptId === concept?.id);
  return (
    <div className="stack">
      <Field label="Current concept">
        <select className="select" value={concept?.id ?? ""} onChange={(event) => onSelect(event.target.value)}>
          <option value="">None</option>
          {state.concepts.map((item) => (
            <option key={item.id} value={item.id}>{item.conceptCode} {item.agreedMeaning || "Unnamed"}</option>
          ))}
        </select>
      </Field>
      {concept ? (
        <div className="stack-sm">
          <StatusText status={concept.status} reason={concept.statusReason} />
          <h2>{concept.agreedMeaning || "No agreed wording"}</h2>
          <p className="small">{CATEGORY_LABEL[concept.category as keyof typeof CATEGORY_LABEL] ?? concept.category}</p>
          <p className="small">{concept.statusReason}</p>
          {concept.aiConfidence !== null ? <p className="small">Highest AI-estimated confidence on record: {concept.aiConfidence.toFixed(2)}. Not a measured probability.</p> : null}
          <p className="small">Alternatives: {concept.alternativeInterpretations || "None written."}</p>
          <div className="row">
            <button type="button" className="btn btn-danger" onClick={async () => { await api(`/api/sessions/${code}/concepts/${concept.id}`, { method: "PATCH", token: identity.token, body: { action: "dispute" } }); onDone(); }}>Dispute</button>
            <button type="button" className="btn" onClick={async () => { await api(`/api/sessions/${code}/concepts/${concept.id}`, { method: "PATCH", token: identity.token, body: { action: "archive" } }); onDone(); }}>Archive</button>
            <button type="button" className="btn" onClick={async () => { await api(`/api/sessions/${code}/concepts/${concept.id}`, { method: "PATCH", token: identity.token, body: { action: "restore" } }); onDone(); }}>Reopen</button>
          </div>
          <Link href={`/session/${code}/concept/${concept.id}`}>Full history</Link>
          <h3>Evidence</h3>
          {evidence.length ? evidence.map((item) => <p key={item.id} className="small">{item.type}: {item.description || "No description"}</p>) : <p className="small muted">No evidence linked yet.</p>}
          <h3>Candidate meanings</h3>
          {hypotheses.length ? hypotheses.map((item) => <p key={item.id} className="small">{item.proposedMeaning} ({item.status})</p>) : <p className="small muted">No candidates linked.</p>}
        </div>
      ) : <p className="small">Select a concept or accept a hypothesis.</p>}
      <form
        className="stack-sm"
        onSubmit={async (event) => {
          event.preventDefault();
          const created = await api<{ conceptId: string }>(`/api/sessions/${code}/concepts`, {
            token: identity.token,
            body: { agreedMeaning: meaning, category },
          });
          setMeaning("");
          onSelect(created.conceptId);
          onDone();
        }}
      >
        <h3>Add a tentative entry</h3>
        <Field label="Meaning"><input className="control" value={meaning} onChange={(event) => setMeaning(event.target.value)} required /></Field>
        <Field label="Category">
          <select className="select" value={category} onChange={(event) => setCategory(event.target.value as (typeof CATEGORIES)[number])}>
            {CATEGORIES.map((item) => <option key={item} value={item}>{CATEGORY_LABEL[item]}</option>)}
          </select>
        </Field>
        <button className="btn" type="submit">Add without AI</button>
      </form>
    </div>
  );
}
