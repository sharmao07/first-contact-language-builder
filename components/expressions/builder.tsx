"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Rows3 } from "lucide-react";
import { useSessionContext } from "@/components/session/provider";
import { EmptyState, Field, Notice, PageHeader, StatusText } from "@/components/ui/bits";
import { api, ApiError } from "@/lib/client/api";

export function ExpressionBuilder() {
  const { state, identity, code, reload } = useSessionContext();
  const [title, setTitle] = useState("");
  const [gloss, setGloss] = useState("");
  const [orderNote, setOrderNote] = useState("");
  const [grammarNote, setGrammarNote] = useState("");
  const [contextExample, setContextExample] = useState("");
  const [counterexample, setCounterexample] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  if (!state || !identity) return null;
  const concepts = state.concepts.filter((concept) => concept.agreedMeaning && concept.status === "verified");
  const uncertain = state.concepts.filter((concept) => concept.agreedMeaning && concept.status !== "archived" && concept.status !== "verified");

  function toggle(id: string) {
    setPicked((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function move(index: number, direction: -1 | 1) {
    setPicked((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  }

  return (
    <div className="wrap page-pad stack-lg">
      <PageHeader
        eyebrow="Sequential trials"
        title="Expression trials"
        description="Combine meanings this session has verified. The order you try is an experiment. It is not a grammatical rule, and it is not a translation. Unresolved meanings stay off the trial."
      />

      {message ? <Notice>{message}</Notice> : null}

      <div className="split-aside">
        <form
          className="surface stack"
          onSubmit={async (event) => {
            event.preventDefault();
            try {
              await api(`/api/sessions/${code}/expressions`, {
                token: identity.token,
                body: { title, gloss, orderNote, grammarNote, contextExample, counterexample, conceptIds: picked },
              });
              setTitle("");
              setGloss("");
              setPicked([]);
              setMessage("Expression trial saved as a hypothesis.");
              reload();
            } catch (caught) {
              setMessage(caught instanceof ApiError ? caught.message : "The expression was not saved.");
            }
          }}
        >
          <h2>Compose a trial</h2>
          <div className="grid-2">
            <Field label="Trial name"><input className="control" value={title} onChange={(event) => setTitle(event.target.value)} required /></Field>
            <Field label="Gloss" hint="A participant hypothesis about what the sequence might convey. Not a translation.">
              <input className="control" value={gloss} onChange={(event) => setGloss(event.target.value)} />
            </Field>
          </div>
          <Field label="Order note"><input className="control" value={orderNote} onChange={(event) => setOrderNote(event.target.value)} /></Field>
          <Field label="Grammar hypothesis" hint="Keep this separate from verified concepts.">
            <textarea className="textarea" value={grammarNote} onChange={(event) => setGrammarNote(event.target.value)} />
          </Field>
          <div className="grid-2">
            <Field label="Context where this order was tried">
              <input className="control" value={contextExample} onChange={(event) => setContextExample(event.target.value)} />
            </Field>
            <Field label="Counterexample">
              <input className="control" value={counterexample} onChange={(event) => setCounterexample(event.target.value)} />
            </Field>
          </div>

          <div className="stack-xs block">
            <h3>Verified concepts to combine</h3>
            {concepts.length === 0 ? (
              <p className="small muted">No session-verified meanings yet. A trial waits until two people have matched a meaning on different examples and methods.</p>
            ) : (
              <div className="row">
                {concepts.map((concept) => (
                  <label key={concept.id} className={picked.includes(concept.id) ? "btn btn-sm is-selected" : "btn btn-sm"} style={{ cursor: "pointer" }}>
                    <input type="checkbox" checked={picked.includes(concept.id)} onChange={() => toggle(concept.id)} style={{ marginRight: 4 }} />
                    {concept.agreedMeaning}
                  </label>
                ))}
              </div>
            )}
          </div>

          {picked.length > 0 ? (
            <div className="stack-xs">
              <h4>Sequence order</h4>
              {picked.map((id, index) => {
                const concept = concepts.find((item) => item.id === id);
                return (
                  <div key={id} className="surface-recessed row-between" style={{ padding: "8px 12px" }}>
                    <span className="small" style={{ fontWeight: 500, color: "var(--ink)" }}>{index + 1}. {concept?.agreedMeaning}</span>
                    <div className="row" style={{ gap: 4 }}>
                      <button type="button" className="btn btn-sm" onClick={() => move(index, -1)}>
                        <ArrowUp size={13} strokeWidth={1.5} aria-hidden="true" />
                        Move earlier
                      </button>
                      <button type="button" className="btn btn-sm" onClick={() => move(index, 1)}>
                        <ArrowDown size={13} strokeWidth={1.5} aria-hidden="true" />
                        Move later
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {uncertain.length > 0 ? (
            <details className="surface-recessed" style={{ padding: 12 }}>
              <summary className="small muted" style={{ cursor: "pointer" }}>Still uncertain ({uncertain.length}), not available for a trial</summary>
              <div className="stack-xs" style={{ marginTop: 8 }}>
                {uncertain.map((concept) => (
                  <p key={concept.id} className="small">{concept.agreedMeaning} · <StatusText status={concept.status} reason={concept.statusReason} /></p>
                ))}
              </div>
            </details>
          ) : null}

          <div>
            <button className="btn btn-primary" type="submit">Save expression trial</button>
          </div>
        </form>

        <div className="stack">
          <h2>Recorded trials</h2>
          {!state.expressions.length ? (
            <EmptyState icon={Rows3} title="No expression trials yet" description="Combine two or more session-verified meanings on the left." />
          ) : null}
          {state.expressions.map((expression) => (
            <article key={expression.id} className="list-card stack-sm">
              <div className="row-between">
                <h3>{expression.title}</h3>
                <StatusText status={expression.status} pill />
              </div>
              <p style={{ fontWeight: 500 }}>
                {expression.conceptIds.map((id) => state.concepts.find((concept) => concept.id === id)?.agreedMeaning || id).join("  ·  ")}
              </p>
              {expression.gloss ? <p className="small">Gloss hypothesis: {expression.gloss}</p> : null}
              {expression.orderNote ? <p className="small">Order: {expression.orderNote}</p> : null}
              {expression.grammarNote ? <p className="small">Grammar hypothesis: {expression.grammarNote}</p> : null}
              {expression.contextExample ? <p className="small muted">Context: {expression.contextExample}</p> : null}
              {expression.counterexample ? <p className="small muted">Counterexample: {expression.counterexample}</p> : null}
              <div className="row" style={{ paddingTop: 4 }}>
                {(["testing", "understood", "corrected", "hypothesis"] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    className={expression.status === status ? "btn btn-sm is-selected" : "btn btn-sm"}
                    onClick={async () => {
                      await api(`/api/sessions/${code}/expressions/${expression.id}`, { method: "PATCH", token: identity.token, body: { status } });
                      reload();
                    }}
                  >
                    Mark {status}
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
