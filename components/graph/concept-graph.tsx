"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import { useSessionContext } from "@/components/session/provider";
import { Field, Notice, StatusText } from "@/components/ui/bits";
import { api, ApiError } from "@/lib/client/api";
import { CATEGORIES, EXPERIMENT_LABEL, RELATION_TYPES } from "@/lib/constants";

type GraphNode = SimulationNodeDatum & {
  id: string;
  label: string;
  status: string;
  category: string;
  code: string;
  kind: "concept" | "hypothesis" | "experiment";
};
type GraphLink = SimulationLinkDatum<GraphNode> & {
  id: string;
  relationType: string;
  status: string;
  notes: string;
};

export function ConceptGraph() {
  const { state, identity, code, reload } = useSessionContext();
  const [selected, setSelected] = useState<string | null>(null);
  const [fromConceptId, setFromConceptId] = useState("");
  const [toConceptId, setToConceptId] = useState("");
  const [relationType, setRelationType] = useState<(typeof RELATION_TYPES)[number]>("associated-with");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [relationFilter, setRelationFilter] = useState("all");
  const [focus, setFocus] = useState(false);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const drag = useRef<{ id: string; pointer: number } | null>(null);
  const pan = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const concepts = state?.concepts.filter((concept) => concept.status !== "archived") ?? [];
  const relationships = state?.relationships ?? [];
  const hypotheses = state?.hypotheses ?? [];
  const experiments = state?.experiments ?? [];
  const signature = [
    concepts.map((concept) => concept.id).join(","),
    relationships.map((item) => `${item.id}:${item.status}`).join(","),
    hypotheses.map((item) => item.id).join(","),
    experiments.map((item) => `${item.id}:${item.responses.map((response) => response.result).join(".")}`).join(","),
  ].join("|");

  useEffect(() => {
    const visible = concepts;
    const seeded: GraphNode[] = visible.map((concept, index) => ({
      id: concept.id,
      label: concept.agreedMeaning || concept.conceptCode,
      status: concept.status,
      category: concept.category,
      code: concept.conceptCode,
      kind: "concept",
      x: 180 + (index % 4) * 140,
      y: 80 + Math.floor(index / 4) * 110,
    }));
    const known = new Set(seeded.map((node) => node.id));
    hypotheses.slice(0, 12).forEach((hypothesis, index) => {
      seeded.push({
        id: `hypothesis:${hypothesis.id}`,
        label: hypothesis.proposedMeaning,
        status: hypothesis.status === "accepted" ? "tentative" : "hypothesis",
        category: "other",
        code: "reading",
        kind: "hypothesis",
        x: 40 + index * 30,
        y: 40,
      });
      if (hypothesis.conceptId && known.has(hypothesis.conceptId)) {
        known.add(`hypothesis:${hypothesis.id}`);
      }
    });
    experiments.slice(0, 12).forEach((experiment, index) => {
      const disagreed = experiment.responses.some((response) => response.result === "disagree");
      seeded.push({
        id: `experiment:${experiment.id}`,
        label: EXPERIMENT_LABEL[experiment.type] ?? experiment.type,
        status: disagreed ? "disputed" : "testing",
        category: "other",
        code: "check",
        kind: "experiment",
        x: 80,
        y: 140 + index * 36,
      });
    });
    const edges: GraphLink[] = relationships
      .filter((relationship) => known.has(relationship.fromConceptId) && known.has(relationship.toConceptId))
      .map((relationship) => ({
        id: relationship.id,
        source: relationship.fromConceptId,
        target: relationship.toConceptId,
        relationType: relationship.relationType,
        status: relationship.status,
        notes: relationship.notes,
      }));
    for (const hypothesis of hypotheses.slice(0, 12)) {
      if (!hypothesis.conceptId || !known.has(hypothesis.conceptId)) continue;
      edges.push({
        id: `link-hypothesis-${hypothesis.id}`,
        source: `hypothesis:${hypothesis.id}`,
        target: hypothesis.conceptId,
        relationType: "proposed reading",
        status: "hypothesis",
        notes: "",
      });
    }
    for (const experiment of experiments.slice(0, 12)) {
      if (!known.has(experiment.conceptId)) continue;
      const disagreed = experiment.responses.some((response) => response.result === "disagree");
      edges.push({
        id: `link-experiment-${experiment.id}`,
        source: `experiment:${experiment.id}`,
        target: experiment.conceptId,
        relationType: disagreed ? "disagreement" : "check",
        status: disagreed ? "disputed" : "hypothesis",
        notes: "",
      });
    }
    const simulation = forceSimulation(seeded)
      .force("link", forceLink<GraphNode, GraphLink>(edges).id((node) => node.id).distance(150))
      .force("charge", forceManyBody().strength(-280))
      .force("center", forceCenter(360, 300))
      .force("collide", forceCollide(46))
      .stop();
    for (let step = 0; step < 180; step += 1) simulation.tick();
    setNodes(seeded.map((node) => ({ ...node })));
    setLinks(edges);
    // Layout only when the session graph changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const visibleIds = useMemo(() => {
    const q = query.trim().toLowerCase();
    let ids = new Set(nodes.filter((node) => {
      const text = `${node.label} ${node.code}`.toLowerCase();
      if (q && !text.includes(q)) return false;
      if (category !== "all" && node.category !== category) return false;
      return true;
    }).map((node) => node.id));
    if (focus && selected) {
      const neighbors = new Set<string>([selected]);
      for (const link of links) {
        const source = nodeId(link.source);
        const target = nodeId(link.target);
        if (source === selected) neighbors.add(target);
        if (target === selected) neighbors.add(source);
      }
      ids = new Set([...ids].filter((id) => neighbors.has(id)));
    }
    return ids;
  }, [nodes, links, query, category, focus, selected]);

  if (!state || !identity) return null;
  const current = concepts.find((concept) => concept.id === selected) ?? null;
  const shownLinks = links.filter((link) => {
    if (relationFilter !== "all" && link.relationType !== relationFilter) return false;
    return visibleIds.has(nodeId(link.source)) && visibleIds.has(nodeId(link.target));
  });

  return (
    <div className="wrap section stack">
      <h1>Concept relationships</h1>
      <p>A line is a claim about two entries. Confirming a concept does not confirm the line. Drag a node, scroll to zoom, and drag empty space to pan.</p>
      <div className="row">
        <Field label="Search">
          <input className="control" value={query} onChange={(event) => setQuery(event.target.value)} />
        </Field>
        <Field label="Category">
          <select className="select" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="all">All categories</option>
            {CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </Field>
        <Field label="Relationship">
          <select className="select" value={relationFilter} onChange={(event) => setRelationFilter(event.target.value)}>
            <option value="all">All types</option>
            {RELATION_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </Field>
        <button type="button" className="btn" onClick={() => setFocus((value) => !value)} disabled={!selected}>
          {focus ? "Show the full graph" : "Focus on the selection"}
        </button>
        <button type="button" className="btn" onClick={() => setView((current) => ({ ...current, k: Math.min(2.4, current.k * 1.15) }))}>Zoom in</button>
        <button type="button" className="btn" onClick={() => setView((current) => ({ ...current, k: Math.max(0.45, current.k / 1.15) }))}>Zoom out</button>
        <button type="button" className="btn" onClick={() => setView({ x: 0, y: 0, k: 1 })}>Reset view</button>
      </div>
      {!concepts.length ? (
        <p>No concepts in this session yet. Relationships appear after concepts exist.</p>
      ) : (
        <svg
          className="graph-svg"
          viewBox="0 0 720 620"
          role="img"
          aria-label="Concept relationship graph. Scroll to zoom. Plus, minus, and zero change the view when this graph is focused."
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "+" || event.key === "=") setView((current) => ({ ...current, k: Math.min(2.4, current.k * 1.15) }));
            if (event.key === "-" || event.key === "_") setView((current) => ({ ...current, k: Math.max(0.45, current.k / 1.15) }));
            if (event.key === "0") setView({ x: 0, y: 0, k: 1 });
          }}
          onWheel={(event) => {
            event.preventDefault();
            const next = Math.min(2.4, Math.max(0.45, view.k * (event.deltaY > 0 ? 0.92 : 1.08)));
            setView((currentView) => ({ ...currentView, k: next }));
          }}
          onPointerDown={(event) => {
            if ((event.target as Element).tagName !== "svg") return;
            pan.current = { x: event.clientX, y: event.clientY, ox: view.x, oy: view.y };
          }}
          onPointerMove={(event) => {
            if (drag.current) {
              const svg = (event.currentTarget as SVGSVGElement);
              const point = svgPoint(svg, event.clientX, event.clientY, view);
              setNodes((currentNodes) => currentNodes.map((node) => node.id === drag.current?.id ? { ...node, x: point.x, y: point.y, fx: point.x, fy: point.y } : node));
            } else if (pan.current) {
              setView({
                ...view,
                x: pan.current.ox + (event.clientX - pan.current.x),
                y: pan.current.oy + (event.clientY - pan.current.y),
              });
            }
          }}
          onPointerUp={() => {
            drag.current = null;
            pan.current = null;
          }}
          onPointerLeave={() => {
            drag.current = null;
            pan.current = null;
          }}
        >
          <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
            {shownLinks.map((link) => {
              const source = nodes.find((node) => node.id === nodeId(link.source));
              const target = nodes.find((node) => node.id === nodeId(link.target));
              if (!source?.x || !target?.x || source.y == null || target.y == null) return null;
              const active = selected && (source.id === selected || target.id === selected);
              return (
                <line
                  key={link.id}
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke={link.status === "confirmed" ? "var(--verified)" : "var(--hypothesis)"}
                  strokeDasharray={link.status === "confirmed" ? undefined : "4 3"}
                  strokeWidth={active ? 2.5 : 1.4}
                >
                  <title>{`${link.relationType}, ${link.status}`}</title>
                </line>
              );
            })}
            {nodes.filter((node) => visibleIds.has(node.id)).map((node) => (
              <g
                key={node.id}
                transform={`translate(${node.x ?? 0} ${node.y ?? 0})`}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  drag.current = { id: node.id, pointer: event.pointerId };
                  setSelected(node.id);
                }}
                style={{ cursor: "grab" }}
              >
                {node.kind === "experiment" ? (
                  <rect x={-16} y={-12} width={32} height={24} fill="var(--accent)" stroke={selected === node.id ? "var(--ink)" : "transparent"} strokeWidth="2" />
                ) : node.kind === "hypothesis" ? (
                  <polygon points="0,-16 14,0 0,16 -14,0" fill={nodeColor(node.status)} stroke={selected === node.id ? "var(--ink)" : "transparent"} strokeWidth="2" />
                ) : (
                  <circle r={selected === node.id ? 22 : 18} fill={nodeColor(node.status)} stroke={selected === node.id ? "var(--ink)" : "transparent"} strokeWidth="2" />
                )}
                <text y="34" textAnchor="middle" fill="var(--ink)" fontSize="12">{clip(node.label)}</text>
              </g>
            ))}
          </g>
        </svg>
      )}
      <div className="grid-2">
        <div className="stack">
          <h2>Links</h2>
          {!relationships.length ? <p>No relationships yet. Add one from entries in this session.</p> : null}
          {relationships.map((relationship) => {
            const from = state.concepts.find((concept) => concept.id === relationship.fromConceptId);
            const to = state.concepts.find((concept) => concept.id === relationship.toConceptId);
            return (
              <article key={relationship.id} className="block stack-sm">
                <p>{from?.agreedMeaning || "Concept"} to {to?.agreedMeaning || "Concept"}</p>
                <p className="small">{relationship.relationType}. <StatusText status={relationship.status} /></p>
                {relationship.notes ? <p className="small">{relationship.notes}</p> : null}
                <div className="row">
                  <button type="button" className="btn" onClick={() => { setSelected(relationship.fromConceptId); setFocus(true); }}>Inspect</button>
                  <button type="button" className="btn" onClick={() => void update(relationship.id, relationship.status === "confirmed" ? "hypothesis" : "confirmed")}>
                    Mark {relationship.status === "confirmed" ? "hypothesis" : "confirmed"}
                  </button>
                  <button type="button" className="btn btn-danger" onClick={() => void remove(relationship.id)}>Remove</button>
                </div>
              </article>
            );
          })}
        </div>
        <form
          className="stack"
          onSubmit={async (event) => {
            event.preventDefault();
            try {
              await api(`/api/sessions/${code}/relationships`, {
                token: identity.token,
                body: { fromConceptId, toConceptId, relationType, notes, status: "hypothesis" },
              });
              setNotes("");
              setMessage("Relationship added as a hypothesis. It is not confirmed by verifying either concept.");
              reload();
            } catch (caught) {
              setMessage(caught instanceof ApiError ? caught.message : "The relationship was not saved.");
            }
          }}
        >
          <h2>Add a relationship</h2>
          <Field label="From">
            <select className="select" value={fromConceptId} onChange={(event) => setFromConceptId(event.target.value)} required>
              <option value="">Choose</option>
              {concepts.map((concept) => <option key={concept.id} value={concept.id}>{concept.agreedMeaning}</option>)}
            </select>
          </Field>
          <Field label="To">
            <select className="select" value={toConceptId} onChange={(event) => setToConceptId(event.target.value)} required>
              <option value="">Choose</option>
              {concepts.map((concept) => <option key={concept.id} value={concept.id}>{concept.agreedMeaning}</option>)}
            </select>
          </Field>
          <Field label="Relation">
            <select className="select" value={relationType} onChange={(event) => setRelationType(event.target.value as (typeof RELATION_TYPES)[number])}>
              {RELATION_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </Field>
          <Field label="Note"><input className="control" value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
          <button className="btn btn-primary" type="submit">Add as hypothesis</button>
          {message ? <Notice>{message}</Notice> : null}
          {current ? (
            <div className="stack-sm">
              <h3>{current.agreedMeaning}</h3>
              <StatusText status={current.status} reason={current.statusReason} />
              <p className="small">{current.category}</p>
              <Link href={`/session/${code}/concept/${current.id}`}>Open the evidence</Link>
            </div>
          ) : <p className="small muted">Select a node to inspect its evidence.</p>}
        </form>
      </div>
    </div>
  );

  async function update(id: string, status: "hypothesis" | "confirmed") {
    await api(`/api/sessions/${code}/relationships/${id}`, { method: "PATCH", token: identity?.token, body: { status } });
    reload();
  }

  async function remove(id: string) {
    await api(`/api/sessions/${code}/relationships/${id}`, { method: "DELETE", token: identity?.token });
    reload();
  }
}

function nodeId(value: GraphLink["source"]) {
  return typeof value === "object" ? value.id : String(value);
}

function svgPoint(svg: SVGSVGElement, clientX: number, clientY: number, view: { x: number; y: number; k: number }) {
  const rect = svg.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * 720;
  const y = ((clientY - rect.top) / rect.height) * 620;
  return { x: (x - view.x) / view.k, y: (y - view.y) / view.k };
}

function nodeColor(status: string) {
  if (status === "verified") return "var(--verified)";
  if (status === "disputed" || status === "reopened") return "var(--disputed)";
  if (status === "tentative" || status === "awaiting") return "var(--tentative)";
  return "var(--hypothesis)";
}

function clip(value: string) {
  return value.length > 22 ? `${value.slice(0, 20)}…` : value;
}
