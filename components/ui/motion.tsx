"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const EASE = [0.22, 1, 0.36, 1] as const;

export function MotionReveal({
  children,
  className,
  style,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      style={style}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

export function MotionSwap({
  motionKey,
  children,
  className,
}: {
  motionKey: string;
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={motionKey}
        className={className}
        initial={reduce ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduce ? undefined : { opacity: 0, y: -4 }}
        transition={{ duration: 0.2, ease: EASE }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
