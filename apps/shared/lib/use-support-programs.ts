"use client";

import { useEffect, useMemo, useState } from "react";
import type { CalendarRequest } from "../contracts/owner-calendar";
import type { SupportProgram, SupportProgramsResponse } from "../contracts/support-programs";
import { supportProgramsForShop } from "./support-program-coverage";

const emptyPrograms: SupportProgram[] = [];

export function useSupportPrograms(enabled: boolean, request: CalendarRequest, shopAddress?: string) {
  const [programs, setPrograms] = useState<SupportProgram[]>();
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void request<SupportProgramsResponse>("/api/calendar/support-programs", { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) { setPrograms(result.programs); setError(false); }
      }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [enabled, request, revision]);

  const deadlines = useMemo(() => {
    const byDate = new Map<string, SupportProgram[]>();
    const notices = programs ?? emptyPrograms;
    const visible = shopAddress === undefined ? notices : supportProgramsForShop(notices, shopAddress);
    for (const program of visible) {
      if (!program.closesOn) continue;
      const existing = byDate.get(program.closesOn);
      if (existing) existing.push(program);
      else byDate.set(program.closesOn, [program]);
    }
    return byDate;
  }, [programs, shopAddress]);

  return {
    programs: programs ?? emptyPrograms, deadlines, error, loading: enabled && !programs && !error,
    retry: () => setRevision(value => value + 1),
  };
}
