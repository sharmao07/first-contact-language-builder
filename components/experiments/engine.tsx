"use client";

import { useMemo, useState } from "react";
import { Check, EyeOff, FlaskConical, Lock, Sparkles } from "lucide-react";
import { useSessionContext } from "@/components/session/provider";
import { EmptyState, Field, Notice, PageHeader, StatusText } from "@/components/ui/bits";
import { api, ApiError } from "@/lib/client/api";
import { EXPERIMENT_LABEL } from "@/lib/constants";
import { buildTimeline } from "@/lib/experiments/timeline";
import { SIMULATED_PLAN_NOTE } from "@/lib/experiments/schema";
import type { ProposalDTO } from "@/lib/types";

function provenanceLabel(source: string, simulated: boolean) {
  if (source === "human") return "Human-authored check";
  if (simulated || source === "rules") return SIMULATED_PLAN_NOTE;
  return "Live model plan. Not a verified meaning.";
}

export function ExperimentEngine() {
  const { state, identity, code, reload } = useSessionContext();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [prompt, setPrompt] = useState("");
  const [shareWithModel, setShareWithModel] = useState(false);

  const timeline = useMemo(() => buildTimeline({
    evidence: (state?.evidence ?? []).map((item) => ({ id: item.id, description: item.description, createdAt: item.createdAt })),
    hypotheses: (state?.hypotheses ?? []).map((item) => ({ id: item.id, meaning: item.proposedMeaning, createdAt: item.createdAt, simulated: item.simulated })),
    proposals: (state?.proposals ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      status: item.status,
      experimentType: item.experimentType,
      createdAt: item.createdAt,
      recordedOutcome: item.recordedOutcome,
    })),
    replies: (state?.proposals ?? []).flatMap((item) => item.replies.filter((reply) => reply.lockedAt && !reply.hidden).map((reply) => ({
      proposalId: item.id,
      participantId: reply.participantId,
      lockedAt: reply.lockedAt,
      stance: reply.stance,
    }))),
    disagreements: (state?.experiments ?? []).flatMap((experiment) => experiment.responses.filter((response) => response.result === "disagree").map((response) => ({
      id: response.id,
      createdAt: response.createdAt,
      detail: `A check response disagreed. ${response.notes}`.trim(),
    }))),
  }), [state]);

  if (!state || !identity) return null;
  const token = identity.token;
  const viewerId = identity.participantId;
  const facilitator = state.session.purpose !== "community" || state.viewer?.communityRole === "facilitator";
  const proposals = [...state.proposals].sort((left, right) => right.heuristicScore - left.heuristicScore || right.createdAt.localeCompare(left.createdAt));
  const current = proposals.find((item) => item.id === selected)
    ?? proposals.find((item) => item.status === "approved")
    ?? proposals.find((item) => item.status !== "rejected")
    ?? null;

  async function act(body: Record<string, unknown>) {
    setPending(true);
    setMessage(null);
    try {
      const result = await api<{ reason?: string; simulated?: boolean }>(`/api/sessions/${code}/plans`, { token, body });
      if (result.reason) setMessage(result.reason);
      else if (result.simulated) setMessage("Simulated experiment recommendation — no model analyzed this session.");
      else if (body.action === "request") setMessage("Live model plan. Not a verified meaning.");
      reload();
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : "The check could not be saved.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="wrap page-pad stack-lg">
      <PageHeader
        eyebrow="Experiment checks"
        title="What could still be true"
        description="Observe, keep the competing guesses, plan a check that names what each result would support or weaken, then collect the two replies separately. A check does not choose the meaning, and one result cannot session-verify it."
      />

      {message ? <Notice>{message}</Notice> : null}

      {facilitator ? (
        <section className="surface stack">
          <div className="row-between">
            <div className="stack-xs">
              <h2>Open readings</h2>
              <p className="small">Competing readings currently in play for check design.</p>
            </div>
            <div className="row">
              <button type="button" className="btn btn-primary" disabled={pending} onClick={() => void act({ action: "request", shareWithModel })}>
                <Sparkles size={15} strokeWidth={1.5} aria-hidden="true" />
                {pending ? "Asking for a check…" : "Ask for a check"}
              </button>
              <button type="button" className="btn" disabled={pending} onClick={() => void act({ action: "request", followUp: true, shareWithModel })}>
                Ask for a follow-up
              </button>
            </div>
          </div>

          {!state.hypotheses.length ? (
            <p className="small muted">No hypotheses are on record yet. Add evidence and ask for readings before designing a check.</p>
          ) : (
            <div className="grid-2" style={{ gap: 10 }}>
              {state.hypotheses.map((hypothesis) => (
                <div key={hypothesis.id} className="surface-recessed stack-xs" style={{ padding: 12 }}>
                  <p className="small" style={{ fontWeight: 500, color: "var(--ink)" }}>{hypothesis.proposedMeaning}</p>
                  <p className="small muted">
                    {hypothesis.simulated ? "Simulated. The file was not inspected." : "Model hypothesis. Not verified."}
                    {hypothesis.missingInformation ? ` ${hypothesis.missingInformation}` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}

          {state.ai.mode === "openai" ? (
            <label className="row small" style={{ cursor: "pointer" }}>
              <input type="checkbox" checked={shareWithModel} onChange={(event) => setShareWithModel(event.target.checked)} />
              Send written descriptions that already have analysis consent. Media files are not sent.
            </label>
          ) : null}
        </section>
      ) : (
        <Notice>You will see the instruction for an approved check. The expected answers stay with the facilitator.</Notice>
      )}

      <div className="split-aside">
        <div className="stack">
          {current ? (
            <CheckDetail
              proposal={current}
              facilitator={facilitator}
              viewerId={viewerId}
              pending={pending}
              prompt={prompt}
              draft={draft}
              setPrompt={setPrompt}
              setDraft={setDraft}
              onAct={act}
              onSelect={setSelected}
              proposals={proposals}
            />
          ) : (
            <EmptyState
              icon={FlaskConical}
              title="No check active yet"
              description={facilitator ? "Use Ask for a check above once open readings exist." : "Waiting for the facilitator to approve a check instruction."}
            />
          )}
        </div>

        <aside className="surface stack">
          <h2>Timeline</h2>
          {!timeline.length ? <p className="small muted">Nothing has been recorded in this session yet.</p> : null}
          <ol className="timeline">
            {timeline.map((item) => (
              <li key={item.id}>
                <strong className="small" style={{ color: "var(--ink)" }}>{item.label}</strong>
                <span>{item.detail}</span>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  );
}

function CheckDetail({
  proposal,
  proposals,
  facilitator,
  viewerId,
  pending,
  prompt,
  draft,
  setPrompt,
  setDraft,
  onAct,
  onSelect,
}: {
  proposal: ProposalDTO;
  proposals: ProposalDTO[];
  facilitator: boolean;
  viewerId: string;
  pending: boolean;
  prompt: string;
  draft: string;
  setPrompt: (value: string) => void;
  setDraft: (value: string) => void;
  onAct: (body: Record<string, unknown>) => Promise<void>;
  onSelect: (id: string) => void;
}) {
  const own = proposal.replies.find((reply) => reply.participantId === viewerId);
  const meanings = [...new Set(proposal.planOutcomes.flatMap((item) => item.expectedUnder.map((cell) => cell.meaning)))];

  return (
    <section className="surface stack-lg">
      <div className="row-between">
        <div className="stack-xs">
          <p className="eyebrow">{EXPERIMENT_LABEL[proposal.experimentType] || proposal.experimentType}</p>
          <h2>{proposal.title || EXPERIMENT_LABEL[proposal.experimentType] || "Check"}</h2>
        </div>
        <StatusText status={proposal.status} pill />
      </div>

      {proposals.length > 1 ? (
        <Field label="Compare another recommendation">
          <select className="select" value={proposal.id} onChange={(event) => onSelect(event.target.value)}>
            {proposals.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title || item.experimentType}{item.quality.length ? ` — ${item.heuristicScore} of 8` : ""}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      {facilitator ? (
        <div className="surface-recessed stack-xs" style={{ padding: 14 }}>
          <p className="small" style={{ fontWeight: 500, color: "var(--ink)" }}>{provenanceLabel(proposal.source, proposal.simulated)}</p>
          {proposal.reviewState === "draft" ? (
            <p className="small">Draft. A facilitator needs to review this before treating it as a distinguishing check. The examples are not tied to each reading.</p>
          ) : null}
          {proposal.reviewState === "ready" ? (
            <p className="small">Each listed result names the example that reading predicts. This is still not session verification.</p>
          ) : null}
          {proposal.qualityWeak ? <p className="small" style={{ color: "var(--disputed)" }}>This recommendation is weak. The notes under the checklist say which checks failed.</p> : null}
          {proposal.providerNote ? <p className="small muted">{proposal.providerNote}</p> : null}
        </div>
      ) : null}

      {proposal.prompt ? (
        <div className="surface-accent stack-xs" style={{ padding: 16 }}>
          <p className="small" style={{ color: "var(--ink)" }}><strong>Instruction. </strong>{proposal.prompt}</p>
        </div>
      ) : null}

      {facilitator && (proposal.rationale || proposal.procedure || proposal.remainingAmbiguity || proposal.limitations) ? (
        <div className="stack-xs">
          {proposal.rationale ? <p className="small" style={{ color: "var(--ink)" }}>{proposal.rationale}</p> : null}
          {proposal.remainingAmbiguity ? <p className="small"><strong>Still unresolved:</strong> {proposal.remainingAmbiguity}</p> : null}
          {proposal.procedure ? <p className="small">{proposal.procedure}</p> : null}
          {proposal.limitations ? <p className="small muted">{proposal.limitations}</p> : null}
          {proposal.heuristicNote ? <p className="small muted">{proposal.heuristicNote}</p> : null}
          {proposal.evidenceRefs.length ? <p className="small muted">Evidence referred to: {proposal.evidenceRefs.join(", ")}</p> : null}
        </div>
      ) : null}

      {facilitator && proposal.quality.length ? (
        <details className="surface-recessed" style={{ padding: 12 }}>
          <summary className="small" style={{ cursor: "pointer", fontWeight: 500 }}>
            Protocol quality checks ({proposal.heuristicScore} of 8)
          </summary>
          <ul className="stack-xs" style={{ margin: "10px 0 0", paddingLeft: 18 }}>
            {proposal.quality.map((item) => (
              <li key={item.name} className="small">
                <strong>{item.name}: {item.status}.</strong> {item.reason}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {facilitator && proposal.planOutcomes.length ? (
        <div className="matrix-wrap">
          <table className="matrix">
            <caption className="small muted" style={{ padding: "10px 14px", textAlign: "left" }}>
              Expected answers in this plan. Not a record of what the expression means.
            </caption>
            <thead>
              <tr>
                <th>Reading</th>
                {proposal.planOutcomes.map((item) => <th key={item.outcome}>{item.outcome}</th>)}
              </tr>
            </thead>
            <tbody>
              {meanings.map((meaning) => (
                <tr key={meaning}>
                  <th scope="row">{meaning}</th>
                  {proposal.planOutcomes.map((item) => {
                    const cell = item.expectedUnder.find((entry) => entry.meaning === meaning);
                    return (
                      <td key={item.outcome}>
                        {cell?.expectation ?? "Not stated."} {item.distinguishes ? "" : "This result would still be ambiguous."}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {facilitator && proposal.status === "proposed" ? (
        <div className="surface-recessed stack">
          <Field label="Neutral prompt">
            <textarea className="textarea" value={prompt || proposal.prompt} onChange={(event) => setPrompt(event.target.value)} maxLength={800} rows={3} />
          </Field>
          <div className="row">
            <button type="button" className="btn btn-sm" disabled={pending} onClick={() => void onAct({ action: "edit", proposalId: proposal.id, prompt: prompt || proposal.prompt })}>
              Save the prompt
            </button>
            <button type="button" className="btn btn-sm btn-primary" disabled={pending} onClick={() => void onAct({ action: "approve", proposalId: proposal.id })}>
              <Check size={14} strokeWidth={1.5} aria-hidden="true" />
              Approve and show the neutral prompt
            </button>
            <button type="button" className="btn btn-sm btn-ghost" disabled={pending} onClick={() => void onAct({ action: "reject", proposalId: proposal.id })}>
              Set this aside
            </button>
          </div>
        </div>
      ) : null}

      {proposal.status === "approved" ? (
        <form
          className="surface-recessed stack"
          onSubmit={(event) => {
            event.preventDefault();
            void onAct({ action: "reply", proposalId: proposal.id, body: draft, stance: "unsure" });
          }}
        >
          <div className="row-between">
            <h3>Independent response</h3>
            {own?.lockedAt ? (
              <span className="status-pill" data-tone="verified">
                <Lock size={12} strokeWidth={1.5} aria-hidden="true" />
                Locked
              </span>
            ) : null}
          </div>
          <Field label="Your response">
            <textarea className="textarea" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={2000} rows={3} required />
          </Field>
          <div className="row">
            <button className="btn btn-sm" type="submit" disabled={pending || !draft.trim()}>Save my response</button>
            <button type="button" className="btn btn-sm" disabled={pending} onClick={() => void onAct({ action: "reply", proposalId: proposal.id, body: draft || own?.body || "It matches.", stance: "matches" })}>
              It matches
            </button>
            <button type="button" className="btn btn-sm" disabled={pending} onClick={() => void onAct({ action: "reply", proposalId: proposal.id, body: draft || own?.body || "It does not match.", stance: "differs" })}>
              It does not match
            </button>
            <button type="button" className="btn btn-sm" disabled={pending} onClick={() => void onAct({ action: "reply", proposalId: proposal.id, body: draft || own?.body || "We disagree.", stance: "disagree" })}>
              We disagree
            </button>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              aria-busy={pending}
              disabled={pending || Boolean(own?.lockedAt) || !(draft.trim() || own?.body)}
              onClick={() => void onAct({ action: "lock", proposalId: proposal.id })}
            >
              <Lock size={14} strokeWidth={1.5} aria-hidden="true" />
              {own?.lockedAt ? "Response locked" : "Lock my response"}
            </button>
          </div>
        </form>
      ) : null}

      {proposal.replies.length ? (
        <div className="stack-sm">
          <h3>Responses</h3>
          <div className="grid-2">
            {proposal.replies.map((reply) => (
              <div key={reply.participantId} className={reply.hidden ? "reply-sealed row" : "reply-open stack-xs"}>
                {reply.hidden ? <EyeOff size={14} strokeWidth={1.5} className="muted" aria-hidden="true" /> : null}
                <p className="small" style={{ color: "var(--ink)" }}>
                  {reply.hidden ? "Locked. Hidden until both responses are in." : `${reply.stance || "response"}: ${reply.body}`}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {facilitator && proposal.planOutcomes.length ? (
        <div className="stack block">
          <h3>Compare with the plan</h3>
          <div className="row">
            {proposal.planOutcomes.map((item) => (
              <button key={item.outcome} type="button" className="btn btn-sm" disabled={pending} onClick={() => void onAct({ action: "record", proposalId: proposal.id, outcome: item.outcome })}>
                {item.outcome}
              </button>
            ))}
          </div>
          {proposal.review ? (
            <div className="surface-recessed stack-xs" style={{ padding: 14 }}>
              <p className="small" style={{ color: "var(--ink)" }}>
                <strong>Still possible:</strong> {proposal.review.stillPossible.join("; ") || "The plan did not name a remaining reading."}
              </p>
              <p className="small">{proposal.review.supports}</p>
              <p className="small">{proposal.review.weakens}</p>
              <p className="small">{proposal.review.remainingAmbiguity}</p>
              <p className="small muted">{proposal.review.nextStep}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
