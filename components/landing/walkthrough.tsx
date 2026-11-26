"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const steps = [
  {
    title: "A glass, and a sound",
    body: "Person A points at a glass of water and makes a gesture or a sound. Person B responds. The record keeps the container, the water, and drinking as competing guesses.",
  },
  {
    title: "A check that can tell them apart",
    body: "The next demonstration shows an empty glass and water separately. Choosing the empty glass would support the object. Choosing the water would support the substance. Choosing both, or neither, leaves the reading incomplete.",
  },
  {
    title: "Two people answer separately",
    body: "Each person responds before seeing the other answer. The result is evidence. It does not declare that the expression means glass or water.",
  },
  {
    title: "Only a tested meaning is shared",
    body: "A meaning can be arranged on the shared board after two people match it on different examples and methods. Anything still disputed stays labeled uncertain.",
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
