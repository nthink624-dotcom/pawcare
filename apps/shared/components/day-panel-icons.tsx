// Two-tone section icons for the calendar date panel. Decorative: the section title carries the meaning.

type DayPanelIconProps = { size?: number; className?: string };

/** 예약: a blue calendar page with binder rings and a paw print. */
export function ReservationSectionIcon({ size = 20, className }: DayPanelIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false" className={className}>
      <rect x="3.25" y="4.5" width="17.5" height="16.75" rx="4" fill="#eaf2ff" />
      <path d="M3.25 8.5a4 4 0 0 1 4-4h9.5a4 4 0 0 1 4 4V10H3.25z" fill="#3b82f6" />
      <rect x="3.25" y="4.5" width="17.5" height="16.75" rx="4" stroke="#2563eb" strokeWidth="1.5" />
      <path d="M8 2.75v3.5M16 2.75v3.5" stroke="#1e40af" strokeWidth="1.8" strokeLinecap="round" />
      <g fill="#2563eb">
        <ellipse cx="12" cy="16.9" rx="2.7" ry="2.15" />
        <circle cx="8.95" cy="14.55" r="1.05" />
        <circle cx="10.75" cy="12.85" r="1.1" />
        <circle cx="13.25" cy="12.85" r="1.1" />
        <circle cx="15.05" cy="14.55" r="1.05" />
      </g>
    </svg>
  );
}

/** 노트: a yellow sticky note with a strip of tape and a folded corner. */
export function NoteSectionIcon({ size = 20, className }: DayPanelIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false" className={className}>
      <path
        d="M6.25 4.25h11.5a2.25 2.25 0 0 1 2.25 2.25V15l-5.5 5.5H6.25A2.25 2.25 0 0 1 4 18.25V6.5a2.25 2.25 0 0 1 2.25-2.25z"
        fill="#fde68a"
        stroke="#d97706"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M20 15h-3.25a2.25 2.25 0 0 0-2.25 2.25v3.25z" fill="#f59e0b" stroke="#d97706" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M7.75 9.5h8.5M7.75 13h5" stroke="#b45309" strokeWidth="1.6" strokeLinecap="round" />
      <rect x="9.25" y="2.4" width="5.5" height="3.3" rx="0.9" fill="#fb923c" fillOpacity="0.85" transform="rotate(-6 12 4.05)" />
    </svg>
  );
}
