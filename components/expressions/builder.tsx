"use client";

import { useState } from "react";
import { useSessionContext } from "@/components/session/provider";
import { Field, Notice, StatusText } from "@/components/ui/bits";
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
  const concepts = state.concepts.filter((concept) => concept.agreedMeaning && concept.status !== "archived");

  function toggle(id: string) {
    setPicked((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
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
    <div className="wrap section stack">
      <h1>Expression trials</h1>
      <p>Combine concepts the session already has. The order you try is an experiment. It is not a grammatical rule of an undocumented language.</p>
      <form
        className="stack"
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
        <Field label="Trial name"><input className="control" value={title} onChange={(event) => setTitle(event.target.value)} required /></Field>
        <Field label="Gloss" hint="A participant hypothesis about what the sequence might convey. Not a translation.">
          <input className="control" value={gloss} onChange={(event) => setGloss(event.target.value)} />
        </Field>
        <Field label="Order note"><input className="control" value={orderNote} onChange={(event) => setOrderNote(event.target.value)} /></Field>
        <Field label="Grammar hypothesis" hint="Keep this separate from verified concepts.">
          <textarea className="textarea" value={grammarNote} onChange={(event) => setGrammarNote(event.target.value)} />
        </Field>
        <Field label="Context where this order was tried">
          <input className="control" value={contextExample} onChange={(event) => setContextExample(event.target.value)} />
        </Field>
        <Field label="Counterexample">
          <input className="control" value={counterexample} onChange={(event) => setCounterexample(event.target.value)} />
        </Field>
        <div className="stack-sm">
          {concepts.map((concept) => (
            <label key={concept.id} className="small">
              <input type="checkbox" checked={picked.includes(concept.id)} onChange={() => toggle(concept.id)} /> {concept.agreedMeaning}
            </label>
          ))}
        </div>
        <div className="stack-sm">
          {picked.map((id, index) => {
            const concept = concepts.find((item) => item.id === id);
            return (
              <div key={id} className="row">
                <span>{index + 1}. {concept?.agreedMeaning}</span>
                <button type="button" className="btn" onClick={() => move(index, -1)}>Move earlier</button>
                <button type="button" className="btn" onClick={() => move(index, 1)}>Move later</button>
              </div>
            );
          })}
        </div>
        <button className="btn btn-primary" type="submit">Save expression trial</button>
      </form>
      {message ? <Notice>{message}</Notice> : null}
      {state.expressions.map((expression) => (
        <article key={expression.id} className="list-card stack-sm">
          <h2>{expression.title}</h2>
          <StatusText status={expression.status} />
          <p>{expression.conceptIds.map((id) => state.concepts.find((concept) => concept.id === id)?.agreedMeaning || id).join("  ·  ")}</p>
          {expression.gloss ? <p className="small">Gloss hypothesis: {expression.gloss}</p> : null}
          {expression.orderNote ? <p className="small">Order: {expression.orderNote}</p> : null}
          {expression.grammarNote ? <p className="small">Grammar hypothesis: {expression.grammarNote}</p> : null}
          {expression.contextExample ? <p className="small">Context: {expression.contextExample}</p> : null}
          {expression.counterexample ? <p className="small">Counterexample: {expression.counterexample}</p> : null}
          <div className="row">
            {(["testing", "understood", "corrected", "hypothesis"] as const).map((status) => (
              <button
                key={status}
                type="button"
                className="btn"
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
      {!state.expressions.length ? <p>No expression trials yet.</p> : null}
    </div>
  );
}
