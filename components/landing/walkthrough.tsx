"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const steps = [
  {
    title: "A glass, and a drinking mime",
    body: "Participant A points at a glass and mimes a drink. The file is evidence. It is not yet a word.",
  },
  {
    title: "Several readings stay open",
    body: "The facilitator can suggest water, the action of drinking, the container, or a request. None of those is marked verified.",
  },
  {
    title: "A check splits them apart",
    body: "A later contrast uses rain, a river, and an empty glass. One success is recorded. It still is not proof.",
  },
  {
    title: "A second, different check",
    body: "Only after another varied check, with no disagreement, can the shared entry become verified. It can still be reopened.",
  },
];

export function Walkthrough() {
  const [index, setIndex] = useState(0);
  const reduce = useReducedMotion();
  const step = steps[index];

  return (
    <div className="stack">
      <div className="row">
        {steps.map((item, itemIndex) => (
          <button
            key={item.title}
            type="button"
            className={itemIndex === index ? "btn btn-primary" : "btn"}
            onClick={() => setIndex(itemIndex)}
          >
            {itemIndex + 1}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={step.title}
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="stack-sm"
        >
          <h3>{step.title}</h3>
          <p>{step.body}</p>
        </motion.div>
      </AnimatePresence>
      <p className="small muted">Illustrated walkthrough. It does not analyze an image.</p>
    </div>
  );
}
