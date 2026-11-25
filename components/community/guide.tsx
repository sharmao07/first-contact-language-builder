"use client";

import { useEffect, useRef, useState } from "react";
import { useSessionContext } from "@/components/session/provider";
import { Notice } from "@/components/ui/bits";
import { api, ApiError } from "@/lib/client/api";
import { SCENARIO_TEMPLATES, STEP_LABEL, type ScenarioStep } from "@/lib/community/scenarios";
import type { ProposalDTO, TaskDTO } from "@/lib/types";

export function CommunityGuide() {
  const { code, state, identity, reload } = useSessionContext();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [taskId, setTaskId] = useState<string>("");
  if (!state || !identity) return null;
  const token = identity.token;
  const task = state.tasks.find((item) => item.id === taskId) ?? state.tasks[0] ?? null;

  async function act(body: Record<string, unknown>) {
    setPending(true);
    setMessage(null);
    try {
      const result = await api<{ taskId?: string }>(`/api/sessions/${code}/community`, { token, body });
      if (result.taskId) setTaskId(result.taskId);
      await reload();
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : "That step was not saved.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="wrap section stack">
      <ShareCard code={code} />
      <div className="stack-sm">
        <h1>Community access</h1>
        <p>Show something. Let the other person answer before either of you reads a suggestion. A match between you is a session record, not proof of a word.</p>
      </div>
      {message ? <Notice>{message}</Notice> : null}
      {task ? <TaskSteps task={task} proposals={state.proposals.filter((item) => item.taskId === task.id)} pending={pending} onAct={act} /> : null}
      <section className="stack">
        <h2>Choose a situation</h2>
        <div className="tile-grid">
          {SCENARIO_TEMPLATES.map((item) => (
            <button key={item.id} type="button" className="btn tile" disabled={pending} onClick={() => act({ action: "create-task", templateId: item.id })}>
              <strong>{item.title}</strong>
              <span className="small muted">{item.category}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function ShareCard({ code }: { code: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    const url = `${window.location.origin}/start?code=${code}`;
    let cancelled = false;
    void import("qrcode").then((qr) => qr.toString(url, { type: "svg", margin: 1, width: 180 })).then((markup) => {
      if (!cancelled) setSvg(markup);
    }).catch(() => setSvg(""));
    return () => { cancelled = true; };
  }, [code]);
  return (
    <section className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
      <div className="stack-sm">
        <p className="small muted">Share this code. The other person joins from their own browser.</p>
        <p className="share-code mono">{code}</p>
        <p className="small">The facilitator guides the steps. The participant is the other person. Neither role decides what an expression means.</p>
      </div>
      {svg ? <div aria-label={`QR invitation for ${code}`} dangerouslySetInnerHTML={{ __html: svg }} /> : null}
    </section>
  );
}

function TaskSteps({
  task,
  proposals,
  pending,
  onAct,
}: {
  task: TaskDTO;
  proposals: ProposalDTO[];
  pending: boolean;
  onAct: (body: Record<string, unknown>) => Promise<void>;
}) {
  const { state, identity } = useSessionContext();
  const [note, setNote] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<"interpretation" | "drawing">("interpretation");
  const step = task.step as ScenarioStep;
  const responses = (state?.responses ?? []).filter((item) => item.taskId === task.id);
  const mine = responses.find((item) => item.authorParticipantId === identity?.participantId);
  const template = SCENARIO_TEMPLATES.find((item) => item.id === task.templateId);
  const facilitator = state?.session.purpose !== "community" || identity?.role === "A" || state?.viewer?.communityRole === "facilitator";

  return (
    <section className="stack" aria-labelledby="task-title">
      <p className="small muted">{task.category}</p>
      <h2 id="task-title">{task.title}</h2>
      <ol className="steps" aria-label="Steps">
        {(Object.keys(STEP_LABEL) as ScenarioStep[]).map((item) => (
          <li key={item} aria-current={item === step ? "step" : undefined}>{STEP_LABEL[item]}</li>
        ))}
      </ol>
      {step === "show" ? (
        <div className="stack">
          <p>{template?.show}</p>
          <label className="stack-sm">Gesture or picture note, if you want one
            <input className="control" value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} />
          </label>
          <button type="button" className="btn btn-primary" disabled={pending} onClick={() => onAct({ action: "show", taskId: task.id, note })}>I showed it</button>
        </div>
      ) : null}
      {step === "respond" || step === "show" ? (
        <div className="stack">
          <p>{template?.respond}</p>
          <MarkPad onChange={(path) => { setKind("drawing"); setBody(path); }} />
          <label className="stack-sm">Short reading, if a drawing is not enough
            <input className="control" value={kind === "drawing" ? "" : body} onChange={(event) => { setKind("interpretation"); setBody(event.target.value); }} maxLength={4000} />
          </label>
          <div className="row">
            <button type="button" className="btn" disabled={pending || !body.trim() || Boolean(mine?.lockedAt)} onClick={() => onAct({ action: "respond", taskId: task.id, kind, body })}>Save my response</button>
            <button type="button" className="btn btn-primary" disabled={pending || Boolean(mine?.lockedAt)} onClick={async () => {
              if (body.trim() && !mine?.lockedAt) await onAct({ action: "respond", taskId: task.id, kind, body });
              await onAct({ action: "lock", taskId: task.id });
            }}>Lock my response</button>
          </div>
          {mine?.hidden ? null : mine ? <p className="small">Your saved response{mine.lockedAt ? " is locked" : " is still private"}.</p> : null}
        </div>
      ) : null}
      {step === "compare" || step === "ambiguity" || step === "test" || step === "outcome" ? (
        <div className="stack">
          <h3>What each person locked</h3>
          {responses.map((response) => (
            <p key={response.id} className="rule">
              {response.hidden ? "Locked. Hidden until both responses are in." : response.body}
            </p>
          ))}
        </div>
      ) : null}
      {step === "compare" || step === "ambiguity" ? (
        <div className="stack">
          <p>Name what the two responses do not settle. You can use the ready note.</p>
          <button type="button" className="btn" disabled={pending} onClick={() => onAct({ action: "ambiguity", taskId: task.id, note: "The object, the action, and the request are still possible." })}>The object and the action are both possible</button>
          <label className="stack-sm">Or write what is unclear
            <input className="control" value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} />
          </label>
          <button type="button" className="btn" disabled={pending || !note.trim()} onClick={() => onAct({ action: "ambiguity", taskId: task.id, note })}>Save that ambiguity</button>
        </div>
      ) : null}
      {step === "ambiguity" || step === "test" || step === "outcome" ? (
        <div className="stack">
          <button type="button" className="btn btn-primary" disabled={pending} onClick={() => onAct({ action: "propose", taskId: task.id })}>Suggest a check</button>
          {proposals.map((proposal) => (
            <article key={proposal.id} className="stack rule">
              {proposal.title ? <h3>{proposal.title}</h3> : null}
              <p>{proposal.prompt}</p>
              <p className="small">{proposal.rationale}</p>
              <p className="small muted">{proposal.missing}</p>
              <ul>
                {proposal.outcomes.map((item) => (
                  <li key={item.outcome}><strong>{item.outcome}</strong> Supports {item.supports} Weakens {item.weakens}</li>
                ))}
              </ul>
              <p className="small">{proposal.disclaimer} Source: {proposal.source}.</p>
              {proposal.status === "proposed" && facilitator ? (
                <button type="button" className="btn btn-primary" disabled={pending} onClick={() => onAct({ action: "approve", proposalId: proposal.id })}>Approve this check</button>
              ) : null}
              {proposal.status === "approved" ? <p className="small">Approved. Nothing was marked session-verified by this approval.</p> : null}
            </article>
          ))}
        </div>
      ) : null}
      {step === "test" || step === "outcome" ? (
        <div className="row">
          <button type="button" className="btn btn-primary" disabled={pending} onClick={() => onAct({ action: "outcome", taskId: task.id, outcome: "understood" })}>Understood for now</button>
          <button type="button" className="btn" disabled={pending} onClick={() => onAct({ action: "outcome", taskId: task.id, outcome: "unclear" })}>Still unclear</button>
          <button type="button" className="btn" disabled={pending} onClick={() => onAct({ action: "outcome", taskId: task.id, outcome: "another-round" })}>Another round</button>
        </div>
      ) : null}
      {task.outcome ? <p>Recorded outcome: {task.outcome}. {task.outcomeNote}</p> : null}
    </section>
  );
}

function MarkPad({ onChange }: { onChange: (path: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const points = useRef<string[]>([]);

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = ref.current;
    if (!canvas) return { x: 0, y: 0 };
    const box = canvas.getBoundingClientRect();
    return { x: Math.round(event.clientX - box.left), y: Math.round(event.clientY - box.top) };
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    const { x, y } = point(event);
    points.current.push(`${x},${y}`);
    const ctx = ref.current?.getContext("2d");
    ctx?.beginPath();
    ctx?.moveTo(x, y);
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const { x, y } = point(event);
    points.current.push(`${x},${y}`);
    const ctx = ref.current?.getContext("2d");
    ctx?.lineTo(x, y);
    ctx?.stroke();
    onChange(points.current.join(" "));
  }

  return (
    <canvas
      ref={ref}
      className="mark"
      width={640}
      height={180}
      aria-label="Draw a response"
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={() => { drawing.current = false; }}
    />
  );
}
