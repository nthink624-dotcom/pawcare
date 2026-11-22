"use client";

import { useCallback, useMemo, useState } from "react";

import type { OwnerWebStaffColumn } from "@/components/owner-web/owner-web-staff-data";

export function useCalendarStaffFilter(visibleStaff: OwnerWebStaffColumn[]) {
  const [selection, setSelection] = useState<string[]>([]);
  const selectedStaffKeys = useMemo(() => {
    if (visibleStaff.length === 1) return [visibleStaff[0].key];
    const saved = new Set(visibleStaff.map((member) => member.key));
    return selection.filter((key) => saved.has(key));
  }, [selection, visibleStaff]);
  const selectedVisibleStaff = useMemo(() => selectedStaffKeys.length
    ? visibleStaff.filter((member) => selectedStaffKeys.includes(member.key))
    : visibleStaff, [selectedStaffKeys, visibleStaff]);
  const setSelectedStaffKeys = useCallback((keys: string[]) => {
    const saved = new Set(visibleStaff.map((member) => member.key));
    setSelection([...new Set(keys)].filter((key) => saved.has(key)));
  }, [visibleStaff]);

  return {
    selectedStaffKeys,
    setSelectedStaffKeys,
    selectedVisibleStaff,
    staff: selectedStaffKeys.length === 1 ? selectedStaffKeys[0] : "전체 직원",
  };
}
