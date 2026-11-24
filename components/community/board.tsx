"use client";

import { useState } from "react";
import { useSessionContext } from "@/components/session/provider";
import { Notice, StatusText } from "@/components/ui/bits";
import { api, ApiError } from "@/lib/client/api";

export function CommunicationBoard() {
  const { code, state, identity, reload } = useSessionContext();
  const [picked, setPicked] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  if (!state || !identity) return null;
  const token = identity.token;
  const concepts = state.concepts.filter((concept) => concept.status !== "archived");
  const selected = picked.map((id) => concepts.find((concept) => concept.id === id)).filter((item) => item != null);

  function toggle(id: string) {
    setPicked((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function move(id: string, direction: -1 | 1) {
    setPicked((current) => {
      const index = current.indexOf(id);
      const next = index + direction;
      if (index < 0 || next < 0 || next >= current.length) return current;
      const copy = [...current];
      const [item] = copy.splice(index, 1);
      copy.splice(next, 0, item);
      return copy;
    });
  }

  async function show() {
    setPending(true);
    setMessage(null);
    try {
      const created = await api<{ expressionId: string }>(`/api/sessions/${code}/expressions`, {
        token,
        body: {
          title: "Shared board",
          conceptIds: picked,
          orderNote: "The order on the board is a hypothesis. It is not a grammar and it is not a translation.",
        },
      });
      await api(`/api/sessions/${code}/expressions/${created.expressionId}`, {
        method: "PATCH",
        token,
        body: { shown: true },
      });
      setPicked([]);
      await reload();
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : "The expression was not shown.");
    } finally {
      setPending(false);
    }
  }

  async function mark(expressionId: string, comprehension: "understood" | "unclear" | "clarification") {
    setPending(true);
    setMessage(null);
    try {
      await api(`/api/sessions/${code}/expressions/${expressionId}`, {
        method: "PATCH",
        token,
        body: { comprehension },
      });
      await reload();
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : "The response was not recorded.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="wrap section stack">
      <h1>Shared board</h1>
      <p>Choose concept cards and arrange them. Showing the row asks whether it was understood. The row is not a translation, and the order is not a grammar.</p>
      {message ? <Notice>{message}</Notice> : null}
      <div className="tile-grid" role="list">
        {concepts.map((concept) => {
          const on = picked.includes(concept.id);
          return (
            <button key={concept.id} type="button" className={on ? "btn btn-primary concept-chip" : "btn concept-chip"} aria-pressed={on} onClick={() => toggle(concept.id)}>
              <strong>{concept.agreedMeaning || concept.conceptCode}</strong>
              <StatusText status={concept.status} />
            </button>
          );
        })}
      </div>
      {concepts.length === 0 ? <p>No concept cards yet. A card appears after someone accepts a reading in Discovery.</p> : null}
      <div className="stack">
        <h2>This expression</h2>
        {selected.map((concept, index) => (
          <div key={concept.id} className="row">
            <span>{index + 1}. {concept.agreedMeaning || concept.conceptCode}</span>
            <button type="button" className="btn" onClick={() => move(concept.id, -1)} aria-label={`Move ${concept.agreedMeaning || concept.conceptCode} earlier`}>Earlier</button>
            <button type="button" className="btn" onClick={() => move(concept.id, 1)} aria-label={`Move ${concept.agreedMeaning || concept.conceptCode} later`}>Later</button>
          </div>
        ))}
        <button type="button" className="btn btn-primary" disabled={pending || selected.length === 0} onClick={show}>Show this to the other person</button>
      </div>
      <div className="stack">
        <h2>Shown already</h2>
        {state.expressions.map((expression) => (
          <article key={expression.id} className="rule stack-sm">
            <p>{expression.conceptIds.map((id) => concepts.find((concept) => concept.id === id)?.agreedMeaning || id).join("  ·  ") || expression.title}</p>
            <p className="small">{expression.orderNote}</p>
            <p className="small">{expression.shownAt ? "Shown" : "Not shown yet"}{expression.comprehension ? ` · ${expression.comprehension}` : ""}</p>
            <div className="row">
              <button type="button" className="btn" disabled={pending} onClick={() => mark(expression.id, "understood")}>Understood</button>
              <button type="button" className="btn" disabled={pending} onClick={() => mark(expression.id, "unclear")}>Not understood</button>
              <button type="button" className="btn" disabled={pending} onClick={() => mark(expression.id, "clarification")}>Ask for clarification</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
