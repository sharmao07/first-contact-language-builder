"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, EyeOff, Lock, Scale, Sparkles } from "lucide-react";
import { StatusText } from "@/components/ui/bits";

const steps = [
  {
    id: "observe",
    label: "1. Evidence",
    title: "A glass, and a sound",
    body: "Person A points at a glass of water and makes a gesture or a sound. Person B responds. The record keeps the container, the water, and drinking as competing guesses.",
    visual: "Seat A and Seat B record the same gesture without picking a winner.",
    stateA: "Points at glass",
    stateB: "Draws liquid",
    badge: "hypothesis",
  },
  {
    id: "contrast",
    label: "2. Contrast",
    title: "A check that can tell them apart",
    body: "The next demonstration shows an empty glass and water separately. Choosing the empty glass would support the object. Choosing the water would support the substance. Choosing both, or neither, leaves the reading incomplete.",
    visual: "Expected answers are mapped before the participants respond.",
    stateA: "Empty glass vs water",
    stateB: "Distinguishes readings",
    badge: "tentative",
  },
  {
    id: "lock",
    label: "3. Blinded lock",
    title: "Two people answer separately",
    body: "Each person responds before seeing the other answer. The result is evidence. It does not declare that the expression means glass or water.",
    visual: "Both seats lock independently before the comparison opens.",
    stateA: "Locked · Hidden",
    stateB: "Locked · Hidden",
    badge: "awaiting",
  },
  {
    id: "verify",
    label: "4. Threshold",
    title: "Only a tested meaning is shared",
    body: "A meaning can be arranged on the shared board after two people match it on different examples and methods. Anything still disputed stays labeled uncertain.",
    visual: "Two distinct stimuli, two methods, two participants, zero disagreements.",
    stateA: "Matched (2/2 stimuli)",
    stateB: "Matched (2/2 methods)",
    badge: "verified",
  },
] as const;

export function Walkthrough() {
  const [index, setIndex] = useState(0);
  const reduce = useReducedMotion();
  const step = steps[index];

  return (
    <div className="surface stack">
      <div className="segment" role="tablist" aria-label="Walkthrough stages" style={{ width: "100%", justifyContent: "space-between" }}>
        {steps.map((item, itemIndex) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={itemIndex === index}
            className="btn"
            style={{ flex: "1 1 auto" }}
            onClick={() => setIndex(itemIndex)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step.id}
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0, y: -4 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="stack"
        >
          <div className="row-between">
            <h3>{step.title}</h3>
            <StatusText status={step.badge} pill />
          </div>
          <p className="small" style={{ color: "var(--ink)" }}>{step.body}</p>
          <div className="grid-2" style={{ gap: 12 }}>
            <div className="surface-recessed stack-xs" style={{ padding: 12 }}>
              <div className="row" style={{ gap: 6 }}>
                {step.id === "lock" ? <Lock size={14} strokeWidth={1.5} aria-hidden="true" /> : <Scale size={14} strokeWidth={1.5} aria-hidden="true" />}
                <span className="mono small muted">Seat A</span>
              </div>
              <p className="small" style={{ fontWeight: 500, color: "var(--ink)" }}>{step.stateA}</p>
            </div>
            <div className="surface-recessed stack-xs" style={{ padding: 12 }}>
              <div className="row" style={{ gap: 6 }}>
                {step.id === "lock" ? <EyeOff size={14} strokeWidth={1.5} aria-hidden="true" /> : step.id === "verify" ? <Check size={14} strokeWidth={1.5} aria-hidden="true" /> : <Sparkles size={14} strokeWidth={1.5} aria-hidden="true" />}
                <span className="mono small muted">Seat B</span>
              </div>
              <p className="small" style={{ fontWeight: 500, color: "var(--ink)" }}>{step.stateB}</p>
            </div>
          </div>
          <p className="small muted">{step.visual}</p>
        </motion.div>
      </AnimatePresence>

      <p className="small muted" style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
        Illustrated walkthrough. It does not analyze an image.
      </p>
    </div>
  );
}
