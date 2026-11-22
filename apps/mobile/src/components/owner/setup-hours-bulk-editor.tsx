"use client";

import { useState } from "react";
import SetupTimeField from "./setup-time-field";

export default function SetupHoursBulkEditor({ initialOpen, initialClose, onApply, onEditingChange }: {
  initialOpen: string;
  initialClose: string;
  onApply: (open: string, close: string) => void;
  onEditingChange?: (editing: boolean) => void;
}) {
  const [draft, setDraft] = useState<{ open: string; close: string } | null>(null);
  const open = draft?.open ?? initialOpen;
  const close = draft?.close ?? initialClose;
  const update = (patch: Partial<{ open: string; close: string }>) => {
    setDraft({ open, close, ...patch });
    onEditingChange?.(true);
  };
  const reset = () => { setDraft(null); onEditingChange?.(false); };
  const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  const valid = validTime(open) && validTime(close) && open < close;

  return <section role="region" aria-label="전체 시간 변경" data-setup-hours-bulk data-pending={Boolean(draft)} className="mt-1 mb-2 grid shrink-0 grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-x-1.5 gap-y-1 border-y border-[#dce6f2] bg-[#eef4fb] py-2" onKeyDown={(event) => {
    if (event.key === "Escape" && draft) { event.preventDefault(); event.stopPropagation(); reset(); }
  }}>
      <p className="text-[14px] font-medium text-[#15213b]">전체</p>
      <div data-bulk-range className="flex min-w-0 items-center justify-center" role="group" aria-label="일괄 영업시간">
        <SetupTimeField label="전체 영업 시작" value={open} onChange={(value) => update({ open: value })} />
        <span aria-hidden="true" className="mx-0.5 text-[16px] text-[#64748b]">–</span>
        <SetupTimeField label="전체 영업 종료" value={close} onChange={(value) => update({ close: value })} />
      </div>
      <div data-bulk-actions className="flex items-center gap-1">
        {draft && <button type="button" onClick={reset} className="min-h-11 min-w-11 rounded-[8px] px-2 text-[14px] text-[#526b84] outline-none focus-visible:ring-2 focus-visible:ring-blue-600">취소</button>}
        <button type="button" disabled={!valid} onClick={() => { if (valid) { onApply(open, close); reset(); } }} className="min-h-11 min-w-11 whitespace-nowrap rounded-[8px] px-2 text-[14px] font-medium text-[#315478] outline-none enabled:hover:bg-[#dce8f7] focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50">요일에 반영</button>
      </div>
      {draft && !valid && <p role="alert" className="col-span-3 text-[13px] leading-5 text-red-600">종료 시간을 시작 시간보다 늦게 선택해 주세요.</p>}
    </section>;
}
