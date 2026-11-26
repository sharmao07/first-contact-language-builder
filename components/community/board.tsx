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
  const [dragId, setDragId] = useState<string | null>(null);
  if (!state || !identity) return null;
  const token = identity.token;
  const concepts = state.concepts.filter((concept) => concept.status !== "archived");
  const verified = concepts.filter((concept) => concept.status === "verified");
  const uncertain = concepts.filter((concept) => concept.status !== "verified");
  const selected = picked.map((id) => verified.find((concept) => concept.id === id)).filter((item) => item != null);

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
      <p>Only session-verified meanings can be arranged into a row. Showing that row asks whether it was understood. The row is not a translation, and the order is not a grammar.</p>
      {message ? <Notice>{message}</Notice> : null}
      <h2>Session-verified</h2>
      <div className="tile-grid" role="list">
        {verified.map((concept) => {
          const on = picked.includes(concept.id);
          return (
            <button key={concept.id} type="button" className={on ? "btn concept-chip is-selected" : "btn concept-chip"} aria-pressed={on} onClick={() => toggle(concept.id)}>
              <strong>{concept.agreedMeaning || concept.conceptCode}</strong>
              <StatusText status={concept.status} reason={concept.statusReason} />
            </button>
          );
        })}
      </div>
      {verified.length === 0 ? <p>Nothing is session-verified yet. A meaning stays off this row until two people have matched it on different examples and methods.</p> : null}
      <h2>Still uncertain</h2>
      <div className="tile-grid" role="list">
        {uncertain.map((concept) => (
          <article key={concept.id} className="rule stack-sm">
            <strong>{concept.agreedMeaning || concept.conceptCode}</strong>
            <StatusText status={concept.status} reason={concept.statusReason} />
            <p className="small">Not an established meaning in this session.</p>
          </article>
        ))}
      </div>
      {uncertain.length === 0 ? <p className="small">No unresolved or disputed concepts are on record.</p> : null}
      <div className="stack">
        <h2>This expression</h2>
        {selected.length === 0 ? <p className="small">Choose session-verified meanings above. Drag a row to change the order, or use Earlier and Later.</p> : null}
        {selected.map((concept, index) => (
          <div
            key={concept.id}
            className={dragId === concept.id ? "row is-dragging" : "row"}
            draggable
            onDragStart={() => setDragId(concept.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (!dragId || dragId === concept.id) return;
              setPicked((current) => {
                const next = current.filter((id) => id !== dragId);
                const at = next.indexOf(concept.id);
                next.splice(at < 0 ? next.length : at, 0, dragId);
                return next;
              });
              setDragId(null);
            }}
          >
            <span>{index + 1}. {concept.agreedMeaning || concept.conceptCode}</span>
            <button type="button" className="btn" onClick={() => move(concept.id, -1)} aria-label={`Move ${concept.agreedMeaning || concept.conceptCode} earlier`}>Earlier</button>
            <button type="button" className="btn" onClick={() => move(concept.id, 1)} aria-label={`Move ${concept.agreedMeaning || concept.conceptCode} later`}>Later</button>
          </div>
        ))}
        <button type="button" className="btn btn-primary" aria-busy={pending} disabled={pending || selected.length === 0} onClick={show}>{pending ? "Showing the row…" : "Show this to the other person"}</button>
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
