"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Eraser, EyeOff, Lock, Sparkles, Unlock } from "lucide-react";
import { useSessionContext } from "@/components/session/provider";
import { CopyCodeButton, Field, Notice, PageHeader, StatusText } from "@/components/ui/bits";
import { MotionReveal } from "@/components/ui/motion";
import { api, ApiError } from "@/lib/client/api";
import { SCENARIO_TEMPLATES, SCENARIO_STEPS, STEP_LABEL, type ScenarioStep } from "@/lib/community/scenarios";
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
    <div className="wrap page-pad stack-lg">
      <PageHeader
        eyebrow="Guided two-seat protocol"
        title="Community access"
        description="Show something. Let the other person answer before either of you reads a suggestion. A match between you is a session record, not proof of a word."
        actions={<CopyCodeButton code={code} />}
      />

      <ShareCard code={code} />

      {message ? <Notice tone="error">{message}</Notice> : null}

      {task ? (
        <TaskSteps
          task={task}
          proposals={state.proposals.filter((item) => item.taskId === task.id)}
          pending={pending}
          onAct={act}
        />
      ) : null}

      <section className="stack">
        <div className="row-between">
          <div className="stack-xs">
            <h2>Choose a situation</h2>
            <p className="small">Start a new guided exchange from an everyday communication situation.</p>
          </div>
          {state.tasks.length > 1 ? (
            <Field label="Recent tasks">
              <select className="select" value={task?.id ?? ""} onChange={(event) => setTaskId(event.target.value)}>
                {state.tasks.map((item) => (
                  <option key={item.id} value={item.id}>{item.title} ({STEP_LABEL[item.step as ScenarioStep] ?? item.step})</option>
                ))}
              </select>
            </Field>
          ) : null}
        </div>
        <div className="tile-grid">
          {SCENARIO_TEMPLATES.map((item) => {
            const active = task?.templateId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={active ? "btn tile is-selected" : "btn tile"}
                disabled={pending}
                onClick={() => act({ action: "create-task", templateId: item.id })}
              >
                <span className="small muted">{item.category}</span>
                <strong>{item.title}</strong>
              </button>
            );
          })}
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
    void import("qrcode")
      .then((qr) => qr.toString(url, { type: "svg", margin: 1, width: 120 }))
      .then((markup) => {
        if (!cancelled) setSvg(markup);
      })
      .catch(() => setSvg(""));
    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <section className="surface row-between" style={{ gap: 20 }}>
      <div className="stack-xs" style={{ maxWidth: "42rem" }}>
        <p className="small muted">Share this code. The other person joins from their own browser.</p>
        <div className="row" style={{ gap: 12 }}>
          <span className="share-code mono">{code}</span>
          <CopyCodeButton code={code} compact />
        </div>
        <p className="small">
          The facilitator guides the steps. The participant is the other person. Neither role decides what an expression means.
        </p>
      </div>
      {svg ? (
        <div
          aria-label={`QR invitation for ${code}`}
          style={{ background: "#ffffff", padding: 8, borderRadius: "var(--radius)", border: "1px solid var(--line)" }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : null}
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
  const stepIndex = SCENARIO_STEPS.indexOf(step);
  const responses = (state?.responses ?? []).filter((item) => item.taskId === task.id);
  const mine = responses.find((item) => item.authorParticipantId === identity?.participantId);
  const template = SCENARIO_TEMPLATES.find((item) => item.id === task.templateId);
  const facilitator = state?.session.purpose !== "community" || identity?.role === "A" || state?.viewer?.communityRole === "facilitator";

  return (
    <MotionReveal className="surface stack-lg">
      <section className="stack" aria-labelledby="task-title">
        <div className="row-between">
          <div className="stack-xs">
            <p className="eyebrow">{task.category}</p>
            <h2 id="task-title">{task.title}</h2>
          </div>
          {task.outcome ? <StatusText status={task.outcome} pill /> : <span className="status-pill">{STEP_LABEL[step]}</span>}
        </div>

        <ol className="steps" aria-label="Steps">
          {(Object.keys(STEP_LABEL) as ScenarioStep[]).map((item, idx) => (
            <li key={item} aria-current={item === step ? "step" : undefined} data-done={idx < stepIndex ? "true" : undefined}>
              <span className="mono" style={{ fontSize: 11 }}>{String(idx + 1).padStart(2, "0")}</span>
              <span>{STEP_LABEL[item]}</span>
            </li>
          ))}
        </ol>

        {step === "show" ? (
          <div className="surface-recessed stack">
            <h3>1. Show the expression</h3>
            <p className="small" style={{ color: "var(--ink)" }}>{template?.show}</p>
            <Field label="Gesture or picture note, if you want one">
              <input className="control" value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} placeholder="Optional note on what was shown" />
            </Field>
            <div className="row">
              <button type="button" className="btn btn-primary" disabled={pending} onClick={() => onAct({ action: "show", taskId: task.id, note })}>
                I showed it
              </button>
            </div>
          </div>
        ) : null}

        {step === "respond" || step === "show" ? (
          <div className="surface-recessed stack">
            <div className="row-between">
              <h3>2. Independent response</h3>
              {mine?.lockedAt ? (
                <span className="status-pill" data-tone="verified">
                  <Lock size={12} strokeWidth={1.5} aria-hidden="true" />
                  Locked
                </span>
              ) : (
                <span className="status-pill">Private until locked</span>
              )}
            </div>
            <p className="small" style={{ color: "var(--ink)" }}>{template?.respond}</p>
            <MarkPad onChange={(path) => { setKind("drawing"); setBody(path); }} />
            <Field label="Short reading, if a drawing is not enough">
              <input
                className="control"
                value={kind === "drawing" ? "" : body}
                onChange={(event) => {
                  setKind("interpretation");
                  setBody(event.target.value);
                }}
                maxLength={4000}
                placeholder="Write what you understood"
              />
            </Field>
            <div className="row">
              <button
                type="button"
                className="btn"
                disabled={pending || !body.trim() || Boolean(mine?.lockedAt)}
                onClick={() => onAct({ action: "respond", taskId: task.id, kind, body })}
              >
                Save my response
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={pending || Boolean(mine?.lockedAt)}
                onClick={async () => {
                  if (body.trim() && !mine?.lockedAt) await onAct({ action: "respond", taskId: task.id, kind, body });
                  await onAct({ action: "lock", taskId: task.id });
                }}
              >
                <Lock size={15} strokeWidth={1.5} aria-hidden="true" />
                Lock my response
              </button>
            </div>
            {mine?.hidden ? null : mine ? (
              <p className="small muted">Your saved response{mine.lockedAt ? " is locked" : " is still private"}.</p>
            ) : null}
          </div>
        ) : null}

        {step === "compare" || step === "ambiguity" || step === "test" || step === "outcome" ? (
          <div className="stack">
            <div className="row" style={{ gap: 8 }}>
              <Unlock size={16} strokeWidth={1.5} style={{ color: "var(--oxide)" }} aria-hidden="true" />
              <h3>What each person locked</h3>
            </div>
            <div className="grid-2">
              {responses.map((response, idx) => (
                <div key={response.id} className={response.hidden ? "reply-sealed stack-xs" : "reply-open stack-xs"}>
                  <div className="row-between">
                    <span className="mono small muted">Seat {idx + 1}</span>
                    {response.hidden ? <EyeOff size={14} strokeWidth={1.5} className="muted" aria-hidden="true" /> : null}
                  </div>
                  <p className="small" style={{ color: "var(--ink)" }}>
                    {response.hidden ? "Locked. Hidden until both responses are in." : response.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {step === "compare" || step === "ambiguity" ? (
          <div className="surface-recessed stack">
            <h3>3. Name what remains unresolved</h3>
            <p className="small">Name what the two responses do not settle. You can use the ready note.</p>
            <div className="row">
              <button
                type="button"
                className="btn"
                disabled={pending}
                onClick={() => onAct({ action: "ambiguity", taskId: task.id, note: "The object, the action, and the request are still possible." })}
              >
                The object and the action are both possible
              </button>
            </div>
            <Field label="Or write what is unclear">
              <input className="control" value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} />
            </Field>
            <div>
              <button type="button" className="btn btn-primary" disabled={pending || !note.trim()} onClick={() => onAct({ action: "ambiguity", taskId: task.id, note })}>
                Save that ambiguity
              </button>
            </div>
          </div>
        ) : null}

        {step === "ambiguity" || step === "test" || step === "outcome" ? (
          <div className="stack">
            <div className="row-between">
              <h3>4. Discrimination check</h3>
              <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={() => onAct({ action: "propose", taskId: task.id })}>
                <Sparkles size={14} strokeWidth={1.5} aria-hidden="true" />
                Suggest a check
              </button>
            </div>
            {proposals.map((proposal) => (
              <article key={proposal.id} className="surface-recessed stack">
                <div className="row-between">
                  {proposal.title ? <h4>{proposal.title}</h4> : <h4>Proposed check</h4>}
                  <StatusText status={proposal.status} pill />
                </div>
                <p className="small" style={{ color: "var(--ink)", fontWeight: 500 }}>{proposal.prompt}</p>
                <p className="small">{proposal.rationale}</p>
                <p className="small muted">{proposal.missing}</p>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Outcome</th>
                        <th>Supports</th>
                        <th>Weakens</th>
                      </tr>
                    </thead>
                    <tbody>
                      {proposal.outcomes.map((item) => (
                        <tr key={item.outcome}>
                          <td><strong>{item.outcome}</strong></td>
                          <td>{item.supports}</td>
                          <td>{item.weakens}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="small muted">{proposal.disclaimer} Source: {proposal.source}.</p>
                {proposal.status === "proposed" && facilitator ? (
                  <div>
                    <button type="button" className="btn btn-primary" disabled={pending} onClick={() => onAct({ action: "approve", proposalId: proposal.id })}>
                      <Check size={15} strokeWidth={1.5} aria-hidden="true" />
                      Approve this check
                    </button>
                  </div>
                ) : null}
                {proposal.status === "approved" ? (
                  <Notice tone="info">Approved. Nothing was marked session-verified by this approval.</Notice>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}

        {step === "test" || step === "outcome" ? (
          <div className="stack-sm block">
            <h3>5. Record the round outcome</h3>
            <div className="row">
              <button type="button" className="btn btn-primary" disabled={pending} onClick={() => onAct({ action: "outcome", taskId: task.id, outcome: "understood" })}>
                Understood for now
              </button>
              <button type="button" className="btn" disabled={pending} onClick={() => onAct({ action: "outcome", taskId: task.id, outcome: "unclear" })}>
                Still unclear
              </button>
              <button type="button" className="btn" disabled={pending} onClick={() => onAct({ action: "outcome", taskId: task.id, outcome: "another-round" })}>
                Another round
              </button>
            </div>
          </div>
        ) : null}

        {task.outcome ? (
          <Notice tone={task.outcome === "understood" ? "success" : "info"}>
            Recorded outcome: {task.outcome}. {task.outcomeNote}
          </Notice>
        ) : null}
      </section>
    </MotionReveal>
  );
}

function MarkPad({ onChange }: { onChange: (path: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const points = useRef<string[]>([]);
  const [hasMark, setHasMark] = useState(false);

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = ref.current;
    if (!canvas) return { x: 0, y: 0 };
    const box = canvas.getBoundingClientRect();
    const scaleX = canvas.width / Math.max(1, box.width);
    const scaleY = canvas.height / Math.max(1, box.height);
    return {
      x: Math.round((event.clientX - box.left) * scaleX),
      y: Math.round((event.clientY - box.top) * scaleY),
    };
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    const { x, y } = point(event);
    points.current.push(`${x},${y}`);
    const ctx = ref.current?.getContext("2d");
    if (ctx) {
      ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim() || "#1d1915";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
    setHasMark(true);
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

  function clear() {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    points.current = [];
    setHasMark(false);
    onChange("");
  }

  return (
    <div className="stack-xs">
      <div className="row-between">
        <span className="small muted">Sketch response pad</span>
        {hasMark ? (
          <button type="button" className="btn btn-sm btn-ghost" onClick={clear}>
            <Eraser size={14} strokeWidth={1.5} aria-hidden="true" />
            Clear pad
          </button>
        ) : null}
      </div>
      <canvas
        ref={ref}
        className="mark"
        width={640}
        height={180}
        aria-label="Draw a response"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={() => { drawing.current = false; }}
        onPointerLeave={() => { drawing.current = false; }}
      />
    </div>
  );
}
