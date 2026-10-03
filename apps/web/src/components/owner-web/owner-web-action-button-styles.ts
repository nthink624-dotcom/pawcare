export const OWNER_WEB_ACTION_BUTTON_BASE_CLASS =
  "pm-owner-action relative inline-flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-[8px] px-4 text-[14px] font-medium leading-5 tracking-[-0.005em] transition after:absolute after:inset-x-0 after:-inset-y-0.5 after:content-[''] disabled:cursor-default disabled:opacity-60";

export const OWNER_WEB_PRIMARY_ACTION_BUTTON_CLASS = `${OWNER_WEB_ACTION_BUTTON_BASE_CLASS} appearance-none border-0 bg-[#1677ff] text-white hover:bg-[#0e65d8]`;

export const OWNER_WEB_SECONDARY_ACTION_BUTTON_CLASS = `${OWNER_WEB_ACTION_BUTTON_BASE_CLASS} border border-[#e8edf3] bg-white text-[#334155] hover:border-[#cbd5e1] hover:bg-[#f8fbff] disabled:bg-[#f8fafc] disabled:text-[#94a3b8]`;

// Kept as aliases while existing calendar/benefit imports migrate to the common size.
export const OWNER_WEB_COMPACT_ACTION_BUTTON_BASE_CLASS = OWNER_WEB_ACTION_BUTTON_BASE_CLASS;

export const OWNER_WEB_COMPACT_PRIMARY_ACTION_BUTTON_CLASS = OWNER_WEB_PRIMARY_ACTION_BUTTON_CLASS;

export const OWNER_WEB_COMPACT_SECONDARY_ACTION_BUTTON_CLASS = OWNER_WEB_SECONDARY_ACTION_BUTTON_CLASS;
