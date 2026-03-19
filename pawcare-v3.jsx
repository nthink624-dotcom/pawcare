import { useState, useEffect, useCallback, useMemo } from "react";

/* ═══════════════════════════════════════
   STORAGE & UTILS
   ═══════════════════════════════════════ */
const SK = "pawcare-v3";
const uid = () => Math.random().toString(36).slice(2, 9);
const TODAY = "2026-03-15";
const NOW_MINUTES = 10 * 60 + 15; // 10:15 simulation
const addD = (d, n) => { const x = new Date(d + "T00:00:00"); x.setDate(x.getDate() + n); return x.toISOString().split("T")[0]; };
const diffD = (a, b) => Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 864e5);
const fmtD = d => { const x = new Date(d + "T00:00:00"); return `${x.getMonth() + 1}/${x.getDate()}(${["일", "월", "화", "수", "목", "금", "토"][x.getDay()]})`; };
const fmtP = p => (p || 0).toLocaleString() + "원";
const timeToMin = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const minToTime = m => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const DEFAULT_DATA = {
  shop: {
    name: "해피독 애견미용",
    phone: "02-1234-5678",
    address: "서울시 강남구 역삼동 123-4",
    maxConcurrent: 1,
    hours: { 1: [10, 19], 2: [10, 19], 3: [10, 19], 4: [10, 19], 5: [10, 19], 6: [10, 18] },
    holidays: [0],
    tempHolidays: [],
    approvalMode: "manual",
  },
  services: [
    { id: "sv1", name: "전체미용", price: 50000, duration: 120, active: true },
    { id: "sv2", name: "목욕+부분컷", price: 35000, duration: 80, active: true },
    { id: "sv3", name: "목욕", price: 25000, duration: 40, active: true },
    { id: "sv4", name: "위생미용", price: 15000, duration: 30, active: true },
  ],
  guardians: [
    { id: "gu1", name: "김민지", phone: "010-1234-5678" },
    { id: "gu2", name: "박서준", phone: "010-9876-5432" },
    { id: "gu3", name: "이수현", phone: "010-5555-1234" },
  ],
  pets: [
    { id: "p1", guardianId: "gu1", name: "몽이", breed: "말티즈", weight: 3.5, age: 3, notes: "피부 민감, 귀 주의", cycleWeeks: 4 },
    { id: "p2", guardianId: "gu1", name: "달이", breed: "포메라니안", weight: 2.8, age: 1, notes: "첫 미용, 겁 많음", cycleWeeks: 5 },
    { id: "p3", guardianId: "gu2", name: "코코", breed: "푸들", weight: 5.2, age: 5, notes: "발톱 예민, 간식 필요", cycleWeeks: 3 },
    { id: "p4", guardianId: "gu3", name: "보리", breed: "시츄", weight: 4.0, age: 2, notes: "", cycleWeeks: 4 },
  ],
  appointments: [
    { id: "a1", petId: "p1", serviceId: "sv1", date: "2026-03-15", time: "10:00", status: "confirmed", price: 50000, memo: "스포팅컷", startedAt: null, source: "owner" },
    { id: "a2", petId: "p3", serviceId: "sv2", date: "2026-03-15", time: "14:00", status: "confirmed", price: 35000, memo: "", startedAt: null, source: "customer" },
    { id: "a3", petId: "p4", serviceId: "sv1", date: "2026-03-16", time: "11:00", status: "confirmed", price: 45000, memo: "짧게", startedAt: null, source: "customer" },
    { id: "a4", petId: "p2", serviceId: "sv3", date: "2026-03-17", time: "09:30", status: "pending", price: 25000, memo: "", startedAt: null, source: "customer" },
  ],
  records: [
    { id: "g1", petId: "p1", date: "2026-02-15", serviceId: "sv1", style: "스포팅컷 5mm", notes: "귀 안쪽 발적", price: 50000 },
    { id: "g2", petId: "p3", date: "2026-02-22", serviceId: "sv1", style: "테디베어컷", notes: "발톱 꼼꼼 정리", price: 50000 },
    { id: "g3", petId: "p4", date: "2026-02-10", serviceId: "sv1", style: "퍼피컷", notes: "첫 미용, 순함", price: 45000 },
    { id: "g4", petId: "p1", date: "2026-01-18", serviceId: "sv2", style: "얼굴컷", notes: "", price: 35000 },
  ],
  notifications: [],
};

/* ═══ STYLES ═══ */
const fontLink = document.createElement("link");
fontLink.href = "https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700;800&display=swap";
fontLink.rel = "stylesheet";
document.head.appendChild(fontLink);

const CSS = `
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
:root{
  --bg:#f5f4f2;--s:#fff;--sh:#f8f7f5;--b:#e5e1db;--bl:#eeeae5;
  --t:#2a2623;--t2:#847b72;--t3:#b0a89f;
  --a:#c96b4f;--al:#fceee9;--ad:#a8533a;
  --g:#4e9462;--gl:#eaf5ed;--y:#b89a3e;--yl:#f9f4e0;
  --r:14px;--rs:10px;--rx:6px;
  --f:'Noto Sans KR',system-ui,sans-serif;
}
body,button,input,select,textarea{font-family:var(--f)}
body{background:var(--bg);color:var(--t);overflow:hidden;position:fixed;width:100%;height:100%}
.app{display:flex;flex-direction:column;height:calc(100dvh - 62px);max-width:430px;margin:0 auto;background:var(--bg);position:relative;overflow:hidden}
.topbar{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--s);border-bottom:1px solid var(--bl);flex-shrink:0;z-index:10}
.topbar h1{font-size:16px;font-weight:700}.topbar small{font-size:11px;color:var(--t2);display:block;margin-top:1px}
.bnav{display:flex;background:var(--s);border-top:1px solid var(--bl);flex-shrink:0;padding-bottom:env(safe-area-inset-bottom);min-height:48px}
.bnav button{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:5px 0 3px;gap:1px;border:none;background:none;cursor:pointer;position:relative;min-width:0}
.bnav button span{font-size:9px;font-weight:600;color:var(--t3)}.bnav button.on span{color:var(--a)}
.bnav .ic{font-size:18px;filter:grayscale(1) opacity(.45)}.bnav button.on .ic{filter:none}
.bnav .bdg{position:absolute;top:2px;right:calc(50% - 16px);background:#ef4444;color:#fff;font-size:8px;font-weight:700;padding:1px 4px;border-radius:8px}
.page{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch}.page::-webkit-scrollbar{display:none}
.card{background:var(--s);border-radius:var(--r);margin:10px 14px;box-shadow:0 1px 3px rgba(0,0,0,.05)}
.card-h{padding:12px 14px;font-size:12px;font-weight:700;color:var(--t2);display:flex;align-items:center;justify-content:space-between}
.card-b{padding:0 14px 12px}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:0 14px;margin-top:10px}
.stat{background:var(--s);border-radius:var(--rs);padding:12px 8px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.05);transition:.15s;border:1.5px solid transparent}
.stat:active{transform:scale(.95);background:var(--sh)}
.stat b{font-size:20px;font-weight:800;display:block;letter-spacing:-1px}.stat small{font-size:9px;color:var(--t2);font-weight:600;display:block;margin-top:3px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:4px;border:none;border-radius:var(--rx);font-weight:600;cursor:pointer;transition:.15s;font-size:12px;padding:7px 12px}
.btn:active{transform:scale(.97)}.btn-p{background:var(--a);color:#fff}.btn-p:active{background:var(--ad)}
.btn-s{background:var(--s);color:var(--t);border:1px solid var(--b)}.btn-s:active{background:var(--sh)}
.btn-g{background:var(--g);color:#fff}.btn-d{background:#fef2f2;color:#dc2626;border:1px solid #fecaca}
.btn-ghost{background:none;border:none;color:var(--t2);padding:4px 8px;font-size:11px}
.btn-full{width:100%;padding:13px;font-size:14px;border-radius:var(--rs)}
.badge{display:inline-flex;padding:2px 8px;border-radius:16px;font-size:10px;font-weight:700}
.row{display:flex;align-items:center;gap:10px;padding:11px 0;border-bottom:1px solid var(--bl)}
.row:last-child{border-bottom:none}
.ava{border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.sheet-bg{position:fixed;inset:0;background:rgba(0,0,0,.3);z-index:50;animation:fi .12s}
.sheet{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:430px;background:var(--s);border-radius:18px 18px 0 0;z-index:51;max-height:90dvh;overflow-y:auto;animation:su .22s ease;padding-bottom:env(safe-area-inset-bottom)}
.sheet-bar{width:32px;height:4px;background:var(--b);border-radius:2px;margin:8px auto 0}
.sheet-hd{padding:14px 18px 10px;display:flex;align-items:center;justify-content:space-between}
.sheet-hd h3{font-size:15px;font-weight:700}.sheet-bd{padding:0 18px 18px}.sheet-ft{padding:10px 18px 14px;border-top:1px solid var(--bl);display:flex;gap:8px}
@keyframes fi{from{opacity:0}to{opacity:1}}@keyframes su{from{transform:translateX(-50%) translateY(100%)}to{transform:translateX(-50%) translateY(0)}}
.fg{margin-bottom:12px}.fg label{display:block;font-size:11px;font-weight:700;color:var(--t2);margin-bottom:4px}
.fg input,.fg select,.fg textarea{width:100%;padding:9px 11px;border:1px solid var(--b);border-radius:var(--rx);font-size:13px;background:var(--s);color:var(--t)}
.fg input:focus,.fg select:focus,.fg textarea:focus{outline:none;border-color:var(--a);box-shadow:0 0 0 3px var(--al)}
.fg textarea{resize:vertical;min-height:44px}.frow{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.toast{position:fixed;bottom:68px;left:50%;transform:translateX(-50%);background:var(--t);color:#fff;padding:11px 16px;border-radius:var(--rs);z-index:200;animation:su2 .2s;font-size:12px;font-weight:500;display:flex;gap:6px;white-space:nowrap;box-shadow:0 6px 20px rgba(0,0,0,.2)}
@keyframes su2{from{opacity:0;transform:translateX(-50%) translateY(12px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
.empty{text-align:center;padding:28px 16px;color:var(--t3)}.empty .ic{font-size:28px;margin-bottom:6px}.empty p{font-size:11px}
.search{margin:10px 14px;display:flex;align-items:center;gap:7px;background:var(--s);border:1px solid var(--b);border-radius:var(--rs);padding:8px 11px}
.search input{border:none;outline:none;flex:1;font-size:13px;background:transparent}
.mode-sw{display:flex;max-width:430px;margin:0 auto;background:var(--s);border-bottom:1px solid var(--bl);padding:6px 14px;height:42px;align-items:center}
.mode-sw button{flex:1;padding:8px;text-align:center;font-size:11px;font-weight:700;border:none;cursor:pointer;border-radius:var(--rx);transition:.15s;color:var(--t2);background:none}
.mode-sw button.on{background:var(--a);color:#fff}
.mode-info{text-align:center;font-size:9px;color:var(--t3);padding:3px 0 4px;max-width:430px;margin:0 auto;background:var(--s);border-bottom:1px solid var(--bl);height:20px}
.d-info{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:10px 14px}
.d-item{padding:9px 10px;background:var(--sh);border-radius:var(--rx)}.d-item label{font-size:9px;font-weight:700;color:var(--t3)}.d-item p{font-size:12px;font-weight:600;margin-top:2px}
.d-tabs{display:flex;margin:0 14px;border-bottom:1px solid var(--bl)}.d-tab{flex:1;text-align:center;padding:9px 0;font-size:11px;font-weight:600;color:var(--t3);border:none;background:none;border-bottom:2px solid transparent;cursor:pointer}
.d-tab.on{color:var(--ad);border-bottom-color:var(--a)}
.rec{margin:6px 14px;padding:10px 12px;border:1px solid var(--bl);border-radius:var(--rs)}
.rec-top{display:flex;justify-content:space-between;margin-bottom:3px}.rec-top .dt{font-size:10px;color:var(--t2)}.rec-top .sv{font-size:11px;font-weight:700}
.rec-body{font-size:10px;color:var(--t2);line-height:1.5}.rec-body b{color:var(--t)}
.rv{display:flex;align-items:center;gap:9px;padding:10px 14px;margin:0 14px 6px;border-radius:var(--rs)}
.rv.overdue{background:#fef2f2;border:1px solid #fecaca}.rv.soon{background:var(--yl);border:1px solid #e5d78f}.rv.ok{background:var(--gl);border:1px solid #b5d4bc}
.set-row{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid var(--bl);cursor:pointer}
.set-row:active{background:var(--sh)}
.svc-row{display:flex;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid var(--bl)}
.svc-row:last-child{border-bottom:none}
.cv{max-width:430px;margin:0 auto;min-height:calc(100dvh - 62px);background:var(--bg)}
.cv-top{background:var(--a);color:#fff;padding:24px 18px 18px;text-align:center}
.cv-top h1{font-size:18px;font-weight:800;margin-bottom:3px}.cv-top p{font-size:11px;opacity:.8}
.cv-card{background:var(--s);margin:10px 14px;border-radius:var(--r);padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.06)}
.cv-card h3{font-size:13px;font-weight:700;margin-bottom:10px;display:flex;align-items:center;gap:5px}
.cv-svc{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:10px}
.cv-svc-item{padding:10px 12px;border:2px solid var(--b);border-radius:var(--rs);font-size:12px;font-weight:600;cursor:pointer;transition:.12s;flex:1;min-width:45%;text-align:center}
.cv-svc-item.sel{border-color:var(--a);background:var(--al);color:var(--ad)}
.cv-tg{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}
.cv-ts{padding:8px 0;text-align:center;border:1.5px solid var(--b);border-radius:var(--rx);font-size:12px;font-weight:600;cursor:pointer;transition:.12s}
.cv-ts.sel{border-color:var(--a);background:var(--al);color:var(--ad)}.cv-ts.off{opacity:.25;pointer-events:none;text-decoration:line-through}
.status-track{display:flex;align-items:center;padding:10px 0;gap:0}
.status-dot{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0}
.status-line{flex:1;height:3px;border-radius:2px}
`;

const EMOJIS = ["🐶", "🐩", "🐕", "🦮", "🐾", "🐕‍🦺"];
const COLORS = [{ bg: "#fceee9", c: "#c96b4f" }, { bg: "#eaf2f8", c: "#5279b0" }, { bg: "#eaf5ed", c: "#4e9462" }, { bg: "#f9f4e0", c: "#b89a3e" }, { bg: "#f0eaf8", c: "#8268b0" }];
const pe = id => EMOJIS[(id || "x").charCodeAt((id || "x").length - 1) % EMOJIS.length];
const pc = id => COLORS[(id || "x").charCodeAt((id || "x").length - 1) % COLORS.length];

const ST_MAP = {
  pending: { l: "승인대기", c: "#f59e0b", bg: "#fef3c7", ic: "⏳" },
  confirmed: { l: "확정", c: "#10b981", bg: "#d1fae5", ic: "✅" },
  in_progress: { l: "미용중", c: "#6366f1", bg: "#e0e7ff", ic: "✂️" },
  almost_done: { l: "거의완료", c: "#8b5cf6", bg: "#ede9fe", ic: "💇" },
  completed: { l: "완료", c: "#6b7280", bg: "#f3f4f6", ic: "🎀" },
  cancelled: { l: "취소", c: "#ef4444", bg: "#fee2e2", ic: "❌" },
  noshow: { l: "노쇼", c: "#ef4444", bg: "#fee2e2", ic: "🚫" },
};

/* ═══════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════ */
export default function App() {
  const [mode, setMode] = useState("owner");
  const [D, setD] = useState(DEFAULT_DATA);
  const [ok, setOk] = useState(false);
  const [pg, setPg] = useState("home");
  const [sh, setSh] = useState(null);
  const [toast, setToast] = useState(null);
  const [selPet, setSelPet] = useState(null);
  const [ctab, setCTab] = useState("info");
  const [search, setSearch] = useState("");
  const [setPg2, setSetPg2] = useState(null); // settings sub-page

  useEffect(() => { (async () => { try { const r = await window.storage.get(SK); if (r?.value) setD(JSON.parse(r.value)); } catch (e) { } setOk(true); })(); }, []);
  const save = useCallback(async (n) => { setD(n); try { await window.storage.set(SK, JSON.stringify(n)); } catch (e) { } }, []);
  const flash = useCallback((e, m) => { setToast({ e, m }); setTimeout(() => setToast(null), 2500); }, []);

  // ── Lookups ──
  const getPet = useCallback(id => D.pets.find(p => p.id === id), [D.pets]);
  const getGuardian = useCallback(id => D.guardians.find(g => g.id === id), [D.guardians]);
  const getSvc = useCallback(id => D.services.find(s => s.id === id), [D.services]);
  const guardianOf = useCallback(petId => { const p = getPet(petId); return p ? getGuardian(p.guardianId) : null; }, [getPet, getGuardian]);
  const petsOf = useCallback(gid => D.pets.filter(p => p.guardianId === gid), [D.pets]);

  const getLastRec = useCallback(pid => {
    const r = D.records.filter(x => x.petId === pid).sort((a, b) => b.date.localeCompare(a.date));
    return r[0] || null;
  }, [D.records]);

  const getRevisit = useCallback(pet => {
    const last = getLastRec(pet.id);
    if (!last) return { due: null, days: null, st: "unknown" };
    const due = addD(last.date, pet.cycleWeeks * 7);
    const days = diffD(TODAY, due);
    return { due, days, st: days < 0 ? "overdue" : days <= 5 ? "soon" : "ok" };
  }, [getLastRec]);

  // ── Appointment helpers ──
  const todayAppts = useMemo(() =>
    D.appointments.filter(a => a.date === TODAY && !["cancelled", "noshow"].includes(a.status))
      .sort((a, b) => a.time.localeCompare(b.time)), [D.appointments]);

  const pendingCount = useMemo(() => D.appointments.filter(a => a.status === "pending").length, [D.appointments]);

  const revisits = useMemo(() =>
    D.pets.map(p => ({ pet: p, guardian: getGuardian(p.guardianId), ...getRevisit(p) }))
      .filter(r => r.st !== "unknown").sort((a, b) => (a.days || 0) - (b.days || 0)),
    [D.pets, getGuardian, getRevisit]);
  const urgentCount = revisits.filter(r => r.st === "overdue" || r.st === "soon").length;

  // ── Conflict check: is time slot available? ──
  const isSlotAvailable = useCallback((date, startMin, durationMin, excludeId) => {
    const endMin = startMin + durationMin;
    const dayAppts = D.appointments.filter(a => a.date === date && !["cancelled", "noshow"].includes(a.status) && a.id !== excludeId);
    let concurrent = 0;
    // Check each minute in the new slot for max concurrent
    for (let m = startMin; m < endMin; m += 30) {
      let count = 0;
      for (const a of dayAppts) {
        const svc = getSvc(a.serviceId);
        const aStart = timeToMin(a.time);
        const aEnd = aStart + (svc?.duration || 60);
        if (m >= aStart && m < aEnd) count++;
      }
      if (count >= D.shop.maxConcurrent) return false;
    }
    return true;
  }, [D.appointments, D.shop.maxConcurrent, getSvc]);

  // ── Get available slots for a date ──
  const getAvailableSlots = useCallback((date, serviceId) => {
    const d = new Date(date + "T00:00:00");
    const dow = d.getDay();
    if (D.shop.holidays.includes(dow)) return [];
    if (D.shop.tempHolidays?.includes(date)) return [];
    const hours = D.shop.hours[dow];
    if (!hours) return [];
    const svc = getSvc(serviceId);
    const dur = svc?.duration || 60;
    const slots = [];
    for (let m = hours[0] * 60; m + dur <= hours[1] * 60; m += 30) {
      if (isSlotAvailable(date, m, dur, null)) {
        slots.push(minToTime(m));
      }
    }
    return slots;
  }, [D.shop, getSvc, isSlotAvailable]);

  // ── Status actions ──
  const updateStatus = (aid, ns) => {
    let appts = D.appointments.map(a => {
      if (a.id !== aid) return a;
      const upd = { ...a, status: ns };
      if (ns === "in_progress") upd.startedAt = NOW_MINUTES;
      return upd;
    });
    let recs = D.records;
    let notifs = [...D.notifications];
    const ap = D.appointments.find(a => a.id === aid);
    const pet = getPet(ap?.petId);
    const guard = pet ? getGuardian(pet.guardianId) : null;
    if (ns === "completed" && ap) {
      recs = [...recs, { id: "g" + uid(), petId: ap.petId, date: ap.date, serviceId: ap.serviceId, style: ap.memo || "", notes: "", price: ap.price }];
      notifs.push({ id: "n" + uid(), guardianId: guard?.id, type: "completed", msg: `${pet?.name} 미용 완료! 픽업 가능합니다 🎀`, sentAt: "now" });
      flash("✅", `${pet?.name} 미용 완료! 픽업 알림 발송됨`);
    }
    if (ns === "confirmed" && ap) {
      notifs.push({ id: "n" + uid(), guardianId: guard?.id, type: "confirmed", msg: `${pet?.name} 예약이 확정되었어요!`, sentAt: "now" });
      flash("✅", `${pet?.name} 예약 확정! 고객에게 알림 발송`);
    }
    if (ns === "in_progress") flash("✂️", `${pet?.name} 미용 시작!`);
    save({ ...D, appointments: appts, records: recs, notifications: notifs });
  };

  const addAppt = (f) => {
    const svc = getSvc(f.serviceId);
    if (!isSlotAvailable(f.date, timeToMin(f.time), svc?.duration || 60, null)) {
      flash("⚠️", "해당 시간에 이미 예약이 있습니다!");
      return;
    }
    const status = f.source === "owner" ? "confirmed" : (D.shop.approvalMode === "auto" ? "confirmed" : "pending");
    save({ ...D, appointments: [...D.appointments, { ...f, id: "a" + uid(), status, startedAt: null }] });
    flash("📅", status === "pending" ? "예약 접수됨 (승인 대기)" : "예약 등록 완료!");
    setSh(null);
  };

  const addGuardianPet = (gf, pf) => {
    const gid = "gu" + uid();
    const pid = "p" + uid();
    save({
      ...D,
      guardians: [...D.guardians, { ...gf, id: gid }],
      pets: [...D.pets, { ...pf, id: pid, guardianId: gid }],
    });
    flash("🐾", `${pf.name} 등록 완료!`);
    setSh(null);
  };

  const addPetToGuardian = (gid, pf) => {
    save({ ...D, pets: [...D.pets, { ...pf, id: "p" + uid(), guardianId: gid }] });
    flash("🐾", `${pf.name} 추가 등록!`);
    setSh(null);
  };

  // Auto status: check if any in_progress should be "almost done"
  const autoAlmostDone = useMemo(() => {
    return D.appointments.filter(a => {
      if (a.status !== "in_progress" || !a.startedAt) return false;
      const svc = getSvc(a.serviceId);
      const elapsed = NOW_MINUTES - a.startedAt;
      return elapsed >= (svc?.duration || 60) * 0.8;
    });
  }, [D.appointments, getSvc]);

  if (!ok) return <><style>{CSS}</style><div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100dvh", flexDirection: "column", gap: 6 }}><div style={{ fontSize: 32 }}>✂️</div><div style={{ fontSize: 12, color: "var(--t2)" }}>불러오는 중...</div></div></>;

  return (
    <>
      <style>{CSS}</style>
      <div className="mode-sw">
        <button className={mode === "owner" ? "on" : ""} onClick={() => setMode("owner")}>🔑 사장님용</button>
        <button className={mode === "customer" ? "on" : ""} onClick={() => setMode("customer")}>👤 고객 예약</button>
      </div>
      <div className="mode-info">{mode === "owner" ? "매장 관리 앱" : "앱 설치 없이 링크로 접속하는 고객 예약 페이지"}</div>

      {mode === "owner" ? (
        <div className="app">
          <div className="topbar">
            <div>
              <h1>{pg === "home" ? "홈" : pg === "book" ? "예약" : pg === "cust" ? (selPet ? selPet.name : "고객") : pg === "rv" ? "재방문" : "설정"}</h1>
              {pg === "home" && <small>{fmtD(TODAY)} · {D.shop.name}</small>}
            </div>
            <div style={{ display: "flex", gap: 5 }}>
              {pendingCount > 0 && pg === "home" && <span className="badge" style={{ background: "#fef3c7", color: "#f59e0b" }}>⏳ 승인대기 {pendingCount}</span>}
              {(pg === "home" || pg === "book") && <button className="btn btn-p" style={{ fontSize: 11 }} onClick={() => setSh({ t: "newAppt" })}>+ 예약</button>}
              {pg === "cust" && !selPet && <button className="btn btn-p" style={{ fontSize: 11 }} onClick={() => setSh({ t: "newCust" })}>+ 고객</button>}
            </div>
          </div>

          <div className="page">
            {/* ═══ HOME ═══ */}
            {pg === "home" && <>
              <div className="stats">
                <div className="stat" style={{cursor:"pointer",border:todayAppts.length>0?"1.5px solid var(--a)":"none"}} onClick={()=>setSh({t:"statToday"})}>
                  <b>{todayAppts.length}</b><small>오늘 예약</small>
                  {todayAppts.length>0&&<div style={{fontSize:8,color:"var(--a)",marginTop:2}}>터치하여 보기</div>}
                </div>
                <div className="stat" style={{cursor:"pointer"}} onClick={()=>setSh({t:"statRevenue"})}>
                  <b style={{ color: "var(--a)" }}>{(todayAppts.reduce((s, a) => s + (a.price || 0), 0) / 10000).toFixed(0)}<span style={{ fontSize: 12 }}>만</span></b><small>예상매출</small>
                </div>
                <div className="stat" style={{cursor:"pointer",border:pendingCount>0?"1.5px solid #f59e0b":"none"}} onClick={()=>setSh({t:"statPending"})}>
                  <b style={{ color: "#f59e0b" }}>{pendingCount}</b><small>승인대기</small>
                  {pendingCount>0&&<div style={{fontSize:8,color:"#f59e0b",marginTop:2}}>터치하여 보기</div>}
                </div>
                <div className="stat" style={{cursor:"pointer",border:revisits.filter(r=>r.st==="overdue").length>0?"1.5px solid #ef4444":"none"}} onClick={()=>setSh({t:"statOverdue"})}>
                  <b style={{ color: "#ef4444" }}>{revisits.filter(r => r.st === "overdue").length}</b><small>재방문초과</small>
                  {revisits.filter(r=>r.st==="overdue").length>0&&<div style={{fontSize:8,color:"#ef4444",marginTop:2}}>터치하여 보기</div>}
                </div>
              </div>

              {/* Pending approvals */}
              {pendingCount > 0 && <div className="card">
                <div className="card-h">⏳ 승인 대기 예약</div>
                <div className="card-b">
                  {D.appointments.filter(a => a.status === "pending").map(a => {
                    const pet = getPet(a.petId); const guard = guardianOf(a.petId); const svc = getSvc(a.serviceId);
                    return <div key={a.id} className="row">
                      <div className="ava" style={{ width: 32, height: 32, background: pc(a.petId).bg, fontSize: 14 }}>{pe(a.petId)}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{pet?.name} ({guard?.name})</div>
                        <div style={{ fontSize: 10, color: "var(--t2)" }}>{fmtD(a.date)} {a.time} · {svc?.name} · {svc?.duration}분</div>
                      </div>
                      <button className="btn btn-g" style={{ fontSize: 10, padding: "5px 8px" }} onClick={() => updateStatus(a.id, "confirmed")}>✅ 확정</button>
                      <button className="btn btn-d" style={{ fontSize: 10, padding: "5px 8px" }} onClick={() => updateStatus(a.id, "cancelled")}>거절</button>
                    </div>;
                  })}
                </div>
              </div>}

              {/* Today */}
              <div className="card">
                <div className="card-h">📋 오늘 예약 <span style={{ fontSize: 10, color: "var(--a)" }}>{todayAppts.length}건</span></div>
                <div className="card-b">
                  {todayAppts.length === 0 ? <div className="empty"><div className="ic">📅</div><p>오늘 예약 없음</p></div> :
                    todayAppts.map(a => {
                      const pet = getPet(a.petId); const guard = guardianOf(a.petId); const svc = getSvc(a.serviceId); const st = ST_MAP[a.status];
                      const isAlmost = autoAlmostDone.find(x => x.id === a.id);
                      const displaySt = isAlmost ? ST_MAP.almost_done : st;
                      return <div key={a.id} className="row" onClick={() => setSh({ t: "viewAppt", appt: a })} style={{ cursor: "pointer" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--t2)", width: 38 }}>{a.time}</div>
                        <div className="ava" style={{ width: 32, height: 32, background: pc(a.petId).bg, fontSize: 14 }}>{pe(a.petId)}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pet?.name} <span style={{ fontWeight: 400, color: "var(--t2)", fontSize: 10 }}>({guard?.name})</span></div>
                          <div style={{ fontSize: 10, color: "var(--t2)" }}>{svc?.name} · {svc?.duration}분 · {fmtP(a.price)}</div>
                        </div>
                        {a.status === "confirmed" && <button className="btn btn-s" style={{ fontSize: 10, padding: "5px 8px" }} onClick={e => { e.stopPropagation(); updateStatus(a.id, "in_progress"); }}>🎨 시작</button>}
                        {a.status === "in_progress" && <button className="btn btn-g" style={{ fontSize: 10, padding: "5px 8px" }} onClick={e => { e.stopPropagation(); updateStatus(a.id, "completed"); }}>✅ 완료</button>}
                        {!["confirmed", "in_progress"].includes(a.status) && <span className="badge" style={{ background: displaySt.bg, color: displaySt.c, fontSize: 9 }}>{displaySt.ic} {displaySt.l}</span>}
                      </div>;
                    })}
                </div>
              </div>

              {/* Revisit preview */}
              <div className="card">
                <div className="card-h">🔔 재방문 <button className="btn-ghost" onClick={() => setPg("rv")}>전체 →</button></div>
                <div className="card-b">{revisits.slice(0, 3).map(r => <div key={r.pet.id} className="row">
                  <div className="ava" style={{ width: 28, height: 28, background: pc(r.pet.id).bg, fontSize: 12 }}>{pe(r.pet.id)}</div>
                  <div style={{ flex: 1 }}><div style={{ fontSize: 11, fontWeight: 600 }}>{r.pet.name}</div><div style={{ fontSize: 9, color: "var(--t2)" }}>{r.pet.cycleWeeks}주 주기</div></div>
                  <div style={{ fontWeight: 800, fontSize: 12, color: r.st === "overdue" ? "#ef4444" : r.st === "soon" ? "#b89a3e" : "var(--g)" }}>{r.days < 0 ? `${Math.abs(r.days)}일초과` : `${r.days}일`}</div>
                </div>)}</div>
              </div>
            </>}

            {/* ═══ BOOKINGS ═══ */}
            {pg === "book" && <>
              {[0, 1, 2, 3, 4, 5, 6].map(i => {
                const d = addD(TODAY, i);
                const dayA = D.appointments.filter(a => a.date === d && !["cancelled", "noshow"].includes(a.status)).sort((a, b) => a.time.localeCompare(b.time));
                if (dayA.length === 0) return null;
                return <div key={d}>
                  <div style={{ padding: "10px 14px 3px", fontSize: 12, fontWeight: 700, color: d === TODAY ? "var(--a)" : "var(--t2)" }}>{fmtD(d)} {d === TODAY && "· 오늘"}</div>
                  {dayA.map(a => {
                    const pet = getPet(a.petId); const guard = guardianOf(a.petId); const svc = getSvc(a.serviceId); const st = ST_MAP[a.status];
                    return <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", borderBottom: "1px solid var(--bl)", cursor: "pointer" }} onClick={() => setSh({ t: "viewAppt", appt: a })}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--t2)", width: 36 }}>{a.time}</div>
                      <div className="ava" style={{ width: 28, height: 28, background: pc(a.petId).bg, fontSize: 12 }}>{pe(a.petId)}</div>
                      <div style={{ flex: 1 }}><div style={{ fontSize: 11, fontWeight: 600 }}>{pet?.name} ({guard?.name})</div><div style={{ fontSize: 9, color: "var(--t2)" }}>{svc?.name} · {svc?.duration}분</div></div>
                      <span className="badge" style={{ background: st.bg, color: st.c, fontSize: 9 }}>{st.l}</span>
                    </div>;
                  })}
                </div>;
              })}
            </>}

            {/* ═══ CUSTOMERS ═══ */}
            {pg === "cust" && !selPet && <>
              <div className="search"><span>🔍</span><input placeholder="이름, 반려견, 전화번호 검색" value={search} onChange={e => setSearch(e.target.value)} /></div>
              {D.guardians.filter(g => {
                const q = search;
                const pets = petsOf(g.id);
                return g.name.includes(q) || g.phone.includes(q) || pets.some(p => p.name.includes(q) || p.breed.includes(q));
              }).map(g => {
                const pets = petsOf(g.id);
                return <div key={g.id}>
                  <div style={{ padding: "10px 14px 4px", fontSize: 11, fontWeight: 700, color: "var(--t2)" }}>{g.name} · {g.phone} · 반려견 {pets.length}마리</div>
                  {pets.map(p => {
                    const last = getLastRec(p.id); const rv = getRevisit(p); const col = pc(p.id);
                    return <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 14px", borderBottom: "1px solid var(--bl)", cursor: "pointer" }}
                      onClick={() => { setSelPet(p); setCTab("info"); }}>
                      <div className="ava" style={{ width: 36, height: 36, background: col.bg, fontSize: 16 }}>{pe(p.id)}</div>
                      <div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 600 }}>{p.name} <span style={{ fontWeight: 400, color: "var(--t2)", fontSize: 10 }}>· {p.breed}</span></div>
                        <div style={{ fontSize: 10, color: "var(--t2)" }}>{p.cycleWeeks}주 주기 · {last ? `최근 ${fmtD(last.date)}` : "기록 없음"}</div></div>
                      {p.notes && <span style={{ fontSize: 10, color: "#f59e0b" }}>⚠️</span>}
                    </div>;
                  })}
                  <div style={{ padding: "4px 14px 8px" }}>
                    <button className="btn btn-s" style={{ fontSize: 10 }} onClick={() => setSh({ t: "addPet", guardianId: g.id })}>+ 반려견 추가</button>
                  </div>
                </div>;
              })}
            </>}
            {pg === "cust" && selPet && (() => {
              const guard = getGuardian(selPet.guardianId);
              const rv = getRevisit(selPet);
              const recs = D.records.filter(r => r.petId === selPet.id).sort((a, b) => b.date.localeCompare(a.date));
              const appts = D.appointments.filter(a => a.petId === selPet.id).sort((a, b) => b.date.localeCompare(a.date));
              const siblings = petsOf(selPet.guardianId).filter(p => p.id !== selPet.id);
              return <>
                <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 7 }}>
                  <button className="btn-ghost" onClick={() => setSelPet(null)}>← 목록</button>
                  <div className="ava" style={{ width: 32, height: 32, background: pc(selPet.id).bg, fontSize: 14 }}>{pe(selPet.id)}</div>
                  <div><div style={{ fontSize: 13, fontWeight: 700 }}>{selPet.name}</div><div style={{ fontSize: 10, color: "var(--t2)" }}>{guard?.name} · {guard?.phone}</div></div>
                </div>
                {siblings.length > 0 && <div style={{ padding: "0 14px 6px", fontSize: 10, color: "var(--t2)" }}>🐾 함께 키우는 아이: {siblings.map(s => s.name).join(", ")}</div>}
                <div className="d-tabs">
                  {[{ k: "info", l: "정보" }, { k: "rec", l: `기록(${recs.length})` }, { k: "apt", l: `예약(${appts.length})` }].map(t =>
                    <button key={t.k} className={`d-tab ${ctab === t.k ? "on" : ""}`} onClick={() => setCTab(t.k)}>{t.l}</button>)}
                </div>
                {ctab === "info" && <>
                  <div className="d-info">
                    <div className="d-item"><label>견종</label><p>{selPet.breed}</p></div>
                    <div className="d-item"><label>체중</label><p>{selPet.weight}kg</p></div>
                    <div className="d-item"><label>나이</label><p>{selPet.age}살</p></div>
                    <div className="d-item"><label>주기</label><p>{selPet.cycleWeeks}주</p></div>
                    <div className="d-item"><label>재방문</label><p style={{ color: rv.st === "overdue" ? "#ef4444" : rv.st === "soon" ? "#b89a3e" : "var(--g)", fontSize: 11 }}>{rv.due ? `${fmtD(rv.due)} (${rv.days < 0 ? Math.abs(rv.days) + "일 초과" : rv.days + "일 후"})` : "-"}</p></div>
                    <div className="d-item"><label>보호자</label><p>{guard?.name}</p></div>
                  </div>
                  {selPet.notes && <div style={{ margin: "0 14px", padding: 10, background: "#fef3c7", borderRadius: "var(--rx)", fontSize: 11, color: "#78350f" }}>⚠️ {selPet.notes}</div>}
                  <div style={{ padding: 14 }}><button className="btn btn-p btn-full" onClick={() => setSh({ t: "newAppt", prefillPet: selPet.id })}>📅 예약 등록</button></div>
                </>}
                {ctab === "rec" && (recs.length === 0 ? <div className="empty"><div className="ic">✂️</div><p>기록 없음</p></div> :
                  recs.map(r => { const svc = getSvc(r.serviceId); return <div key={r.id} className="rec">
                    <div className="rec-top"><span className="dt">{fmtD(r.date)}</span><div style={{display:"flex",gap:4,alignItems:"center"}}><span className="sv">{svc?.name}</span>
                      <button className="btn btn-ghost" style={{fontSize:9,padding:"2px 6px",color:"var(--a)"}} onClick={()=>setSh({t:"editRecord",record:r})}>✏️ 수정</button></div></div>
                    <div className="rec-body">{r.style && <><b>스타일:</b> {r.style}<br /></>}{r.notes && <><b>메모:</b> {r.notes}<br /></>}<b>금액:</b> {fmtP(r.price)}</div>
                  </div>; })
                )}
                {ctab === "apt" && (appts.length === 0 ? <div className="empty"><div className="ic">📅</div><p>예약 없음</p></div> :
                  appts.map(a => { const svc = getSvc(a.serviceId); const st = ST_MAP[a.status]; return <div key={a.id} className="rec"><div className="rec-top"><span className="dt">{fmtD(a.date)} {a.time}</span><span className="badge" style={{ background: st.bg, color: st.c }}>{st.l}</span></div><div className="rec-body"><b>{svc?.name}</b> · {svc?.duration}분 · {fmtP(a.price)}{a.memo && <> · {a.memo}</>}</div></div>; })
                )}
              </>;
            })()}

            {/* ═══ REVISIT ═══ */}
            {pg === "rv" && <>
              <div style={{ padding: "10px 14px 6px", fontSize: 11, color: "var(--t2)" }}>마지막 방문 + 미용주기 자동 계산</div>
              {revisits.map(r => <div key={r.pet.id} className={`rv ${r.st}`}>
                <div className="ava" style={{ width: 30, height: 30, background: pc(r.pet.id).bg, fontSize: 14 }}>{pe(r.pet.id)}</div>
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 11, fontWeight: 600 }}>{r.pet.name} <span style={{ fontWeight: 400, color: "var(--t2)", fontSize: 10 }}>({r.guardian?.name})</span></div>
                  <div style={{ fontSize: 9, color: "var(--t2)" }}>최근: {getLastRec(r.pet.id) ? fmtD(getLastRec(r.pet.id).date) : "-"} · {r.pet.cycleWeeks}주</div></div>
                <div style={{ fontWeight: 800, fontSize: 13, color: r.st === "overdue" ? "#ef4444" : r.st === "soon" ? "#b89a3e" : "var(--g)", textAlign: "right" }}>
                  {r.days < 0 ? `${Math.abs(r.days)}일` : `${r.days}일`}<div style={{ fontSize: 8, fontWeight: 600, color: "var(--t2)" }}>{r.days < 0 ? "초과" : "남음"}</div></div>
                <button className="btn btn-p" style={{ fontSize: 9, padding: "4px 8px" }} onClick={() => flash("💬", `${r.guardian?.name}님에게 알림톡 발송!`)}>알림</button>
              </div>)}
            </>}

            {/* ═══ SETTINGS ═══ */}
            {pg === "set" && !setPg2 && <>
              <div className="card"><div className="card-h">🏠 매장 정보</div><div className="card-b">
                <div style={{ fontSize: 13, fontWeight: 600 }}>{D.shop.name}</div>
                <div style={{ fontSize: 11, color: "var(--t2)", marginTop: 2 }}>{D.shop.phone} · {D.shop.address}</div>
                <div style={{ fontSize: 10, color: "var(--t2)", marginTop: 4 }}>동시 예약: {D.shop.maxConcurrent}건 · 승인: {D.shop.approvalMode === "auto" ? "자동확정" : "수동확정"}</div>
              </div></div>
              <div className="card">
                <div className="set-row" onClick={() => setSetPg2("services")}><span style={{ fontSize: 13 }}>✂️ 서비스 관리</span><span style={{ fontSize: 11, color: "var(--t3)" }}>{D.services.filter(s => s.active).length}개 →</span></div>
                <div className="set-row" onClick={() => setSetPg2("hours")}><span style={{ fontSize: 13 }}>🕐 영업시간</span><span style={{ fontSize: 11, color: "var(--t3)" }}>→</span></div>
                <div className="set-row" onClick={() => setSetPg2("shop")}><span style={{ fontSize: 13 }}>🏠 매장 정보 수정</span><span style={{ fontSize: 11, color: "var(--t3)" }}>→</span></div>
                <div className="set-row" onClick={() => setSetPg2("policy")}><span style={{ fontSize: 13 }}>📋 예약 정책</span><span style={{ fontSize: 11, color: "var(--t3)" }}>→</span></div>
              </div>
              <div className="card"><div className="card-h">📊 알림 이력 (최근)</div><div className="card-b">
                {D.notifications.length === 0 ? <div className="empty"><p>발송 이력 없음</p></div> :
                  D.notifications.slice(-5).reverse().map(n => <div key={n.id} style={{ fontSize: 10, color: "var(--t2)", padding: "4px 0", borderBottom: "1px solid var(--bl)" }}>{n.msg}</div>)}
              </div></div>
              <div style={{ padding: "12px 14px" }}>
                <button className="btn btn-d btn-full" onClick={() => { save(DEFAULT_DATA); flash("🔄", "데이터 초기화 완료"); }}>데이터 초기화</button>
              </div>
            </>}
            {pg === "set" && setPg2 === "services" && <>
              <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 6 }}>
                <button className="btn-ghost" onClick={() => setSetPg2(null)}>← 설정</button>
                <span style={{ fontWeight: 700, fontSize: 14 }}>서비스 관리</span>
                <button className="btn btn-p" style={{ marginLeft: "auto", fontSize: 10 }} onClick={() => setSh({ t: "newSvc" })}>+ 추가</button>
              </div>
              {D.services.map(s => <div key={s.id} className="svc-row" style={{ padding: "10px 14px" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name} {!s.active && <span style={{ fontSize: 9, color: "var(--t3)" }}>(비활성)</span>}</div>
                  <div style={{ fontSize: 11, color: "var(--t2)" }}>{fmtP(s.price)} · {s.duration}분</div>
                </div>
                <button className="btn btn-s" style={{ fontSize: 10 }} onClick={() => setSh({ t: "editSvc", svc: s })}>수정</button>
                <button className="btn btn-ghost" style={{ fontSize: 10, color: s.active ? "#ef4444" : "var(--g)" }}
                  onClick={() => save({ ...D, services: D.services.map(x => x.id === s.id ? { ...x, active: !x.active } : x) })}>
                  {s.active ? "비활성" : "활성화"}
                </button>
              </div>)}
            </>}
            {pg === "set" && setPg2 === "hours" && <>
              <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 6 }}>
                <button className="btn-ghost" onClick={() => setSetPg2(null)}>← 설정</button>
                <span style={{ fontWeight: 700, fontSize: 14 }}>영업시간 / 휴무일</span>
              </div>
              {[0, 1, 2, 3, 4, 5, 6].map(dow => {
                const isHoliday = D.shop.holidays.includes(dow);
                const hrs = D.shop.hours[dow];
                return <div key={dow} style={{ display: "flex", alignItems: "center", padding: "10px 14px", borderBottom: "1px solid var(--bl)", gap: 8 }}>
                  <div style={{ width: 28, fontWeight: 700, fontSize: 13, color: dow === 0 ? "#ef4444" : "var(--t)" }}>{WEEKDAYS[dow]}</div>
                  {isHoliday ? <span style={{ fontSize: 12, color: "#ef4444", fontWeight: 600 }}>휴무</span> :
                    <span style={{ fontSize: 12, fontWeight: 500 }}>{hrs ? `${hrs[0]}:00 ~ ${hrs[1]}:00` : "-"}</span>}
                  <button className="btn btn-ghost" style={{ marginLeft: "auto", fontSize: 10, color: isHoliday ? "var(--g)" : "#ef4444" }}
                    onClick={() => {
                      const hols = isHoliday ? D.shop.holidays.filter(h => h !== dow) : [...D.shop.holidays, dow];
                      const hrs2 = { ...D.shop.hours };
                      if (!isHoliday) delete hrs2[dow]; else hrs2[dow] = [10, 19];
                      save({ ...D, shop: { ...D.shop, holidays: hols, hours: hrs2 } });
                    }}>
                    {isHoliday ? "영업 전환" : "휴무 전환"}
                  </button>
                </div>;
              })}
              {/* ── 임시휴무 관리 ── */}
              <div style={{padding:"14px",borderTop:"1px solid var(--bl)"}}>
                <div style={{fontSize:12,fontWeight:700,marginBottom:8}}>📅 임시휴무 (특정일)</div>
                <div style={{display:"flex",gap:6,marginBottom:10}}>
                  <input type="date" id="tempHolInput" style={{flex:1,padding:"8px 10px",border:"1px solid var(--b)",borderRadius:"var(--rx)",fontSize:13,fontFamily:"var(--f)"}} min={TODAY}/>
                  <button className="btn btn-p" style={{fontSize:11}} onClick={()=>{
                    const inp=document.getElementById("tempHolInput");
                    if(inp.value && !D.shop.tempHolidays.includes(inp.value)){
                      save({...D, shop:{...D.shop, tempHolidays:[...D.shop.tempHolidays, inp.value].sort()}});
                      flash("📅",`${fmtD(inp.value)} 임시휴무 등록!`);
                      inp.value="";
                    }
                  }}>추가</button>
                </div>
                {D.shop.tempHolidays.length===0 ? <div style={{fontSize:10,color:"var(--t3)"}}>등록된 임시휴무 없음</div> :
                  D.shop.tempHolidays.map(d=>(
                    <div key={d} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid var(--bl)"}}>
                      <span style={{fontSize:12,fontWeight:600,color:"#ef4444"}}>🚫 {fmtD(d)}</span>
                      <button className="btn btn-ghost" style={{fontSize:10,color:"var(--g)"}} onClick={()=>{
                        save({...D, shop:{...D.shop, tempHolidays:D.shop.tempHolidays.filter(x=>x!==d)}});
                        flash("✅","임시휴무 해제");
                      }}>해제</button>
                    </div>
                  ))}
              </div>
            </>}
            {pg === "set" && setPg2 === "shop" && <ShopEditPage D={D} save={save} flash={flash} back={() => setSetPg2(null)} />}
            {pg === "set" && setPg2 === "policy" && <>
              <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 6 }}>
                <button className="btn-ghost" onClick={() => setSetPg2(null)}>← 설정</button>
                <span style={{ fontWeight: 700, fontSize: 14 }}>예약 정책</span>
              </div>
              <div className="card"><div className="card-b" style={{ paddingTop: 14 }}>
                <div className="fg"><label>예약 승인 방식</label>
                  <select value={D.shop.approvalMode} onChange={e => save({ ...D, shop: { ...D.shop, approvalMode: e.target.value } })}>
                    <option value="manual">수동 확정 (사장님 승인 필요)</option>
                    <option value="auto">자동 확정</option>
                  </select>
                </div>
                <div className="fg"><label>동시 예약 가능 수</label>
                  <select value={D.shop.maxConcurrent} onChange={e => save({ ...D, shop: { ...D.shop, maxConcurrent: parseInt(e.target.value) } })}>
                    {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}건 (미용사 {n}명)</option>)}
                  </select>
                </div>
              </div></div>
            </>}
          </div>

          <nav className="bnav">
            {[
              { k: "home", ic: "🏠", l: "홈" },
              { k: "book", ic: "📅", l: "예약" },
              { k: "cust", ic: "👥", l: "고객" },
              { k: "rv", ic: "🔔", l: "재방문", b: urgentCount },
              { k: "set", ic: "⚙️", l: "설정" },
            ].map(n => <button key={n.k} className={pg === n.k ? "on" : ""} onClick={() => { setPg(n.k); setSelPet(null); setSetPg2(null); }}>
              <span className="ic">{n.ic}{n.b > 0 && <span className="bdg">{n.b}</span>}</span><span>{n.l}</span>
            </button>)}
          </nav>

          {/* Sheets */}
          {sh && <>
            <div className="sheet-bg" onClick={() => setSh(null)} />
            <div className="sheet">
              <div className="sheet-bar" />
              {sh.t === "viewAppt" && <ApptSheet a={sh.appt} getPet={getPet} guardianOf={guardianOf} getSvc={getSvc} ST_MAP={ST_MAP} autoAlmostDone={autoAlmostDone} updateStatus={updateStatus} flash={flash} close={() => setSh(null)} />}
              {sh.t === "newAppt" && <NewApptSheet D={D} getSvc={getSvc} getPet={getPet} guardianOf={guardianOf} getAvailableSlots={getAvailableSlots} addAppt={addAppt} close={() => setSh(null)} prefillPet={sh.prefillPet} />}
              {sh.t === "newCust" && <NewCustSheet onSave={addGuardianPet} close={() => setSh(null)} />}
              {sh.t === "addPet" && <AddPetSheet guardianId={sh.guardianId} onSave={addPetToGuardian} close={() => setSh(null)} />}
              {sh.t === "newSvc" && <SvcSheet onSave={s => { save({ ...D, services: [...D.services, { ...s, id: "sv" + uid(), active: true }] }); flash("✂️", "서비스 추가!"); setSh(null); }} close={() => setSh(null)} />}
              {sh.t === "editSvc" && <SvcSheet svc={sh.svc} onSave={s => { save({ ...D, services: D.services.map(x => x.id === sh.svc.id ? { ...x, ...s } : x) }); flash("✂️", "수정 완료!"); setSh(null); }} close={() => setSh(null)} />}

              {/* ── 미용 기록 수정 ── */}
              {sh.t === "editRecord" && <EditRecordSheet record={sh.record} services={D.services} onSave={upd => {
                save({...D, records: D.records.map(r => r.id === sh.record.id ? {...r, ...upd} : r)});
                flash("✏️","미용 기록 수정 완료!");
                setSh(null);
              }} close={() => setSh(null)} />}

              {/* ── 오늘 예약 상세 ── */}
              {sh.t === "statToday" && <>
                <div className="sheet-hd"><h3>📋 오늘 예약 ({todayAppts.length}건)</h3><button className="btn-ghost" onClick={()=>setSh(null)}>✕</button></div>
                <div className="sheet-bd">
                  {todayAppts.length === 0 ? <div className="empty"><div className="ic">📅</div><p>오늘 예약이 없습니다</p></div> :
                  <>
                    <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0 12px",borderBottom:"1px solid var(--bl)",marginBottom:8}}>
                      <div style={{fontSize:11,color:"var(--t2)"}}>총 {todayAppts.length}건</div>
                      <div style={{fontSize:13,fontWeight:800,color:"var(--a)"}}>{fmtP(todayAppts.reduce((s,a)=>s+(a.price||0),0))}</div>
                    </div>
                    {todayAppts.map(a => {
                      const pet = getPet(a.petId); const guard = guardianOf(a.petId); const svc = getSvc(a.serviceId); const st = ST_MAP[a.status];
                      const isAlmost = autoAlmostDone.find(x => x.id === a.id);
                      const displaySt = isAlmost ? ST_MAP.almost_done : st;
                      return <div key={a.id} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 0",borderBottom:"1px solid var(--bl)",cursor:"pointer"}}
                        onClick={()=>setSh({t:"viewAppt",appt:a})}>
                        <div style={{fontSize:12,fontWeight:700,color:"var(--t2)",width:38}}>{a.time}</div>
                        <div className="ava" style={{width:32,height:32,background:pc(a.petId).bg,fontSize:14}}>{pe(a.petId)}</div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:12,fontWeight:600}}>{pet?.name} <span style={{fontWeight:400,color:"var(--t2)",fontSize:10}}>({guard?.name})</span></div>
                          <div style={{fontSize:10,color:"var(--t2)"}}>{svc?.name} · {svc?.duration}분 · {fmtP(a.price)}</div>
                          {a.memo && <div style={{fontSize:9,color:"var(--t3)",marginTop:1}}>📝 {a.memo}</div>}
                          {pet?.notes && <div style={{fontSize:9,color:"#f59e0b",marginTop:1}}>⚠️ {pet.notes}</div>}
                        </div>
                        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3}}>
                          <span className="badge" style={{background:displaySt.bg,color:displaySt.c,fontSize:9}}>{displaySt.ic} {displaySt.l}</span>
                          {a.status==="confirmed"&&<button className="btn btn-s" style={{fontSize:9,padding:"3px 6px"}} onClick={e=>{e.stopPropagation();updateStatus(a.id,"in_progress")}}>🎨 시작</button>}
                          {a.status==="in_progress"&&<button className="btn btn-g" style={{fontSize:9,padding:"3px 6px"}} onClick={e=>{e.stopPropagation();updateStatus(a.id,"completed")}}>✅ 완료</button>}
                        </div>
                      </div>;
                    })}
                    <div style={{marginTop:12,padding:10,background:"var(--sh)",borderRadius:"var(--rx)",fontSize:10,color:"var(--t2)"}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                        <span>확정</span><b>{todayAppts.filter(a=>a.status==="confirmed").length}건</b>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                        <span>미용중</span><b>{todayAppts.filter(a=>a.status==="in_progress").length}건</b>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                        <span>완료</span><b>{todayAppts.filter(a=>a.status==="completed").length}건</b>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between"}}>
                        <span>대기</span><b>{todayAppts.filter(a=>a.status==="pending").length}건</b>
                      </div>
                    </div>
                  </>}
                </div>
              </>}

              {/* ── 예상매출 상세 ── */}
              {sh.t === "statRevenue" && <>
                <div className="sheet-hd"><h3>💰 오늘 매출 상세</h3><button className="btn-ghost" onClick={()=>setSh(null)}>✕</button></div>
                <div className="sheet-bd">
                  <div style={{textAlign:"center",padding:"12px 0 16px",borderBottom:"1px solid var(--bl)"}}>
                    <div style={{fontSize:28,fontWeight:800,color:"var(--a)"}}>{fmtP(todayAppts.reduce((s,a)=>s+(a.price||0),0))}</div>
                    <div style={{fontSize:11,color:"var(--t2)",marginTop:4}}>오늘 예상 매출 ({todayAppts.length}건)</div>
                  </div>
                  {todayAppts.length === 0 ? <div className="empty" style={{paddingTop:16}}><p>오늘 예약이 없습니다</p></div> :
                  <>
                    {/* 서비스별 매출 */}
                    <div style={{fontSize:11,fontWeight:700,color:"var(--t2)",padding:"12px 0 6px"}}>서비스별 매출</div>
                    {D.services.filter(s=>s.active).map(svc => {
                      const svcAppts = todayAppts.filter(a=>a.serviceId===svc.id);
                      if(svcAppts.length===0) return null;
                      const total = svcAppts.reduce((s,a)=>s+(a.price||0),0);
                      return <div key={svc.id} style={{display:"flex",alignItems:"center",padding:"8px 0",borderBottom:"1px solid var(--bl)"}}>
                        <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600}}>{svc.name}</div><div style={{fontSize:10,color:"var(--t2)"}}>{svcAppts.length}건</div></div>
                        <div style={{fontSize:13,fontWeight:700}}>{fmtP(total)}</div>
                      </div>;
                    })}
                    {/* 건별 상세 */}
                    <div style={{fontSize:11,fontWeight:700,color:"var(--t2)",padding:"12px 0 6px"}}>건별 상세</div>
                    {todayAppts.map(a => {
                      const pet = getPet(a.petId); const guard = guardianOf(a.petId); const svc = getSvc(a.serviceId); const st = ST_MAP[a.status];
                      return <div key={a.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:"1px solid var(--bl)"}}>
                        <div style={{fontSize:11,color:"var(--t2)",width:36}}>{a.time}</div>
                        <div style={{flex:1}}><div style={{fontSize:11,fontWeight:600}}>{pet?.name} <span style={{fontWeight:400,color:"var(--t2)",fontSize:9}}>({guard?.name})</span></div>
                        <div style={{fontSize:9,color:"var(--t2)"}}>{svc?.name}</div></div>
                        <span className="badge" style={{background:st.bg,color:st.c,fontSize:8}}>{st.l}</span>
                        <div style={{fontSize:12,fontWeight:700,width:60,textAlign:"right"}}>{fmtP(a.price)}</div>
                      </div>;
                    })}
                  </>}
                </div>
              </>}

              {/* ── 승인대기 상세 ── */}
              {sh.t === "statPending" && (()=>{
                const pendings = D.appointments.filter(a=>a.status==="pending");
                return <>
                  <div className="sheet-hd"><h3>⏳ 승인 대기 ({pendings.length}건)</h3><button className="btn-ghost" onClick={()=>setSh(null)}>✕</button></div>
                  <div className="sheet-bd">
                    {pendings.length === 0 ? <div className="empty"><div className="ic">✅</div><p>승인 대기 중인 예약이 없습니다</p></div> :
                    <>
                      <div style={{fontSize:10,color:"var(--t2)",marginBottom:10,padding:"6px 10px",background:"var(--yl)",borderRadius:"var(--rx)"}}>
                        ⏳ 고객이 예약 페이지에서 접수한 예약입니다. 확인 후 확정 또는 거절해주세요.
                      </div>
                      {pendings.map(a => {
                        const pet = getPet(a.petId); const guard = guardianOf(a.petId); const svc = getSvc(a.serviceId);
                        return <div key={a.id} style={{padding:"12px 0",borderBottom:"1px solid var(--bl)"}}>
                          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                            <div className="ava" style={{width:36,height:36,background:pc(a.petId).bg,fontSize:16}}>{pe(a.petId)}</div>
                            <div style={{flex:1}}>
                              <div style={{fontSize:13,fontWeight:700}}>{pet?.name}</div>
                              <div style={{fontSize:11,color:"var(--t2)"}}>{guard?.name} · {guard?.phone}</div>
                            </div>
                            {a.source==="customer"&&<span style={{fontSize:9,color:"var(--t3)",background:"var(--sh)",padding:"2px 6px",borderRadius:4}}>👤 고객접수</span>}
                          </div>
                          <div className="d-info" style={{margin:"0 0 8px"}}>
                            <div className="d-item"><label>날짜</label><p>{fmtD(a.date)}</p></div>
                            <div className="d-item"><label>시간</label><p>{a.time}</p></div>
                            <div className="d-item"><label>서비스</label><p>{svc?.name} ({svc?.duration}분)</p></div>
                            <div className="d-item"><label>금액</label><p>{fmtP(a.price)}</p></div>
                          </div>
                          {a.memo && <div style={{fontSize:10,color:"var(--t2)",marginBottom:6,padding:"4px 8px",background:"var(--sh)",borderRadius:"var(--rx)"}}>📝 {a.memo}</div>}
                          {pet?.notes && <div style={{fontSize:10,color:"#78350f",marginBottom:6,padding:"4px 8px",background:"#fef3c7",borderRadius:"var(--rx)"}}>⚠️ {pet.notes}</div>}
                          <div style={{display:"flex",gap:6}}>
                            <button className="btn btn-g" style={{flex:1}} onClick={()=>{updateStatus(a.id,"confirmed")}}>✅ 예약 확정</button>
                            <button className="btn btn-d" onClick={()=>{updateStatus(a.id,"cancelled");flash("❌","거절됨")}}>거절</button>
                          </div>
                        </div>;
                      })}
                    </>}
                  </div>
                </>;
              })()}

              {/* ── 재방문 초과 상세 ── */}
              {sh.t === "statOverdue" && (()=>{
                const overdueList = revisits.filter(r=>r.st==="overdue");
                const soonList = revisits.filter(r=>r.st==="soon");
                return <>
                  <div className="sheet-hd"><h3>🔔 재방문 알림</h3><button className="btn-ghost" onClick={()=>setSh(null)}>✕</button></div>
                  <div className="sheet-bd">
                    {overdueList.length > 0 && <>
                      <div style={{fontSize:11,fontWeight:700,color:"#ef4444",marginBottom:6}}>🚨 기한 초과 ({overdueList.length}명)</div>
                      {overdueList.map(r => {
                        const last = getLastRec(r.pet.id);
                        return <div key={r.pet.id} style={{padding:"10px 0",borderBottom:"1px solid var(--bl)"}}>
                          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                            <div className="ava" style={{width:34,height:34,background:pc(r.pet.id).bg,fontSize:14}}>{pe(r.pet.id)}</div>
                            <div style={{flex:1}}>
                              <div style={{fontSize:12,fontWeight:700}}>{r.pet.name} <span style={{fontWeight:400,color:"var(--t2)",fontSize:10}}>({r.guardian?.name})</span></div>
                              <div style={{fontSize:10,color:"var(--t2)"}}>📞 {r.guardian?.phone}</div>
                            </div>
                            <div style={{textAlign:"right"}}>
                              <div style={{fontSize:16,fontWeight:800,color:"#ef4444"}}>{Math.abs(r.days)}일</div>
                              <div style={{fontSize:8,color:"#ef4444",fontWeight:600}}>초과</div>
                            </div>
                          </div>
                          <div style={{fontSize:10,color:"var(--t2)",marginBottom:6}}>
                            마지막 방문: {last?fmtD(last.date):"-"} · {r.pet.cycleWeeks}주 주기 · 예정일: {r.due?fmtD(r.due):"-"}
                          </div>
                          <div style={{display:"flex",gap:6}}>
                            <button className="btn btn-p" style={{flex:1,fontSize:11}} onClick={()=>flash("💬",`${r.guardian?.name}님에게 재방문 알림톡 발송!`)}>💬 알림톡 발송</button>
                            <button className="btn btn-s" style={{fontSize:11}} onClick={()=>flash("📞",`${r.guardian?.name}님(${r.guardian?.phone})`)}>📞 전화</button>
                          </div>
                        </div>;
                      })}
                    </>}
                    {soonList.length > 0 && <>
                      <div style={{fontSize:11,fontWeight:700,color:"#b89a3e",margin:"12px 0 6px"}}>⏰ 곧 도래 ({soonList.length}명)</div>
                      {soonList.map(r => {
                        const last = getLastRec(r.pet.id);
                        return <div key={r.pet.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderBottom:"1px solid var(--bl)"}}>
                          <div className="ava" style={{width:30,height:30,background:pc(r.pet.id).bg,fontSize:12}}>{pe(r.pet.id)}</div>
                          <div style={{flex:1}}>
                            <div style={{fontSize:11,fontWeight:600}}>{r.pet.name} ({r.guardian?.name})</div>
                            <div style={{fontSize:9,color:"var(--t2)"}}>{r.pet.cycleWeeks}주 주기 · {r.days}일 남음</div>
                          </div>
                          <button className="btn btn-p" style={{fontSize:9,padding:"4px 8px"}} onClick={()=>flash("💬",`${r.guardian?.name}님에게 알림톡!`)}>알림</button>
                        </div>;
                      })}
                    </>}
                    {overdueList.length===0 && soonList.length===0 && <div className="empty"><div className="ic">✅</div><p>재방문 초과/임박 고객이 없습니다</p></div>}
                    <div style={{marginTop:12}}><button className="btn btn-s btn-full" onClick={()=>{setSh(null);setPg("rv")}}>전체 재방문 목록 보기 →</button></div>
                  </div>
                </>;
              })()}
            </div>
          </>}
        </div>
      ) : (
        /* ═══ CUSTOMER VIEW ═══ */
        <CustomerView D={D} getSvc={getSvc} getAvailableSlots={getAvailableSlots} addAppt={addAppt} flash={flash} save={save} isSlotAvailable={isSlotAvailable} />
      )}

      {toast && <div className="toast"><span style={{ fontSize: 14 }}>{toast.e}</span>{toast.m}</div>}
    </>
  );
}

/* ═══ SHEETS ═══ */
function ApptSheet({ a, getPet, guardianOf, getSvc, ST_MAP, autoAlmostDone, updateStatus, flash, close }) {
  const pet = getPet(a.petId); const guard = guardianOf(a.petId); const svc = getSvc(a.serviceId);
  const st = ST_MAP[a.status]; const isAlmost = autoAlmostDone.find(x => x.id === a.id);
  const displaySt = isAlmost ? ST_MAP.almost_done : st;
  return <>
    <div className="sheet-hd"><h3>예약 상세</h3><button className="btn-ghost" onClick={close}>✕</button></div>
    <div className="sheet-bd">
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
        <div className="ava" style={{ width: 40, height: 40, background: pc(a.petId).bg, fontSize: 18 }}>{pe(a.petId)}</div>
        <div><div style={{ fontSize: 14, fontWeight: 700 }}>{pet?.name}</div><div style={{ fontSize: 11, color: "var(--t2)" }}>{guard?.name} · {guard?.phone}</div></div>
        <span className="badge" style={{ background: displaySt.bg, color: displaySt.c, marginLeft: "auto" }}>{displaySt.ic} {displaySt.l}</span>
      </div>
      <div className="d-info" style={{ margin: "0 0 10px" }}>
        <div className="d-item"><label>날짜</label><p>{fmtD(a.date)}</p></div>
        <div className="d-item"><label>시간</label><p>{a.time}</p></div>
        <div className="d-item"><label>서비스</label><p>{svc?.name} ({svc?.duration}분)</p></div>
        <div className="d-item"><label>금액</label><p>{fmtP(a.price)}</p></div>
      </div>
      {a.memo && <div style={{ padding: 9, background: "var(--sh)", borderRadius: "var(--rx)", fontSize: 11, marginBottom: 6 }}>📝 {a.memo}</div>}
      {pet?.notes && <div style={{ padding: 9, background: "#fef3c7", borderRadius: "var(--rx)", fontSize: 10, color: "#78350f" }}>⚠️ {pet.notes}</div>}
      {a.source === "customer" && <div style={{ marginTop: 6, fontSize: 10, color: "var(--t3)" }}>👤 고객 예약페이지에서 접수됨</div>}
    </div>
    <div className="sheet-ft">
      {a.status === "pending" && <><button className="btn btn-g" style={{ flex: 1 }} onClick={() => { updateStatus(a.id, "confirmed"); close(); }}>✅ 예약 확정</button><button className="btn btn-d" onClick={() => { updateStatus(a.id, "cancelled"); close(); flash("❌", "거절됨"); }}>거절</button></>}
      {a.status === "confirmed" && <button className="btn btn-p" style={{ flex: 1 }} onClick={() => { updateStatus(a.id, "in_progress"); close(); }}>🎨 미용 시작</button>}
      {a.status === "in_progress" && <button className="btn btn-g" style={{ flex: 1 }} onClick={() => { updateStatus(a.id, "completed"); close(); }}>✅ 미용 완료 + 픽업 알림</button>}
      {["confirmed", "pending"].includes(a.status) && <button className="btn btn-d" onClick={() => { updateStatus(a.id, "cancelled"); close(); flash("❌", "취소됨"); }}>취소</button>}
      {a.status === "confirmed" && <button className="btn btn-s" style={{ fontSize: 10, color: "#ef4444" }} onClick={() => { updateStatus(a.id, "noshow"); close(); flash("🚫", "노쇼 처리"); }}>노쇼</button>}
    </div>
  </>;
}

function NewApptSheet({ D, getSvc, getPet, guardianOf, getAvailableSlots, addAppt, close, prefillPet }) {
  const [petId, setPetId] = useState(prefillPet || "");
  const [svcId, setSvcId] = useState(D.services[0]?.id || "");
  const [date, setDate] = useState(TODAY);
  const [time, setTime] = useState("");
  const [price, setPrice] = useState(D.services[0]?.price || 0);
  const [memo, setMemo] = useState("");

  const slots = useMemo(() => svcId && date ? getAvailableSlots(date, svcId) : [], [svcId, date, getAvailableSlots]);
  useEffect(() => { const s = getSvc(svcId); if (s) setPrice(s.price); }, [svcId, getSvc]);
  useEffect(() => { setTime(""); }, [date, svcId]);

  const canSave = petId && svcId && date && time;
  return <>
    <div className="sheet-hd"><h3>📅 새 예약</h3><button className="btn-ghost" onClick={close}>✕</button></div>
    <div className="sheet-bd">
      <div className="fg"><label>반려견 *</label>
        <select value={petId} onChange={e => setPetId(e.target.value)}>
          <option value="">선택</option>
          {D.pets.map(p => { const g = guardianOf(p.id); return <option key={p.id} value={p.id}>{p.name} ({g?.name}) - {p.breed}</option>; })}
        </select>
      </div>
      <div className="fg"><label>서비스 *</label>
        <select value={svcId} onChange={e => setSvcId(e.target.value)}>
          {D.services.filter(s => s.active).map(s => <option key={s.id} value={s.id}>{s.name} ({s.duration}분 · {fmtP(s.price)})</option>)}
        </select>
      </div>
      <div className="frow">
        <div className="fg"><label>날짜 *</label><input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
        <div className="fg"><label>시간 * {slots.length > 0 && <span style={{ color: "var(--g)" }}>({slots.length}개 가능)</span>}</label>
          <select value={time} onChange={e => setTime(e.target.value)}>
            <option value="">선택</option>
            {slots.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {date && svcId && slots.length === 0 && <div style={{ fontSize: 10, color: "#ef4444", marginTop: 4 }}>❌ 이 날짜에 가능한 시간이 없습니다</div>}
        </div>
      </div>
      <div className="frow">
        <div className="fg"><label>금액</label><input type="number" value={price} onChange={e => setPrice(parseInt(e.target.value) || 0)} /></div>
        <div className="fg"><label>메모</label><input value={memo} onChange={e => setMemo(e.target.value)} placeholder="스타일 요청" /></div>
      </div>
    </div>
    <div className="sheet-ft">
      <button className="btn btn-p btn-full" disabled={!canSave} style={{ opacity: canSave ? 1 : .5 }}
        onClick={() => canSave && addAppt({ petId, serviceId: svcId, date, time, price, memo, source: "owner" })}>예약 등록</button>
    </div>
  </>;
}

function NewCustSheet({ onSave, close }) {
  const [gf, setGf] = useState({ name: "", phone: "" });
  const [pf, setPf] = useState({ name: "", breed: "", weight: "", age: "", notes: "", cycleWeeks: 4 });
  const ok = gf.name && gf.phone && pf.name;
  return <>
    <div className="sheet-hd"><h3>🐾 새 고객</h3><button className="btn-ghost" onClick={close}>✕</button></div>
    <div className="sheet-bd">
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--a)", marginBottom: 8 }}>보호자 정보</div>
      <div className="frow"><div className="fg"><label>이름 *</label><input value={gf.name} onChange={e => setGf({ ...gf, name: e.target.value })} placeholder="김민지" /></div>
        <div className="fg"><label>전화번호 *</label><input value={gf.phone} onChange={e => setGf({ ...gf, phone: e.target.value })} placeholder="010-0000-0000" /></div></div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--a)", margin: "8px 0" }}>반려견 정보</div>
      <div className="frow"><div className="fg"><label>이름 *</label><input value={pf.name} onChange={e => setPf({ ...pf, name: e.target.value })} placeholder="몽이" /></div>
        <div className="fg"><label>견종</label><input value={pf.breed} onChange={e => setPf({ ...pf, breed: e.target.value })} placeholder="말티즈" /></div></div>
      <div className="frow"><div className="fg"><label>체중(kg)</label><input type="number" value={pf.weight} onChange={e => setPf({ ...pf, weight: e.target.value })} /></div>
        <div className="fg"><label>주기</label><select value={pf.cycleWeeks} onChange={e => setPf({ ...pf, cycleWeeks: parseInt(e.target.value) })}>{[2, 3, 4, 5, 6, 8].map(w => <option key={w} value={w}>{w}주</option>)}</select></div></div>
      <div className="fg"><label>특이사항</label><textarea value={pf.notes} onChange={e => setPf({ ...pf, notes: e.target.value })} placeholder="알러지, 성격 등" /></div>
    </div>
    <div className="sheet-ft"><button className="btn btn-p btn-full" disabled={!ok} style={{ opacity: ok ? 1 : .5 }} onClick={() => ok && onSave(gf, pf)}>등록</button></div>
  </>;
}

function AddPetSheet({ guardianId, onSave, close }) {
  const [pf, setPf] = useState({ name: "", breed: "", weight: "", age: "", notes: "", cycleWeeks: 4 });
  const ok = pf.name;
  return <>
    <div className="sheet-hd"><h3>🐾 반려견 추가</h3><button className="btn-ghost" onClick={close}>✕</button></div>
    <div className="sheet-bd">
      <div className="frow"><div className="fg"><label>이름 *</label><input value={pf.name} onChange={e => setPf({ ...pf, name: e.target.value })} /></div>
        <div className="fg"><label>견종</label><input value={pf.breed} onChange={e => setPf({ ...pf, breed: e.target.value })} /></div></div>
      <div className="frow"><div className="fg"><label>체중(kg)</label><input type="number" value={pf.weight} onChange={e => setPf({ ...pf, weight: e.target.value })} /></div>
        <div className="fg"><label>주기</label><select value={pf.cycleWeeks} onChange={e => setPf({ ...pf, cycleWeeks: parseInt(e.target.value) })}>{[2, 3, 4, 5, 6, 8].map(w => <option key={w} value={w}>{w}주</option>)}</select></div></div>
      <div className="fg"><label>특이사항</label><textarea value={pf.notes} onChange={e => setPf({ ...pf, notes: e.target.value })} /></div>
    </div>
    <div className="sheet-ft"><button className="btn btn-p btn-full" disabled={!ok} style={{ opacity: ok ? 1 : .5 }} onClick={() => ok && onSave(guardianId, pf)}>추가</button></div>
  </>;
}

function SvcSheet({ svc, onSave, close }) {
  const [f, setF] = useState(svc ? { name: svc.name, price: svc.price, duration: svc.duration } : { name: "", price: 0, duration: 60 });
  return <>
    <div className="sheet-hd"><h3>✂️ {svc ? "서비스 수정" : "서비스 추가"}</h3><button className="btn-ghost" onClick={close}>✕</button></div>
    <div className="sheet-bd">
      <div className="fg"><label>서비스명 *</label><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></div>
      <div className="frow">
        <div className="fg"><label>가격 (원)</label><input type="number" value={f.price} onChange={e => setF({ ...f, price: parseInt(e.target.value) || 0 })} /></div>
        <div className="fg"><label>소요시간 (분) *</label>
          <select value={f.duration} onChange={e => setF({ ...f, duration: parseInt(e.target.value) })}>
            {[30, 40, 60, 80, 90, 120, 150, 180].map(m => <option key={m} value={m}>{m}분 ({(m / 60).toFixed(1)}시간)</option>)}
          </select>
        </div>
      </div>
    </div>
    <div className="sheet-ft"><button className="btn btn-p btn-full" disabled={!f.name} style={{ opacity: f.name ? 1 : .5 }} onClick={() => f.name && onSave(f)}>{svc ? "수정" : "추가"}</button></div>
  </>;
}

function ShopEditPage({ D, save, flash, back }) {
  const [f, setF] = useState({ name: D.shop.name, phone: D.shop.phone, address: D.shop.address });
  return <>
    <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 6 }}>
      <button className="btn-ghost" onClick={back}>← 설정</button><span style={{ fontWeight: 700, fontSize: 14 }}>매장 정보</span>
    </div>
    <div className="card"><div className="card-b" style={{ paddingTop: 14 }}>
      <div className="fg"><label>매장 이름</label><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></div>
      <div className="fg"><label>전화번호</label><input value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} /></div>
      <div className="fg"><label>주소</label><input value={f.address} onChange={e => setF({ ...f, address: e.target.value })} /></div>
      <button className="btn btn-p btn-full" onClick={() => { save({ ...D, shop: { ...D.shop, ...f } }); flash("✅", "저장 완료!"); back(); }}>저장</button>
    </div></div>
  </>;
}

/* ═══════════════════════════════════════
   CUSTOMER VIEW — 실제 데이터 연동
   ═══════════════════════════════════════ */
/* ── Edit Record Sheet ── */
function EditRecordSheet({record, services, onSave, close}) {
  const [style, setStyle] = useState(record.style||"");
  const [notes, setNotes] = useState(record.notes||"");
  const [price, setPrice] = useState(record.price||0);
  const [serviceId, setServiceId] = useState(record.serviceId||"");
  return <>
    <div className="sheet-hd"><h3>✏️ 미용 기록 수정</h3><button className="btn-ghost" onClick={close}>✕</button></div>
    <div className="sheet-bd">
      <div style={{fontSize:10,color:"var(--t2)",marginBottom:10,padding:"6px 10px",background:"var(--sh)",borderRadius:"var(--rx)"}}>
        📅 {fmtD(record.date)} 미용 기록
      </div>
      <div className="fg"><label>서비스</label>
        <select value={serviceId} onChange={e=>setServiceId(e.target.value)}>
          {services.filter(s=>s.active).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div className="fg"><label>스타일</label><input value={style} onChange={e=>setStyle(e.target.value)} placeholder="스포팅컷 5mm, 테디베어컷 등"/></div>
      <div className="fg"><label>메모 / 특이사항</label><textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="귀 안쪽 발적 발견, 다음에 확인 등"/></div>
      <div className="fg"><label>금액 (원)</label><input type="number" value={price} onChange={e=>setPrice(parseInt(e.target.value)||0)}/></div>
    </div>
    <div className="sheet-ft"><button className="btn btn-p btn-full" onClick={()=>onSave({style,notes,price,serviceId})}>수정 완료</button></div>
  </>;
}

/* ═══════════════════════════════════════
   CUSTOMER VIEW — 2차 기능 포함
   고객 취소/변경, 재예약, 미용이력
   ═══════════════════════════════════════ */
function CustomerView({ D, getSvc, getAvailableSlots, addAppt, flash, save, isSlotAvailable }) {
  const [step, setStep] = useState("main");
  const [svcId, setSvcId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [petName, setPetName] = useState("");
  const [memo, setMemo] = useState("");
  const [statusPhone, setStatusPhone] = useState("");
  const [statusResult, setStatusResult] = useState(null);
  const [statusRecords, setStatusRecords] = useState(null);
  const [statusGuardian, setStatusGuardian] = useState(null);
  const [statusPets, setStatusPets] = useState([]);
  // For change appointment
  const [changingAppt, setChangingAppt] = useState(null);
  const [changeDate, setChangeDate] = useState("");
  const [changeTime, setChangeTime] = useState("");
  // For rebook
  const [rebookRecord, setRebookRecord] = useState(null);

  const dates = []; for (let i = 0; i < 7; i++) dates.push(addD(TODAY, i));
  const svc = getSvc(svcId);
  const slots = useMemo(() => svcId && date ? getAvailableSlots(date, svcId) : [], [svcId, date, getAvailableSlots]);
  const changeSlots = useMemo(() => changingAppt && changeDate ? getAvailableSlots(changeDate, changingAppt.serviceId) : [], [changingAppt, changeDate, getAvailableSlots]);

  useEffect(() => { setTime(""); }, [date, svcId]);
  useEffect(() => { setChangeTime(""); }, [changeDate]);

  const submit = () => {
    const existingGuardian = D.guardians.find(g => g.phone === phone);
    let petId;
    if (existingGuardian) {
      const existingPet = D.pets.find(p => p.guardianId === existingGuardian.id && p.name === petName);
      petId = existingPet?.id || D.pets.find(p => p.guardianId === existingGuardian.id)?.id;
    }
    if (!petId) petId = D.pets[0]?.id;
    addAppt({ petId, serviceId: svcId, date, time, price: svc?.price || 0, memo, source: "customer" });
    flash("🎉", "예약 접수 완료!");
    setStep("done");
  };

  const lookupStatus = () => {
    const guard = D.guardians.find(g => g.phone.replace(/-/g, "").includes(statusPhone.replace(/-/g, "")));
    if (guard) {
      setStatusGuardian(guard);
      const pets = D.pets.filter(p => p.guardianId === guard.id);
      setStatusPets(pets);
      const appts = D.appointments.filter(a => pets.some(p => p.id === a.petId) && !["cancelled", "noshow"].includes(a.status))
        .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
      const recs = D.records.filter(r => pets.some(p => p.id === r.petId))
        .sort((a, b) => b.date.localeCompare(a.date));
      setStatusResult(appts.length > 0 ? appts.map(a => {
        const pet = D.pets.find(p => p.id === a.petId);
        const s = getSvc(a.serviceId);
        const st = ST_MAP[a.status];
        return { pet, svc: s, appt: a, st };
      }) : "empty");
      setStatusRecords(recs.length > 0 ? recs : null);
    } else {
      setStatusResult("empty");
      setStatusRecords(null);
      setStatusGuardian(null);
      setStatusPets([]);
    }
  };

  // Cancel appointment
  const cancelAppt = (apptId) => {
    const updated = D.appointments.map(a => a.id === apptId ? {...a, status: "cancelled"} : a);
    save({...D, appointments: updated});
    flash("❌", "예약이 취소되었습니다");
    lookupStatusRefresh(updated);
  };

  // Change appointment date/time
  const confirmChange = () => {
    if (!changingAppt || !changeDate || !changeTime) return;
    const updated = D.appointments.map(a => a.id === changingAppt.id ? {...a, date: changeDate, time: changeTime} : a);
    save({...D, appointments: updated});
    flash("📅", "예약이 변경되었습니다!");
    setChangingAppt(null);
    setChangeDate("");
    setChangeTime("");
    // refresh status
    lookupStatusRefresh(updated);
  };

  const lookupStatusRefresh = (appts) => {
    if (!statusGuardian) return;
    const pets = D.pets.filter(p => p.guardianId === statusGuardian.id);
    const filtered = (appts || D.appointments).filter(a => pets.some(p => p.id === a.petId) && !["cancelled", "noshow"].includes(a.status))
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
    setStatusResult(filtered.length > 0 ? filtered.map(a => {
      const pet = D.pets.find(p => p.id === a.petId);
      const s = getSvc(a.serviceId);
      const st = ST_MAP[a.status];
      return { pet, svc: s, appt: a, st };
    }) : "empty");
  };

  // Rebook with last record
  const startRebook = (rec) => {
    setRebookRecord(rec);
    setSvcId(rec.serviceId);
    setMemo(rec.style || "");
    const pet = D.pets.find(p => p.id === rec.petId);
    const guard = pet ? D.guardians.find(g => g.id === pet.guardianId) : null;
    if (guard) { setName(guard.name); setPhone(guard.phone); }
    if (pet) setPetName(pet.name);
    setDate("");
    setTime("");
    setStep("book");
  };

  const reset = () => { setStep("main"); setSvcId(""); setDate(""); setTime(""); setName(""); setPhone(""); setPetName(""); setMemo(""); setRebookRecord(null); };

  return <div className="cv">
    <div className="cv-top"><div style={{ fontSize: 24, marginBottom: 4 }}>✂️</div><h1>{D.shop.name}</h1><p>📞 {D.shop.phone} · {D.shop.address}</p></div>

    {step === "main" && <>
      <div className="cv-card" onClick={() => setStep("book")} style={{ cursor: "pointer" }}>
        <h3>📅 예약하기</h3>
        <p style={{ fontSize: 12, color: "var(--t2)" }}>서비스와 날짜를 선택하고 간편하게 예약하세요</p>
        <div style={{ textAlign: "right", marginTop: 8 }}><span className="btn btn-p">예약하기 →</span></div>
      </div>
      <div className="cv-card" onClick={() => setStep("status")} style={{ cursor: "pointer" }}>
        <h3>🔍 예약 확인 / 취소 / 변경</h3>
        <p style={{ fontSize: 12, color: "var(--t2)" }}>전화번호로 예약 조회, 취소, 날짜 변경이 가능해요</p>
      </div>
      <div className="cv-card"><h3>🎁 첫 방문 혜택</h3>
        <div style={{ background: "var(--al)", borderRadius: "var(--rx)", padding: 12, textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--a)" }}>3,000원 할인</div>
          <div style={{ fontSize: 10, color: "var(--t2)", marginTop: 3 }}>첫 미용 할인쿠폰</div>
        </div>
      </div>
    </>}

    {step === "book" && <>
      <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 6 }}>
        <button className="btn-ghost" onClick={reset}>← 뒤로</button><span style={{ fontWeight: 700, fontSize: 14 }}>예약하기</span>
        {rebookRecord && <span className="badge" style={{background:"var(--al)",color:"var(--ad)",marginLeft:"auto",fontSize:9}}>🔄 지난번과 같이</span>}
      </div>

      <div className="cv-card"><h3>1️⃣ 서비스</h3>
        <div className="cv-svc">{D.services.filter(s => s.active).map(s =>
          <div key={s.id} className={`cv-svc-item ${svcId === s.id ? "sel" : ""}`} onClick={() => setSvcId(s.id)}>
            {s.name}<br /><span style={{ fontSize: 9, color: "var(--t2)" }}>{fmtP(s.price)} · 약 {s.duration}분</span>
          </div>
        )}</div>
      </div>

      {svcId && <div className="cv-card"><h3>2️⃣ 날짜</h3>
        <div style={{ display: "flex", gap: 5, overflowX: "auto", paddingBottom: 3 }}>
          {dates.map(d => {
            const dd = new Date(d + "T00:00:00"); const dow = dd.getDay();
            const isOff = D.shop.holidays.includes(dow) || (D.shop.tempHolidays||[]).includes(d);
            const avail = !isOff ? getAvailableSlots(d, svcId).length : 0;
            return <div key={d} onClick={() => !isOff && avail > 0 && setDate(d)} style={{
              minWidth: 50, padding: "8px 6px", textAlign: "center", borderRadius: "var(--rx)",
              border: date === d ? "2px solid var(--a)" : "1.5px solid var(--b)",
              background: date === d ? "var(--al)" : "var(--s)",
              opacity: isOff || avail === 0 ? .3 : 1, cursor: isOff || avail === 0 ? "default" : "pointer", flexShrink: 0
            }}>
              <div style={{ fontSize: 9, color: isOff ? "#ef4444" : "var(--t2)", fontWeight: 600 }}>{WEEKDAYS[dow]}</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginTop: 1 }}>{dd.getDate()}</div>
              {isOff && <div style={{ fontSize: 8, color: "#ef4444", marginTop: 1 }}>휴무</div>}
              {!isOff && <div style={{ fontSize: 8, color: avail > 0 ? "var(--g)" : "#ef4444", marginTop: 1 }}>{avail > 0 ? `${avail}` : "마감"}</div>}
            </div>;
          })}
        </div>
      </div>}

      {date && <div className="cv-card"><h3>3️⃣ 시간 {slots.length > 0 && <span style={{ fontSize: 10, color: "var(--g)", fontWeight: 500 }}>({slots.length}개 가능)</span>}</h3>
        {slots.length === 0 ? <div style={{ fontSize: 12, color: "#ef4444" }}>가능한 시간이 없습니다</div> :
          <div className="cv-tg">{slots.map(s => <div key={s} className={`cv-ts ${time === s ? "sel" : ""}`} onClick={() => setTime(s)}>{s}</div>)}</div>}
      </div>}

      {svcId && date && time && <div className="cv-card"><h3>4️⃣ 정보</h3>
        <div className="fg"><label>보호자 이름 *</label><input value={name} onChange={e => setName(e.target.value)} placeholder="김민지" /></div>
        <div className="fg"><label>전화번호 *</label><input value={phone} onChange={e => setPhone(e.target.value)} placeholder="010-0000-0000" type="tel" /></div>
        <div className="fg"><label>반려견 이름 *</label><input value={petName} onChange={e => setPetName(e.target.value)} placeholder="몽이" /></div>
        <div className="fg"><label>요청사항</label><textarea value={memo} onChange={e => setMemo(e.target.value)} placeholder="원하는 스타일, 특이사항" /></div>
        <div style={{ background: "var(--sh)", borderRadius: "var(--rx)", padding: 10, marginBottom: 10, fontSize: 11 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>📋 예약 정보</div>
          <div style={{ color: "var(--t2)", lineHeight: 1.6 }}>
            서비스: <b style={{ color: "var(--t)" }}>{getSvc(svcId)?.name}</b> ({getSvc(svcId)?.duration}분)<br />
            날짜: <b style={{ color: "var(--t)" }}>{fmtD(date)} {time}</b><br />
            금액: <b style={{ color: "var(--t)" }}>{fmtP(getSvc(svcId)?.price || 0)}</b>
          </div>
        </div>
        <button className="btn btn-p btn-full" disabled={!name || !phone || !petName} style={{ opacity: name && phone && petName ? 1 : .5 }}
          onClick={() => name && phone && petName && submit()}>예약 접수하기</button>
        <div style={{ textAlign: "center", fontSize: 9, color: "var(--t3)", marginTop: 6 }}>
          {D.shop.approvalMode === "manual" ? "사장님 확인 후 확정 알림을 보내드립니다" : "예약이 즉시 확정됩니다"}
        </div>
      </div>}
    </>}

    {step === "done" && <div style={{ textAlign: "center", padding: "36px 18px" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
      <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>예약 접수 완료!</div>
      <div style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.6, marginBottom: 20 }}>
        {D.shop.approvalMode === "manual" ? "사장님 확인 후 카카오 알림톡으로\n확정 메시지를 보내드립니다." : "예약이 확정되었습니다!\n카카오 알림톡을 확인해주세요."}
      </div>
      <div style={{ background: "var(--sh)", borderRadius: "var(--rs)", padding: 14, marginBottom: 16, textAlign: "left" }}>
        <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>📋 접수 내역</div>
        <div style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.7 }}>
          서비스: <b style={{ color: "var(--t)" }}>{getSvc(svcId)?.name}</b><br />날짜: <b style={{ color: "var(--t)" }}>{fmtD(date)} {time}</b><br />반려견: <b style={{ color: "var(--t)" }}>{petName}</b><br />보호자: <b style={{ color: "var(--t)" }}>{name}</b>
        </div>
      </div>
      <div style={{ background: "var(--gl)", borderRadius: "var(--rx)", padding: 10, marginBottom: 16, fontSize: 11, color: "var(--g)" }}>
        💬 미용 진행 상태를 카카오 알림톡으로 안내해드려요<br />
        <span style={{ fontSize: 9, color: "var(--t2)" }}>예약확정 → 미용시작 → 거의완료 → 픽업가능</span>
      </div>
      <button className="btn btn-s btn-full" onClick={reset}>홈으로</button>
    </div>}

    {step === "status" && <>
      <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 6 }}>
        <button className="btn-ghost" onClick={() => { setStep("main"); setStatusResult(null); setStatusRecords(null); setChangingAppt(null); }}>← 뒤로</button><span style={{ fontWeight: 700, fontSize: 14 }}>예약 확인 / 취소 / 변경</span>
      </div>
      <div className="cv-card"><h3>📱 전화번호로 조회</h3>
        <div className="fg"><input value={statusPhone} onChange={e => setStatusPhone(e.target.value)} placeholder="010-0000-0000" type="tel" /></div>
        <button className="btn btn-p btn-full" onClick={lookupStatus}>조회하기</button>
      </div>

      {/* ── 예약 내역 + 취소/변경 ── */}
      {statusResult && statusResult !== "empty" && <div className="cv-card"><h3>📋 예약 내역 ({statusResult.length}건)</h3>
        {statusResult.map((r, i) => {
          const stages = ["pending", "confirmed", "in_progress", "almost_done", "completed"];
          const curIdx = stages.indexOf(r.appt.status);
          const canChange = ["pending","confirmed"].includes(r.appt.status);
          return <div key={i} style={{ padding: "10px 0", borderBottom: i < statusResult.length - 1 ? "1px solid var(--bl)" : "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 16 }}>{pe(r.appt.petId)}</span>
              <div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 600 }}>{r.pet?.name} - {r.svc?.name}</div><div style={{ fontSize: 10, color: "var(--t2)" }}>{fmtD(r.appt.date)} {r.appt.time} · {r.svc?.duration}분</div></div>
              <span className="badge" style={{ background: r.st.bg, color: r.st.c }}>{r.st.ic} {r.st.l}</span>
            </div>
            <div className="status-track">
              {["⏳", "✅", "✂️", "💇", "🎀"].map((ic, j) =>
                <React.Fragment key={j}>
                  {j > 0 && <div className="status-line" style={{ background: j <= curIdx ? "var(--a)" : "var(--b)" }} />}
                  <div className="status-dot" style={{ background: j <= curIdx ? "var(--al)" : "var(--sh)", fontSize: j <= curIdx ? 12 : 10, opacity: j <= curIdx ? 1 : .4 }}>{ic}</div>
                </React.Fragment>
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: "var(--t3)", padding: "0 4px", marginBottom: 8 }}>
              <span>접수</span><span>확정</span><span>미용중</span><span>거의완료</span><span>완료</span>
            </div>
            {/* 취소/변경 버튼 */}
            {canChange && <div style={{display:"flex",gap:6}}>
              <button className="btn btn-s" style={{flex:1,fontSize:11}} onClick={()=>{setChangingAppt(r.appt);setChangeDate("")}}>📅 날짜/시간 변경</button>
              <button className="btn btn-d" style={{fontSize:11}} onClick={()=>{if(confirm("정말 취소하시겠습니까?"))cancelAppt(r.appt.id)}}>예약 취소</button>
            </div>}
            {r.appt.status==="in_progress"&&<div style={{fontSize:10,color:"var(--a)",textAlign:"center",marginTop:4}}>✂️ 미용이 진행 중입니다. 완료 시 알림을 보내드려요!</div>}
          </div>;
        })}
      </div>}
      {statusResult === "empty" && <div className="cv-card"><div className="empty"><div className="ic">🔍</div><p>해당 번호로 예약을 찾을 수 없습니다</p></div></div>}

      {/* ── 예약 변경 폼 ── */}
      {changingAppt && <div className="cv-card" style={{border:"2px solid var(--a)"}}>
        <h3>📅 예약 변경</h3>
        <div style={{fontSize:11,color:"var(--t2)",marginBottom:10,padding:"6px 10px",background:"var(--sh)",borderRadius:"var(--rx)"}}>
          현재: {fmtD(changingAppt.date)} {changingAppt.time} → 변경할 날짜/시간을 선택하세요
        </div>
        <div style={{display:"flex",gap:5,overflowX:"auto",paddingBottom:3,marginBottom:10}}>
          {dates.map(d=>{
            const dd=new Date(d+"T00:00:00"); const dow=dd.getDay();
            const isOff=D.shop.holidays.includes(dow)||(D.shop.tempHolidays||[]).includes(d);
            const avail=!isOff?getAvailableSlots(d,changingAppt.serviceId).length:0;
            return <div key={d} onClick={()=>!isOff&&avail>0&&setChangeDate(d)} style={{
              minWidth:48,padding:"7px 5px",textAlign:"center",borderRadius:"var(--rx)",
              border:changeDate===d?"2px solid var(--a)":"1.5px solid var(--b)",
              background:changeDate===d?"var(--al)":"var(--s)",
              opacity:isOff||avail===0?.3:1,cursor:isOff||avail===0?"default":"pointer",flexShrink:0
            }}>
              <div style={{fontSize:8,color:isOff?"#ef4444":"var(--t2)",fontWeight:600}}>{WEEKDAYS[dow]}</div>
              <div style={{fontSize:14,fontWeight:700}}>{dd.getDate()}</div>
            </div>;
          })}
        </div>
        {changeDate&&<>
          <div className="cv-tg" style={{marginBottom:10}}>
            {changeSlots.map(s=><div key={s} className={`cv-ts ${changeTime===s?"sel":""}`} onClick={()=>setChangeTime(s)}>{s}</div>)}
          </div>
          {changeSlots.length===0&&<div style={{fontSize:11,color:"#ef4444",marginBottom:10}}>가능한 시간이 없습니다</div>}
        </>}
        <div style={{display:"flex",gap:6}}>
          <button className="btn btn-p" style={{flex:1}} disabled={!changeDate||!changeTime} style={{flex:1,opacity:changeDate&&changeTime?1:.5}} onClick={confirmChange}>변경 확정</button>
          <button className="btn btn-s" onClick={()=>setChangingAppt(null)}>취소</button>
        </div>
      </div>}

      {/* ── 미용 이력 조회 ── */}
      {statusRecords && statusRecords.length > 0 && <div className="cv-card">
        <h3>✂️ 미용 이력</h3>
        {statusRecords.map((rec,i) => {
          const svc = getSvc(rec.serviceId);
          const pet = D.pets.find(p=>p.id===rec.petId);
          return <div key={rec.id} style={{padding:"10px 0",borderBottom:i<statusRecords.length-1?"1px solid var(--bl)":"none"}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
              <span style={{fontSize:14}}>{pe(rec.petId)}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:600}}>{pet?.name} · {svc?.name}</div>
                <div style={{fontSize:10,color:"var(--t2)"}}>{fmtD(rec.date)}</div>
              </div>
              <div style={{fontSize:11,fontWeight:700}}>{fmtP(rec.price)}</div>
            </div>
            {rec.style&&<div style={{fontSize:10,color:"var(--t2)"}}>💇 스타일: <b style={{color:"var(--t)"}}>{rec.style}</b></div>}
            {rec.notes&&<div style={{fontSize:10,color:"var(--t2)"}}>📝 {rec.notes}</div>}
            {/* 지난번과 같이 재예약 */}
            <button className="btn btn-s" style={{marginTop:6,fontSize:10,width:"100%"}} onClick={()=>startRebook(rec)}>
              🔄 "{svc?.name} · {rec.style||"같은 스타일"}" 로 다시 예약
            </button>
          </div>;
        })}
      </div>}

      <div className="cv-card" style={{ background: "var(--gl)", border: "1px solid #b5d4bc" }}>
        <div style={{ textAlign: "center", padding: "4px 0" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--g)" }}>💬 자동 알림 안내</div>
          <div style={{ fontSize: 10, color: "var(--t2)", marginTop: 3, lineHeight: 1.5 }}>
            미용 진행 상황이 카카오 알림톡으로 자동 전송됩니다<br />
            "거의 완료" 알림 → "픽업 가능" 알림 순서로 안내해드려요
          </div>
        </div>
      </div>
    </>}
  </div>;
}
