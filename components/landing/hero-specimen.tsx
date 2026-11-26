"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { StatusText } from "@/components/ui/bits";

const readings = [
  {
    id: "container",
    label: "The container",
    note: "Focuses on the rigid vessel held in Seat A's hand.",
    check: "Next check: show an empty glass beside a bowl.",
  },
  {
    id: "water",
    label: "The water",
    note: "Focuses on the liquid inside the glass, separate from its shape.",
    check: "Next check: pour water into a cupped hand or saucer.",
  },
  {
    id: "drink",
    label: "The drink",
    note: "Focuses on the drinking gesture rather than any physical object.",
    check: "Next check: mime drinking with empty hands.",
  },
] as const;

export function HeroSpecimen() {
  const [active, setActive] = useState<(typeof readings)[number]["id"]>("water");
  const reduce = useReducedMotion();
  const current = readings.find((r) => r.id === active) ?? readings[1];

  return (
    <div className="exchange">
      <div className="row-between">
        <div className="row" style={{ gap: 8 }}>
          <span className="seat-mark" data-state="here" aria-hidden="true" />
          <span className="mono small">Specimen · SHORE-1001</span>
        </div>
        <StatusText status="hypothesis" pill />
      </div>

      <div className="exchange-stage">
        <svg className="glass-drawing" viewBox="0 0 120 180" fill="none" aria-hidden="true">
          <path
            d="M34 26h52l-7 100a19 19 0 0 1-38 0L34 26z"
            stroke={active === "container" ? "var(--oxide)" : "currentColor"}
            strokeWidth={active === "container" ? 2.2 : 1.5}
          />
          <motion.g
            animate={reduce ? undefined : { y: active === "water" ? -2 : 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <path
              d="M40 82h40l-4 38a14 14 0 0 1-32 0l-4-38z"
              fill="var(--oxide)"
              opacity={active === "water" ? 0.92 : 0.45}
            />
            <path d="M46 88h10l-1 16" stroke="var(--bg-elev)" strokeWidth="1.5" opacity="0.6" />
          </motion.g>
          <path
            d="M46 26V14h28"
            stroke={active === "drink" ? "var(--oxide)" : "currentColor"}
            strokeWidth={active === "drink" ? 2.2 : 1.5}
            strokeDasharray={active === "drink" ? "3 2" : undefined}
          />
        </svg>

        <div className="stack-sm">
          <p className="small" style={{ color: "var(--ink)", fontWeight: 500 }}>
            Seat A points at the glass and mimes a drink. Seat B draws it back.
          </p>
          <div className="stack-xs" role="tablist" aria-label="Competing guesses">
            {readings.map((item) => {
              const selected = item.id === active;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  className={selected ? "btn btn-sm is-selected" : "btn btn-sm"}
                  style={{ justifyContent: "space-between", width: "100%" }}
                  onClick={() => setActive(item.id)}
                >
                  <span>{item.label}</span>
                  <StatusText status="open" />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="surface-recessed stack-xs" style={{ padding: "12px 14px" }}>
        <p className="small" style={{ color: "var(--ink)" }}>{current.note}</p>
        <p className="small muted">{current.check}</p>
      </div>

      <div className="row-between">
        <p className="small muted">The glass is evidence. None of these readings is session-verified.</p>
        <span className="mono small muted">0 / 2 checks</span>
      </div>
    </div>
  );
}
