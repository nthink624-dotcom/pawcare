"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect, useState, type PointerEvent, type ReactNode } from "react";

export type SignInCard2Props = {
  children?: ReactNode;
  className?: string;
};

/** Adds cursor tilt without changing the supplied card's layout or styling. */
export function SignInCard2({ children, className }: SignInCard2Props) {
  const [enabled, setEnabled] = useState(false);
  const [editing, setEditing] = useState(false);
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const smoothX = useSpring(pointerX, { stiffness: 180, damping: 24 });
  const smoothY = useSpring(pointerY, { stiffness: 180, damping: 24 });
  const rotateX = useTransform(smoothY, [-1, 1], [6, -6]);
  const rotateY = useTransform(smoothX, [-1, 1], [-6, 6]);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mouse = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => setEnabled(mouse.matches && !reducedMotion.matches);
    sync();
    reducedMotion.addEventListener("change", sync);
    mouse.addEventListener("change", sync);
    return () => {
      reducedMotion.removeEventListener("change", sync);
      mouse.removeEventListener("change", sync);
    };
  }, []);

  function reset() {
    pointerX.set(0);
    pointerY.set(0);
  }

  function followPointer(event: PointerEvent<HTMLElement>) {
    if (!enabled || editing || event.pointerType !== "mouse") return;
    const rect = event.currentTarget.getBoundingClientRect();
    pointerX.set(Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width - 0.5) * 2)));
    pointerY.set(Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height - 0.5) * 2)));
  }

  return (
    <motion.section
      data-login-tilt-card
      data-tilt-enabled={enabled ? "true" : "false"}
      data-tilt-editing={editing ? "true" : "false"}
      className={className}
      style={{
        transformPerspective: 1500,
        rotateX: enabled && !editing ? rotateX : 0,
        rotateY: enabled && !editing ? rotateY : 0,
      }}
      onPointerMove={followPointer}
      onPointerLeave={reset}
      onFocusCapture={() => { setEditing(true); reset(); }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setEditing(false);
      }}
    >
      {children}
    </motion.section>
  );
}

export { SignInCard2 as Component };
