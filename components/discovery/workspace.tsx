"use client";

import { useState } from "react";
import Link from "next/link";
import { Archive, ArrowUpRight, FlaskConical, KeyRound, Layers, Plus, Sparkles, Trash2 } from "lucide-react";
import { Composer } from "@/components/discovery/composer";
import { LeaveButton } from "@/components/session/frame";
import { useSessionContext } from "@/components/session/provider";
import { CopyCodeButton, EmptyState, Field, Notice, StatusText } from "@/components/ui/bits";
import { EvidenceImage } from "@/components/ui/media";
import { MotionSwap } from "@/components/ui/motion";
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
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <div className="panel-switch">
        {panes.map((item) => (
          <button key={item} type="button" className={pane === item ? "btn btn-sm btn-primary" : "btn btn-sm"} onClick={() => setPane(item)}>
            {item}
          </button>
        ))}
      </div>
      <div className="bench">
        <section className={`bench-col ${pane === "Session" ? "is-active" : ""}`}>
          <SessionSide />
        </section>

        <section className={`bench-col ${pane === "Discovery" ? "is-active" : ""}`}>
          <div className="stack">
            <div className="row-between">
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
                <button type="button" role="tab" id="tab-evidence" aria-selected={tab === "evidence"} aria-controls="discovery-panel" className="btn" onClick={() => setTab("evidence")}>
                  Evidence <span className="mono muted">({state.evidence.length})</span>
                </button>
                <button type="button" role="tab" id="tab-hypotheses" aria-selected={tab === "hypotheses"} aria-controls="discovery-panel" className="btn" onClick={() => setTab("hypotheses")}>
                  Hypotheses <span className="mono muted">({state.hypotheses.length})</span>
                </button>
                <button type="button" role="tab" id="tab-checks" aria-selected={tab === "checks"} aria-controls="discovery-panel" className="btn" onClick={() => setTab("checks")}>
                  Verification <span className="mono muted">({state.experiments.length})</span>
                </button>
              </div>
            </div>

            <MotionSwap motionKey={tab}>
              <div id="discovery-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
                {tab === "evidence" ? (
                  <div className="stack-lg">
                    <Composer code={code} token={identity.token} concepts={state.concepts} purpose={state.session.purpose} onDone={reload} />
                    <EvidenceList evidence={state.evidence} code={code} token={identity.token} onDone={reload} />
                  </div>
                ) : null}
                {tab === "hypotheses" ? <HypothesisBoard onDone={reload} onOpenConcept={setConceptId} /> : null}
                {tab === "checks" ? <Checks onDone={reload} /> : null}
              </div>
            </MotionSwap>
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
  if (!state || !identity) return null;
  return (
    <div className="stack">
      <div className="stack-xs">
        <p className="eyebrow">Session</p>
        <h2>{state.session.name}</h2>
        <div className="row" style={{ marginTop: 4 }}>
          <CopyCodeButton code={state.session.code} compact />
        </div>
        {state.session.description ? <p className="small">{state.session.description}</p> : null}
        {state.session.objective ? <p className="small muted">Objective: {state.session.objective}</p> : null}
      </div>

      <div className="surface-recessed stack-xs" style={{ padding: 12 }}>
        <p className="small" style={{ fontWeight: 500, color: "var(--ink)" }}>Seats</p>
        {state.participants.map((person) => {
          const presence = person.leftAt ? "left" : person.connected ? "here" : "quiet";
          const presenceLabel = presence === "left" ? "Left" : presence === "here" ? "Here" : "Quiet";
          return (
            <div key={person.id} className="row-between small">
              <span className="seat">
                <span className="seat-mark" data-state={presence} aria-hidden="true" />
                <span>{person.displayName}</span>
                <span className="mono muted">{person.role}</span>
              </span>
              <span className="muted">{presenceLabel}</span>
            </div>
          );
        })}
        {state.participants.length < 2 ? (
          <p className="small muted">One seat is still open. Join from another browser with {state.session.code}.</p>
        ) : null}
      </div>

      <div className="grid-2" style={{ gap: 8 }}>
        <div className="surface-recessed stack-xs" style={{ padding: 10 }}>
          <span className="mono" style={{ fontSize: 18, fontWeight: 500 }}>{state.counts.established}</span>
          <span className="small muted">Verified</span>
        </div>
        <div className="surface-recessed stack-xs" style={{ padding: 10 }}>
          <span className="mono" style={{ fontSize: 18, fontWeight: 500 }}>{state.counts.pending}</span>
          <span className="small muted">Open concepts</span>
        </div>
        <div className="surface-recessed stack-xs" style={{ padding: 10 }}>
          <span className="mono" style={{ fontSize: 18, fontWeight: 500 }}>{state.counts.openHypotheses}</span>
          <span className="small muted">Open guesses</span>
        </div>
        <div className="surface-recessed stack-xs" style={{ padding: 10 }}>
          <span className="mono" style={{ fontSize: 18, fontWeight: 500 }}>{state.counts.evidence}</span>
          <span className="small muted">Evidence</span>
        </div>
      </div>

      <div className="stack-xs block">
        <div className="row-between">
          <h3>Recent activity</h3>
          <Link className="small" href={`/session/${code}/vocabulary`}>Vocabulary</Link>
        </div>
        <div className="stack-xs">
          {state.events.slice(0, 6).map((event) => (
            <p key={event.id} className="small muted">{event.message}</p>
          ))}
        </div>
      </div>

      <details className="surface-recessed" style={{ padding: 12 }}>
        <summary className="small" style={{ cursor: "pointer", fontWeight: 500 }}>Session notes & archive</summary>
        <div style={{ marginTop: 12 }}>
          <SessionNotes />
        </div>
      </details>

      <details className="surface-recessed" style={{ padding: 12 }}>
        <summary className="row small" style={{ cursor: "pointer", fontWeight: 500 }}>
          <KeyRound size={14} strokeWidth={1.5} className="muted" aria-hidden="true" />
          Recovery key
        </summary>
        <div className="stack-xs" style={{ marginTop: 10 }}>
          <p className="mono small" style={{ wordBreak: "break-all" }}>{identity.token}</p>
          <p className="small muted">Keep this key if you want to rejoin from another browser.</p>
        </div>
      </details>

      <div className="row-between block">
        <LeaveButton />
      </div>

      <details className="surface-recessed" style={{ padding: 12 }}>
        <summary className="small" style={{ cursor: "pointer", color: "var(--disputed)", fontWeight: 500 }}>Delete session</summary>
        <div style={{ marginTop: 12 }}>
          <DeleteSession />
        </div>
      </details>
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
      <Field label="Name"><input className="control" value={name} onChange={(event) => setName(event.target.value)} /></Field>
      <Field label="Description"><textarea className="textarea" value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
      <Field label="Research objective"><textarea className="textarea" value={objective} onChange={(event) => setObjective(event.target.value)} /></Field>
      <div className="row">
        <button className="btn btn-sm btn-primary" type="submit">Save notes</button>
        <button
          className="btn btn-sm"
          type="button"
          onClick={() => void api(`/api/sessions/${code}`, { method: "PATCH", token: identity.token, body: { action: state.session.status === "archived" ? "restore" : "archive" } }).then(() => reload())}
        >
          <Archive size={14} strokeWidth={1.5} aria-hidden="true" />
          {state.session.status === "archived" ? "Restore" : "Archive"}
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
      <Field label="Confirm session code" hint="Removes all session records and upload files from this computer.">
        <input className="control mono" value={confirmCode} onChange={(event) => setConfirmCode(event.target.value.toUpperCase())} placeholder={code} />
      </Field>
      <button className="btn btn-sm btn-danger" type="submit">
        <Trash2 size={14} strokeWidth={1.5} aria-hidden="true" />
        Delete session
      </button>
      {message ? <Notice tone="error">{message}</Notice> : null}
    </form>
  );
}

function EvidenceList({ evidence, code, token, onDone }: { evidence: EvidenceDTO[]; code: string; token: string; onDone: () => void }) {
  if (!evidence.length) {
    return (
      <EmptyState
        icon={Layers}
        title="No evidence yet"
        description="A photo, drawing, or gesture description is enough to begin."
      />
    );
  }
  return (
    <div className="stack">
      <div className="row-between">
        <h3>Evidence log</h3>
        <span className="mono small muted">{evidence.length} items</span>
      </div>
      {evidence.map((item) => (
        <article key={item.id} className="surface stack-sm">
          <div className="row-between">
            <div className="row" style={{ gap: 8 }}>
              <span className="status-pill">{item.type}</span>
              <span className="small" style={{ fontWeight: 500, color: "var(--ink)" }}>{item.participantName}</span>
            </div>
            <span className="mono small muted">{new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          </div>

          <p>{item.description || "No description."}</p>
          {item.notes ? <p className="small muted">{item.notes}</p> : null}

          <div className="row">
            {item.actionCategory ? <span className="status-pill">Action: {item.actionCategory}</span> : null}
            {item.stance !== "observation" ? <span className="status-pill">Type: {item.stance.replaceAll("_", " ")}</span> : null}
            {item.durationMs ? <span className="status-pill mono">{Math.round(item.durationMs / 100) / 10}s</span> : null}
          </div>

          {item.gestureDirection ? (
            <p className="small muted">Gesture: {item.gestureDirection}, {item.gestureRepetition}. {item.gestureBody}</p>
          ) : null}

          {item.mediaUrl && item.mimeType?.startsWith("image/") ? <EvidenceImage src={item.mediaUrl} alt={item.description || "Evidence image"} /> : null}
          {item.mediaUrl && item.mimeType?.startsWith("video/") ? <video className="thumb" controls src={item.mediaUrl} /> : null}
          {item.mediaUrl && item.mimeType?.startsWith("audio/") ? <audio controls src={item.mediaUrl} style={{ width: "100%" }} /> : null}
          {item.qualityNote ? <p className="small muted">{item.qualityNote}</p> : null}

          <div className="row" style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
            <button
              type="button"
              className="btn btn-sm"
              onClick={async () => {
                await api(`/api/sessions/${code}/analyze`, { token, body: { evidenceId: item.id } });
                onDone();
              }}
            >
              <Sparkles size={14} strokeWidth={1.5} aria-hidden="true" />
              Request hypotheses
            </button>
            <button
              type="button"
              className="btn btn-sm btn-danger"
              onClick={async () => {
                await api(`/api/sessions/${code}/evidence/${item.id}`, { method: "DELETE", token, body: {} });
                onDone();
              }}
            >
              <Trash2 size={14} strokeWidth={1.5} aria-hidden="true" />
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
    <div className="stack-lg">
      <Notice>
        Accepting a hypothesis records a participant interpretation. It does not verify the meaning. AI-estimated confidence is not a measured probability.
      </Notice>

      {statuses.length > 1 ? (
        <div className="segment" role="tablist" aria-label="Hypothesis status">
          <button type="button" className="btn" role="tab" aria-selected={filter === "all"} onClick={() => setFilter("all")}>All</button>
          {statuses.map((status) => (
            <button key={status} type="button" className="btn" role="tab" aria-selected={filter === status} onClick={() => setFilter(status)}>
              {displayStatus(status)}
            </button>
          ))}
        </div>
      ) : null}

      <div className="stack">
        {shown.map((hypothesis) => (
          <HypothesisCard key={hypothesis.id} hypothesis={hypothesis} onDone={onDone} onOpenConcept={onOpenConcept} />
        ))}
        {!state.hypotheses.length ? (
          <EmptyState
            icon={Sparkles}
            title="No hypotheses yet"
            description="Submit evidence to request competing readings, or propose a participant interpretation below."
          />
        ) : null}
        {state.hypotheses.length > 0 && shown.length === 0 ? <p className="small muted">No readings with that status.</p> : null}
      </div>

      <form
        className="surface stack"
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
        <div>
          <button className="btn btn-primary" type="submit">Add participant interpretation</button>
        </div>
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

  const linkedConcept = state?.concepts.find((concept) => concept.id === hypothesis.conceptId);

  return (
    <article className="surface stack">
      <div className="row-between">
        <span className="small muted">{label}</span>
        <StatusText status={hypothesis.status} pill />
      </div>

      <div className="stack-xs">
        <h3>{hypothesis.proposedMeaning}</h3>
        <p className="small" style={{ color: "var(--ink)" }}>{hypothesis.explanation}</p>
      </div>

      <div className="surface-recessed stack-xs" style={{ padding: 12 }}>
        <p className="small"><strong>Support:</strong> {hypothesis.supportingEvidence}</p>
        <p className="small"><strong>Alternatives:</strong> {hypothesis.alternatives || "None recorded."}</p>
        {hypothesis.missingInformation ? <p className="small"><strong>Missing:</strong> {hypothesis.missingInformation}</p> : null}
        {hypothesis.culturalAmbiguity ? <p className="small"><strong>Context caveat:</strong> {hypothesis.culturalAmbiguity}</p> : null}
        {hypothesis.cannotDetermine ? <p className="small"><strong>Not determined:</strong> {hypothesis.cannotDetermine}</p> : null}
        <p className="small"><strong>Suggested check:</strong> {hypothesis.suggestedExperiment}</p>
      </div>

      {hypothesis.source === "ai" ? (
        <p className="small muted">
          AI-estimated confidence <span className="mono">{hypothesis.confidence.toFixed(2)}</span>. This is not a measured probability.
          {hypothesis.providerNote ? ` · ${hypothesis.providerNote}` : ""}
        </p>
      ) : null}

      {editor && (hypothesis.status === "open" || hypothesis.status === "challenged") ? (
        <div className="stack-sm block">
          <div className="grid-2">
            <Field label="Wording to record">
              <input className="control" value={meaning} onChange={(event) => setMeaning(event.target.value)} />
            </Field>
            <Field label="Category">
              <select className="select" value={category} onChange={(event) => setCategory(event.target.value as (typeof CATEGORIES)[number])}>
                {CATEGORIES.map((item) => <option key={item} value={item}>{CATEGORY_LABEL[item]}</option>)}
              </select>
            </Field>
          </div>
          <div className="row">
            <button type="button" className="btn btn-sm btn-primary" aria-busy={pending === "accept"} disabled={Boolean(pending)} onClick={() => void act("accept")}>
              {pending === "accept" ? "Recording…" : "Accept as tentative"}
            </button>
            <button type="button" className="btn btn-sm" aria-busy={pending === "reject"} disabled={Boolean(pending)} onClick={() => void act("reject")}>
              {pending === "reject" ? "Rejecting…" : "Reject"}
            </button>
            <button type="button" className="btn btn-sm btn-danger" aria-busy={pending === "challenge"} disabled={Boolean(pending)} onClick={() => void act("challenge")}>
              {pending === "challenge" ? "Challenging…" : "Challenge"}
            </button>
          </div>
        </div>
      ) : null}

      {!editor && (hypothesis.status === "open" || hypothesis.status === "challenged") ? (
        <p className="small muted">Only the person guiding this session can accept, reject, or challenge a guess. Doing so still does not session-verify it.</p>
      ) : null}

      {message ? <Notice tone="error">{message}</Notice> : null}
      {linkedConcept ? (
        <p className="small muted">
          Linked concept: <span className="mono">{linkedConcept.conceptCode}</span>
        </p>
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
    <div className="stack-lg">
      <Notice>{METHODOLOGY}</Notice>

      <form
        className="surface stack"
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
        <div className="row" style={{ gap: 8 }}>
          <FlaskConical size={16} strokeWidth={1.5} style={{ color: "var(--oxide)" }} aria-hidden="true" />
          <h3>Create a verification check</h3>
        </div>
        <div className="grid-2">
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
        </div>
        <Field label="What is different about this example?" hint="Required when you repeat a demonstration, a sound, or a counterexample. The same note cannot be used twice.">
          <input className="control" value={stimulusNote} onChange={(event) => setStimulusNote(event.target.value)} />
        </Field>
        <div>
          <button className="btn btn-primary" type="submit">Create check</button>
        </div>
      </form>

      {message ? <Notice>{message}</Notice> : null}

      <div className="stack">
        {state.experiments.map((experiment) => {
          const concept = state.concepts.find((item) => item.id === experiment.conceptId);
          const mine = experiment.responses.some((response) => response.participantId === identity.participantId);
          return (
            <article key={experiment.id} className="surface stack">
              <div className="row-between">
                <span className="status-pill">{EXPERIMENT_LABEL[experiment.type] ?? experiment.type}</span>
                <span className="mono small muted">Check {experiment.round} · {concept?.agreedMeaning}</span>
              </div>
              <p style={{ fontWeight: 500 }}>{experiment.prompt}</p>
              <ResponseForm experimentId={experiment.id} options={experiment.options} disabled={mine} onDone={onDone} />
              {experiment.responses.length ? (
                <div className="stack-xs block">
                  {experiment.responses.map((response) => (
                    <p key={response.id} className="small">
                      <strong>{response.participantName}:</strong> {response.result}
                      {response.notes ? ` — ${response.notes}` : ""}
                    </p>
                  ))}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
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
      className="surface-recessed stack-sm"
      onSubmit={async (event) => {
        event.preventDefault();
        await api(`/api/sessions/${code}/experiments/${experimentId}/respond`, {
          token: identity.token,
          body: { result, selectedOptionId: selected, notes },
        });
        onDone();
      }}
    >
      <div className="grid-2">
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
      </div>
      <Field label="Note"><input className="control" value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
      <div>
        <button className="btn btn-sm btn-primary" type="submit">Record response</button>
      </div>
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
      <Field label="Concept inspector">
        <select className="select" value={concept?.id ?? ""} onChange={(event) => onSelect(event.target.value)}>
          <option value="">None</option>
          {state.concepts.map((item) => (
            <option key={item.id} value={item.id}>{item.conceptCode} {item.agreedMeaning || "Unnamed"}</option>
          ))}
        </select>
      </Field>

      {concept ? (
        <div className="surface stack-sm">
          <div className="row-between">
            <span className="mono small muted">{concept.conceptCode}</span>
            <StatusText status={concept.status} reason={concept.statusReason} pill />
          </div>
          <h2>{concept.agreedMeaning || "No agreed wording"}</h2>
          <p className="small muted">{CATEGORY_LABEL[concept.category as keyof typeof CATEGORY_LABEL] ?? concept.category}</p>
          <p className="small">{concept.statusReason}</p>
          {concept.aiConfidence !== null ? (
            <p className="small muted">Highest AI-estimated confidence: <span className="mono">{concept.aiConfidence.toFixed(2)}</span> (not a measured probability).</p>
          ) : null}
          <p className="small"><strong>Alternatives:</strong> {concept.alternativeInterpretations || "None written."}</p>

          <div className="row">
            <button type="button" className="btn btn-sm btn-danger" onClick={async () => { await api(`/api/sessions/${code}/concepts/${concept.id}`, { method: "PATCH", token: identity.token, body: { action: "dispute" } }); onDone(); }}>Dispute</button>
            <button type="button" className="btn btn-sm" onClick={async () => { await api(`/api/sessions/${code}/concepts/${concept.id}`, { method: "PATCH", token: identity.token, body: { action: "archive" } }); onDone(); }}>Archive</button>
            <button type="button" className="btn btn-sm" onClick={async () => { await api(`/api/sessions/${code}/concepts/${concept.id}`, { method: "PATCH", token: identity.token, body: { action: "restore" } }); onDone(); }}>Reopen</button>
          </div>

          <Link className="btn btn-sm btn-tonal" href={`/session/${code}/concept/${concept.id}`}>
            Full history
            <ArrowUpRight size={14} strokeWidth={1.5} aria-hidden="true" />
          </Link>

          <div className="stack-xs block">
            <h4>Linked evidence ({evidence.length})</h4>
            {evidence.length ? evidence.map((item) => (
              <p key={item.id} className="small muted">{item.type}: {item.description || "No description"}</p>
            )) : <p className="small muted">No evidence linked yet.</p>}
          </div>

          <div className="stack-xs block">
            <h4>Candidate meanings ({hypotheses.length})</h4>
            {hypotheses.length ? hypotheses.map((item) => (
              <p key={item.id} className="small muted">{item.proposedMeaning} ({displayStatus(item.status)})</p>
            )) : <p className="small muted">No candidates linked.</p>}
          </div>
        </div>
      ) : (
        <div className="surface-recessed">
          <p className="small muted">Select a concept or accept a hypothesis to inspect its evidence and check status.</p>
        </div>
      )}

      <form
        className="surface stack-sm"
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
        <div className="row" style={{ gap: 6 }}>
          <Plus size={15} strokeWidth={1.5} style={{ color: "var(--oxide)" }} aria-hidden="true" />
          <h3>Add a tentative entry</h3>
        </div>
        <Field label="Meaning"><input className="control" value={meaning} onChange={(event) => setMeaning(event.target.value)} required /></Field>
        <Field label="Category">
          <select className="select" value={category} onChange={(event) => setCategory(event.target.value as (typeof CATEGORIES)[number])}>
            {CATEGORIES.map((item) => <option key={item} value={item}>{CATEGORY_LABEL[item]}</option>)}
          </select>
        </Field>
        <button className="btn btn-sm" type="submit">Add without AI</button>
      </form>
    </div>
  );
}
