// Multi-colour section icons for the calendar date panel. Decorative: the section title carries the meaning.
// Both share one frame (page from y 4.75 to 21, rings/pin up to y 2.75) so they line up with each other and the title.

type DayPanelIconProps = { size?: number; className?: string };

/** 예약: a white calendar page with a blue header, slate binder rings and a coral paw print. */
export function ReservationSectionIcon({ size = 20, className }: DayPanelIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false" className={className}>
      <rect x="3" y="4.75" width="18" height="16.25" rx="4" fill="#ffffff" stroke="#d5deea" strokeWidth="1.25" />
      <path d="M3 8.75a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v1.5H3z" fill="#4f8bff" />
      <rect x="6.9" y="2.75" width="2.2" height="4.5" rx="1.1" fill="#334155" />
      <rect x="14.9" y="2.75" width="2.2" height="4.5" rx="1.1" fill="#334155" />
      <g fill="#ff8552">
        <ellipse cx="12" cy="16.85" rx="2.6" ry="2.05" />
        <circle cx="9.1" cy="14.55" r="1.02" />
        <circle cx="10.85" cy="12.95" r="1.08" />
        <circle cx="13.15" cy="12.95" r="1.08" />
        <circle cx="14.9" cy="14.55" r="1.02" />
      </g>
    </svg>
  );
}

/** 노트: a yellow sticky note with an amber folded corner, brown lines and a red push pin. */
export function NoteSectionIcon({ size = 20, className }: DayPanelIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false" className={className}>
      <path d="M5.5 4.75h13a2.5 2.5 0 0 1 2.5 2.5v8.5L15.75 21H5.5A2.5 2.5 0 0 1 3 18.5V7.25a2.5 2.5 0 0 1 2.5-2.5z" fill="#ffd94a" />
      <path d="M21 15.75h-2.75a2.5 2.5 0 0 0-2.5 2.5V21z" fill="#f2a900" />
      <path d="M7 11.25h9M7 14.75h5.5" stroke="#a16207" strokeOpacity="0.8" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="5.25" r="2.5" fill="#ef4444" />
      <circle cx="11.2" cy="4.45" r="0.8" fill="#fecaca" />
    </svg>
  );
}
