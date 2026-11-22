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
    const mouse = window.matchMedia("(any-hover: hover) and (any-pointer: fine)");
    const sync = () => setEnabled(mouse.matches);
    sync();
    mouse.addEventListener("change", sync);
    return () => {
      mouse.removeEventListener("change", sync);
    };
  }, []);

  function reset() {
    pointerX.set(0);
    pointerY.set(0);
  }

  function isTextEntry(target: EventTarget | null) {
    return target instanceof Element && Boolean(target.closest(
      'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]), textarea, [contenteditable="true"]',
    ));
  }

  function followPointer(event: PointerEvent<HTMLElement>) {
    if (!enabled || event.pointerType !== "mouse") return;
    setEditing(false);
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
      onPointerLeave={() => { setEditing(false); reset(); }}
      onFocusCapture={(event) => {
        if (isTextEntry(event.target)) { setEditing(true); reset(); }
      }}
      onKeyDownCapture={(event) => {
        if (isTextEntry(event.target)) { setEditing(true); reset(); }
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setEditing(false);
      }}
    >
      {children}
    </motion.section>
  );
}

export { SignInCard2 as Component };
