"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { IconCheck as Check, IconChevronDown as ChevronDown, IconPlus as Plus, IconSearch as Search } from "@tabler/icons-react";

import { cn } from "@/lib/utils";

export interface Member {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  workStatus?: "working" | "off";
  color?: string;
}

export interface MemberSelectorProps {
  members: Member[];
  selected: string[];
  onChange: (selected: string[]) => void;
  max?: number;
  maxVisible?: number;
  className?: string;
  allLabel?: string;
  renderAvatar?: (member: Member) => React.ReactNode;
}

const focusClass = "outline-none focus-visible:ring-2 focus-visible:ring-[#1677ff] focus-visible:ring-offset-2";

function MemberImage({ member, renderAvatar }: Pick<MemberSelectorProps, "renderAvatar"> & { member: Member }) {
  const [failedSource, setFailedSource] = React.useState<string>();
  if (renderAvatar) return renderAvatar(member);
  const initials = member.name.trim().split(/\s+/).map((part) => Array.from(part)[0]).join("").slice(0, 2);
  return (
    <span className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[#eef2f6] text-sm font-medium text-[#475569]">
      {initials}
      {member.avatar && failedSource !== member.avatar && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={member.avatar} alt="" className="absolute inset-0 h-full w-full object-cover" onError={() => setFailedSource(member.avatar)} />
      )}
    </span>
  );
}

function GroupImage({ members, renderAvatar }: { members: Member[]; renderAvatar?: MemberSelectorProps["renderAvatar"] }) {
  const visible = members.slice(0, 4);
  const outerSize = 48;
  const imageSize = 24;
  const travel = outerSize - imageSize;
  return (
    <span className="relative block" style={{ width: outerSize, height: outerSize }}>
      {visible.map((member, index) => <span key={member.id} className="absolute block overflow-hidden rounded-full ring-2 ring-white" style={{ width: imageSize, height: imageSize, top: travel / 2, left: visible.length > 1 ? index * travel / (visible.length - 1) : travel / 2 }}><MemberImage member={member} renderAvatar={renderAvatar} /></span>)}
    </span>
  );
}

function MemberDropdown({ members, selected, onSelect, onClear, allLabel, renderAvatar, max, position, panelRef, id }: {
  members: Member[];
  selected: string[];
  onSelect: (id: string) => void;
  onClear: () => void;
  allLabel?: string;
  renderAvatar?: MemberSelectorProps["renderAvatar"];
  max?: number;
  position: React.CSSProperties;
  panelRef: React.RefObject<HTMLDivElement | null>;
  id: string;
}) {
  const [query, setQuery] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => { inputRef.current?.focus(); }, []);
  const filtered = members.filter((member) => `${member.name} ${member.email ?? ""}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const allSelected = !selected.length || members.every((member) => selected.includes(member.id));

  return (
    <motion.div ref={panelRef} id={id} role="dialog" aria-label="직원 선택" style={position}
      initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.98 }} transition={{ duration: 0.15 }}
      className="fixed z-[100] flex flex-col overflow-hidden rounded-[14px] border border-[#e8edf3] bg-white text-[#101a31] shadow-lg"
      onKeyDown={(event) => {
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
        if (event.target === inputRef.current && event.key !== "ArrowDown") return;
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
        if (!buttons.length) return;
        event.preventDefault();
        const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (current + (event.key === "ArrowUp" ? -1 : 1) + buttons.length) % buttons.length;
        buttons[next]?.focus();
      }}>
      <div className="border-b border-[#e8edf3] p-3">
        <div className="mb-3 flex items-center justify-between gap-3 text-sm font-medium">
          <span>담당 직원</span><span role="status" aria-live="polite" className="text-xs font-normal text-[#64748b]">{allSelected ? "전체 선택" : `${selected.length}명 선택`}</span>
        </div>
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748b]" />
          <input ref={inputRef} aria-label="직원 검색" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="직원 이름 검색"
            className={cn("min-h-11 w-full rounded-[10px] border border-[#e8edf3] bg-[#f8fafc] py-2 pl-9 pr-3 text-sm placeholder:text-[#64748b]", focusClass)} />
        </div>
      </div>
      <div className="min-h-0 overflow-y-auto overscroll-contain p-3">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(52px,1fr))] items-start gap-x-2 gap-y-3">
        {allLabel && !query.trim() && (
          <motion.button type="button" onClick={onClear} aria-label={allLabel} aria-pressed={allSelected} data-member-all="true" whileTap={{ scale: 0.96 }} className={cn("flex min-h-11 min-w-0 flex-col items-center gap-1.5 rounded-[8px] py-1 hover:bg-[#f3f7ff]", focusClass)}>
            <span aria-hidden="true" className={cn("relative block rounded-full transition-[opacity,filter]", !allSelected && "opacity-50 grayscale")}>
              <GroupImage members={members} renderAvatar={renderAvatar} />
              {allSelected && <span className="absolute bottom-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-[#1677ff] text-white"><Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden="true" /></span>}
            </span>
            <span className="w-full break-words text-center text-sm font-medium text-[#101a31]">전체</span>
          </motion.button>
        )}
        {filtered.map((member) => {
          const active = allSelected || selected.includes(member.id);
          const disabled = !active && max !== undefined && max !== 1 && selected.length >= max;
          return (
            <motion.button key={member.id} type="button" aria-label={`${member.name} 선택`} aria-pressed={active} aria-describedby={`${id}-${member.id}-status`}
              disabled={disabled} onClick={() => onSelect(member.id)} whileTap={{ scale: 0.96 }} data-member-id={member.id}
              className={cn("group flex min-h-11 min-w-0 flex-col items-center gap-1.5 rounded-[8px] py-1 hover:bg-[#f3f7ff] disabled:opacity-50", focusClass)}>
              <span className="relative block h-12 w-12 shrink-0" aria-hidden="true">
                <span data-member-photo="true" className={cn("block h-full w-full overflow-hidden rounded-full transition-[opacity,filter,box-shadow] duration-200", active ? "ring-2 ring-[#60a5fa] ring-offset-2" : "opacity-50 grayscale group-hover:opacity-75")}><MemberImage member={member} renderAvatar={renderAvatar} /></span>
                <span className={cn("absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full", active ? "bg-[#1677ff] text-white" : "bg-[#edf2f8] text-[#526b84]")}>{active ? <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden="true" /> : <Plus className="h-2.5 w-2.5" strokeWidth={2.5} aria-hidden="true" />}</span>
                {member.workStatus === "working" && <span data-member-work-dot={member.id} className="absolute bottom-0 left-0 h-2.5 w-2.5 rounded-full border-2 border-white" style={{ backgroundColor: active ? member.color ?? "#607080" : "#cbd5e1" }} />}
              </span>
              <span className={cn("w-full break-words text-center text-sm font-medium", active ? "text-[#101a31]" : "text-[#64748b]")}>{member.name}</span>
              <span id={`${id}-${member.id}-status`} data-member-work-status={member.workStatus} className={cn("text-xs leading-[18px] text-[#64748b]", member.workStatus !== "off" && "sr-only")}>{member.workStatus === "off" ? "휴무" : member.workStatus === "working" ? "근무" : ""}</span>
            </motion.button>
          );
        })}
        </div>
        {!filtered.length && <p role="status" className="px-3 py-6 text-center text-sm text-[#64748b]">검색 결과가 없습니다.</p>}
      </div>
    </motion.div>
  );
}

const MemberSelector = React.forwardRef<HTMLDivElement, MemberSelectorProps>(function MemberSelector(
  { members, selected, onChange, max, maxVisible = 4, className, allLabel, renderAvatar }, ref,
) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [position, setPosition] = React.useState<React.CSSProperties>({});
  const containerRef = React.useRef<HTMLDivElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const id = React.useId();
  const selectionKey = selected.join("\0");
  const allSelected = !selected.length || members.every((member) => selected.includes(member.id));
  const selectedMembers = members.filter((member) => allSelected || selected.includes(member.id));
  const summary = allSelected && allLabel ? "전체" : selectedMembers.length === 1 ? selectedMembers[0].name : selectedMembers.length ? `${selectedMembers.length}명` : "직원 선택";

  React.useLayoutEffect(() => {
    if (!isOpen) return;
    function updatePosition() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(360, window.innerWidth - 24);
      const below = window.innerHeight - rect.bottom - 20;
      const above = rect.top - 20;
      const openAbove = below < 280 && above > below;
      setPosition({ width, left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)),
        ...(openAbove ? { bottom: window.innerHeight - rect.top + 8 } : { top: rect.bottom + 8 }), maxHeight: Math.max(80, Math.min(440, openAbove ? above : below)) });
    }
    updatePosition();
    const observer = new ResizeObserver(updatePosition);
    if (containerRef.current) observer.observe(containerRef.current);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => { observer.disconnect(); window.removeEventListener("resize", updatePosition); window.removeEventListener("scroll", updatePosition, true); };
  }, [isOpen, selectionKey]);

  React.useEffect(() => {
    if (!isOpen) return;
    function handleOutside(event: Event) {
      if (!containerRef.current?.contains(event.target as Node) && !panelRef.current?.contains(event.target as Node)) setIsOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); setIsOpen(false); triggerRef.current?.focus(); }
    }
    document.addEventListener("pointerdown", handleOutside);
    document.addEventListener("focusin", handleOutside);
    document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("pointerdown", handleOutside); document.removeEventListener("focusin", handleOutside); document.removeEventListener("keydown", handleKey); };
  }, [isOpen]);

  function toggleMember(memberId: string) {
    if (allSelected) onChange([memberId]);
    else if (selected.includes(memberId)) onChange(selected.filter((item) => item !== memberId));
    else if (max === 1) onChange([memberId]);
    else if (max === undefined || selected.length < max) onChange([...selected, memberId]);
  }

  const summaryClass = "flex h-11 w-full min-w-0 items-center justify-center gap-1.5 rounded-[8px] border border-[#dce5ef] bg-white px-2 text-sm font-medium text-[#334155]";
  const summaryContent = <>
    {selectedMembers.length > 0 && <span aria-hidden="true" className="flex shrink-0 -space-x-4">
      {selectedMembers.slice(0, Math.max(0, maxVisible)).map((member) => (
        <span key={member.id} className="block h-6 w-6 overflow-hidden rounded-full ring-2 ring-white">
          <MemberImage member={member} renderAvatar={renderAvatar} />
        </span>
      ))}
    </span>}
    <span data-member-selection-count={selectedMembers.length} className="min-w-0 truncate" title={summary}>{summary}</span>
  </>;

  if (members.length === 1) {
    return <div ref={ref} data-member-selector="single" className={cn(summaryClass, className)}>{summaryContent}</div>;
  }

  return (
    <MotionConfig reducedMotion="user">
      <div ref={ref} data-member-selector="group" className={cn("relative w-[136px] max-w-full", className)}>
        <div ref={containerRef}>
          <button ref={triggerRef} type="button" data-owner-control-size="content" aria-label={`담당 직원 선택: ${summary}`} aria-expanded={isOpen} aria-haspopup="dialog" aria-controls={isOpen ? `${id}-dropdown` : undefined}
            onClick={() => setIsOpen((open) => !open)}
            className={cn(summaryClass, "transition-colors hover:border-[#b8d6fc] hover:bg-[#f4f8ff]", isOpen && "border-[#b8d6fc] bg-[#f4f8ff]", focusClass)}>
            {summaryContent}
            <ChevronDown aria-hidden="true" className={cn("h-3.5 w-3.5 shrink-0 text-[#64748b] transition-transform", isOpen && "rotate-180")} />
          </button>
        </div>
        {typeof document !== "undefined" && createPortal(<AnimatePresence>{isOpen && <MemberDropdown key="dropdown" id={`${id}-dropdown`} panelRef={panelRef} position={position} members={members} selected={selected} onSelect={toggleMember} onClear={() => onChange([])} allLabel={allLabel} max={max} renderAvatar={renderAvatar} />}</AnimatePresence>, document.body)}
      </div>
    </MotionConfig>
  );
});

MemberSelector.displayName = "MemberSelector";
export { MemberSelector };
