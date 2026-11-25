"use client";

import { useMemo, useState } from "react";
import { useSessionContext } from "@/components/session/provider";
import { Field, Notice } from "@/components/ui/bits";
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
    <div className="wrap section stack">
      <header className="stack-sm">
        <p className="eyebrow">Experiment checks</p>
        <h1>What could still be true</h1>
        <p>A check is a way to tell two readings apart. It does not choose the meaning, and one result cannot session-verify it.</p>
      </header>

      {facilitator ? (
        <section className="stack">
          <h2>Open readings</h2>
          {!state.hypotheses.length ? <p>No hypotheses are on record yet. Add evidence and ask for readings before designing a check.</p> : null}
          {state.hypotheses.map((hypothesis) => (
            <p key={hypothesis.id}>
              <strong>{hypothesis.proposedMeaning}</strong>
              <span className="small muted"> {hypothesis.simulated ? "Simulated. The file was not inspected." : "Model hypothesis. Not verified."} {hypothesis.missingInformation}</span>
            </p>
          ))}
          {state.ai.mode === "openai" ? (
            <label className="row">
              <input type="checkbox" checked={shareWithModel} onChange={(event) => setShareWithModel(event.target.checked)} />
              Send written descriptions that already have analysis consent. Media files are not sent.
            </label>
          ) : null}
          <div className="row">
            <button type="button" className="btn btn-primary" disabled={pending} onClick={() => void act({ action: "request", shareWithModel })}>{pending ? "Asking for a check…" : "Ask for a check"}</button>
            <button type="button" className="btn" disabled={pending} onClick={() => void act({ action: "request", followUp: true, shareWithModel })}>Ask for a follow-up</button>
          </div>
        </section>
      ) : (
        <p>You will see the instruction for an approved check. The expected answers stay with the facilitator.</p>
      )}

      {current ? <CheckDetail proposal={current} facilitator={facilitator} viewerId={viewerId} pending={pending} prompt={prompt} draft={draft} setPrompt={setPrompt} setDraft={setDraft} onAct={act} onSelect={setSelected} proposals={proposals} /> : null}

      <section className="stack">
        <h2>Timeline</h2>
        {!timeline.length ? <p>Nothing has been recorded in this session yet.</p> : null}
        <ol className="timeline">
          {timeline.map((item) => (
            <li key={item.id}>
              <strong>{item.label}</strong>
              <span>{item.detail}</span>
            </li>
          ))}
        </ol>
      </section>
      {message ? <Notice>{message}</Notice> : null}
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
    <section className="stack">
      <h2>{proposal.title || EXPERIMENT_LABEL[proposal.experimentType] || "Check"}</h2>
      {proposals.length > 1 ? (
        <label className="stack-sm">Compare another recommendation
          <select className="select" value={proposal.id} onChange={(event) => onSelect(event.target.value)}>
            {proposals.map((item) => <option key={item.id} value={item.id}>{item.title || item.experimentType}{item.quality.length ? ` — ${item.heuristicScore} of 8` : ""}</option>)}
          </select>
        </label>
      ) : null}
      {facilitator ? <p><strong>{provenanceLabel(proposal.source, proposal.simulated)}</strong></p> : null}
      {facilitator && proposal.reviewState === "draft" ? <p>Draft. A facilitator needs to review this before treating it as a distinguishing check. The examples are not tied to each reading.</p> : null}
      {facilitator && proposal.reviewState === "ready" ? <p className="small">Each listed result names the example that reading predicts. This is still not session verification.</p> : null}
      {facilitator && proposal.qualityWeak ? <p>This recommendation is weak. The notes under the checklist say which checks failed.</p> : null}
      {facilitator && proposal.providerNote ? <p>{proposal.providerNote}</p> : null}
      {facilitator && proposal.rationale ? <p>{proposal.rationale}</p> : null}
      {facilitator && proposal.remainingAmbiguity ? <p>Still unresolved: {proposal.remainingAmbiguity}</p> : null}
      {proposal.prompt ? <p><strong>Instruction. </strong>{proposal.prompt}</p> : null}
      {facilitator && proposal.procedure ? <p>{proposal.procedure}</p> : null}
      {facilitator && proposal.limitations ? <p className="small">{proposal.limitations}</p> : null}
      {facilitator && proposal.heuristicNote ? <p className="small muted">{proposal.heuristicNote}</p> : null}
      {facilitator && proposal.quality.length ? (
        <ul>
          {proposal.quality.map((item) => <li key={item.name}><strong>{item.name}: {item.status}.</strong> {item.reason}</li>)}
        </ul>
      ) : null}
      {facilitator && proposal.evidenceRefs.length ? <p className="small">Evidence referred to: {proposal.evidenceRefs.join(", ")}</p> : null}

      {facilitator && proposal.planOutcomes.length ? (
        <div className="matrix-wrap">
          <table className="matrix">
            <caption className="small">Expected answers in this plan. Not a record of what the expression means.</caption>
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
                    return <td key={item.outcome}>{cell?.expectation ?? "Not stated."} {item.distinguishes ? "" : "This result would still be ambiguous."}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {facilitator && proposal.status === "proposed" ? (
        <div className="stack">
          <Field label="Neutral prompt">
            <textarea className="control" value={prompt || proposal.prompt} onChange={(event) => setPrompt(event.target.value)} maxLength={800} rows={3} />
          </Field>
          <div className="row">
            <button type="button" className="btn" disabled={pending} onClick={() => void onAct({ action: "edit", proposalId: proposal.id, prompt: prompt || proposal.prompt })}>Save the prompt</button>
            <button type="button" className="btn btn-primary" disabled={pending} onClick={() => void onAct({ action: "approve", proposalId: proposal.id })}>Approve and show the neutral prompt</button>
            <button type="button" className="btn" disabled={pending} onClick={() => void onAct({ action: "reject", proposalId: proposal.id })}>Set this aside</button>
          </div>
        </div>
      ) : null}

      {proposal.status === "approved" ? (
        <form className="stack" onSubmit={(event) => { event.preventDefault(); void onAct({ action: "reply", proposalId: proposal.id, body: draft, stance: "unsure" }); }}>
          <Field label="Your response">
            <textarea className="control" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={2000} rows={3} required />
          </Field>
          <div className="row">
            <button className="btn" type="submit" disabled={pending || !draft.trim()}>Save my response</button>
            <button type="button" className="btn" disabled={pending} onClick={() => void onAct({ action: "reply", proposalId: proposal.id, body: draft || own?.body || "It matches.", stance: "matches" })}>It matches</button>
            <button type="button" className="btn" disabled={pending} onClick={() => void onAct({ action: "reply", proposalId: proposal.id, body: draft || own?.body || "It does not match.", stance: "differs" })}>It does not match</button>
            <button type="button" className="btn" disabled={pending} onClick={() => void onAct({ action: "reply", proposalId: proposal.id, body: draft || own?.body || "We disagree.", stance: "disagree" })}>We disagree</button>
            <button type="button" className="btn btn-primary" disabled={pending || !(draft.trim() || own?.body)} onClick={() => void onAct({ action: "lock", proposalId: proposal.id })}>Lock my response</button>
          </div>
        </form>
      ) : null}

      {proposal.replies.length ? (
        <div className="stack">
          <h3>Responses</h3>
          {proposal.replies.map((reply) => (
            <p key={reply.participantId}>{reply.hidden ? "Locked. Hidden until both responses are in." : `${reply.stance || "response"}: ${reply.body}`}</p>
          ))}
        </div>
      ) : null}

      {facilitator && proposal.planOutcomes.length ? (
        <div className="stack">
          <h3>Compare with the plan</h3>
          <div className="row">
            {proposal.planOutcomes.map((item) => (
              <button key={item.outcome} type="button" className="btn" disabled={pending} onClick={() => void onAct({ action: "record", proposalId: proposal.id, outcome: item.outcome })}>{item.outcome}</button>
            ))}
          </div>
          {proposal.review ? (
            <div className="stack-sm">
              <p>Still possible: {proposal.review.stillPossible.join("; ") || "The plan did not name a remaining reading."}</p>
              <p>{proposal.review.supports}</p>
              <p>{proposal.review.weakens}</p>
              <p>{proposal.review.remainingAmbiguity}</p>
              <p>{proposal.review.nextStep}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
