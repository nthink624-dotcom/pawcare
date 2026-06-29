"use client";

import { useEffect } from "react";

type DisabledFirstVisitFlowProps = {
  onBackToEntry?: () => void;
};

export default function CustomerFirstVisitClaudeFlow({ onBackToEntry }: DisabledFirstVisitFlowProps) {
  useEffect(() => {
    onBackToEntry?.();
  }, [onBackToEntry]);

  return null;
}
