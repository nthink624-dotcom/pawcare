"use client";

import { useEffect, useRef } from "react";

/** Re-read server state when returning from another app or the browser back/forward cache. */
export function useBookingResumeRefresh(enabled: boolean, refresh: () => Promise<unknown>) {
  const current = useRef(refresh);
  current.current = refresh;
  useEffect(() => {
    if (!enabled) return;
    let running = false;
    const resume = () => {
      if (document.visibilityState === "hidden" || running) return;
      running = true;
      void Promise.resolve().then(() => current.current()).catch(() => {}).finally(() => { running = false; });
    };
    window.addEventListener("focus", resume);
    window.addEventListener("pageshow", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      window.removeEventListener("focus", resume);
      window.removeEventListener("pageshow", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [enabled]);
}
