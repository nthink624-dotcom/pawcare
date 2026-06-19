// SVG icon components (shared)
const Ig = ({c="#fff",s=20}) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" style={{display:"block"}}>
    <rect x="2.6" y="2.6" width="18.8" height="18.8" rx="5.6" stroke={c} strokeWidth="2.1"/>
    <circle cx="12" cy="12" r="4.3" stroke={c} strokeWidth="2.1"/>
    <circle cx="17.4" cy="6.6" r="1.5" fill={c}/>
  </svg>
);
const Threads = ({c="#fff",s=19}) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill={c} style={{display:"block"}}>
    <path d="M16.7 11.16c-.09-.04-.18-.08-.27-.12-.16-2.93-1.76-4.6-4.45-4.62h-.04c-1.6 0-2.95.69-3.77 1.94l1.48 1.01c.61-.93 1.57-1.13 2.29-1.13h.03c.9 0 1.57.26 2 .77.31.38.52.9.63 1.56-.82-.14-1.7-.18-2.65-.12-2.66.15-4.37 1.7-4.26 3.85.06 1.09.6 2.03 1.53 2.64.79.51 1.8.76 2.86.71 1.4-.08 2.5-.61 3.26-1.59.58-.74.95-1.7 1.11-2.92.68.41 1.18.95 1.46 1.6.47 1.1.5 2.9-.97 4.37-1.29 1.28-2.83 1.84-5.16 1.85-2.58-.02-4.54-.85-5.81-2.46C5.02 16.83 4.41 14.7 4.39 12c.02-2.7.63-4.83 1.81-6.33C7.47 4.06 9.43 3.23 12 3.21c2.59.02 4.58.85 5.91 2.47.65.8 1.15 1.8 1.47 2.98l1.74-.46c-.39-1.45-1-2.7-1.84-3.72C18.6 2.4 16.13 1.34 12.83 1.32h-.01C8.69 1.34 5.95 2.74 4.42 5.06 3.06 7.12 2.36 9.86 2.34 12v.01c.02 2.14.72 4.88 2.08 6.94 1.53 2.32 4.27 3.72 8.41 3.74h.01c3.68-.03 6.27-1 8.4-3.11 2.79-2.76 2.71-6.23 1.79-8.36-.66-1.53-1.92-2.77-3.64-3.6Zm-4.59 6.93c-1.17.07-2.39-.46-2.45-1.57-.04-.83.59-1.75 2.52-1.86.22-.01.44-.02.65-.02.7 0 1.36.07 1.96.2-.22 2.79-1.53 3.18-2.68 3.25Z"/>
  </svg>
);
const Kakao = ({c="#3A1D1D",s=20}) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill={c} style={{display:"block"}}>
    <path d="M12 3.2C6.9 3.2 2.8 6.43 2.8 10.41c0 2.55 1.71 4.79 4.28 6.08-.14.49-.9 3.1-.93 3.31 0 0-.02.16.08.22.1.06.22.02.22.02.29-.04 3.36-2.2 3.94-2.6.52.07 1.06.11 1.61.11 5.1 0 9.2-3.23 9.2-7.21S17.1 3.2 12 3.2Z"/>
  </svg>
);
const Pin = ({c="#fff",s=18}) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
    <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" stroke={c} strokeWidth="1.9" strokeLinejoin="round"/>
    <circle cx="12" cy="10" r="2.4" stroke={c} strokeWidth="1.9"/>
  </svg>
);
const Chat = ({c="#fff",s=18}) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
    <path d="M4 5.5h16v11H9l-4 3.5v-3.5H4v-11Z" stroke={c} strokeWidth="1.9" strokeLinejoin="round"/>
  </svg>
);
const Back = ({c="#3a2e2a",s=22}) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
    <path d="M15 5l-7 7 7 7" stroke={c} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const Check = ({c="#fff",s=42}) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
    <path d="M5 12.5l4.5 4.5L19 7.5" stroke={c} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const Ticket = ({c="#d35f50",s=20}) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
    <path d="M3 8.5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2 1.8 1.8 0 0 0 0 3.6 1.8 1.8 0 0 0 0 3.6 2 2 0 0 1-2 2H5a2 2 0 0 1-2-2 1.8 1.8 0 0 0 0-3.6A1.8 1.8 0 0 0 3 8.5Z" stroke={c} strokeWidth="1.7"/>
    <path d="M14 7v10" stroke={c} strokeWidth="1.7" strokeDasharray="2 2.4"/>
  </svg>
);

Object.assign(window, { Ig, Threads, Kakao, Pin, Chat, Back, Check, Ticket });
