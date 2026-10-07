"use client";
import { useRef, type PointerEvent } from "react";
import type { SignaturePoint } from "../contracts/booking-preparation";
export function SignaturePreview({ value }: { value: SignaturePoint[][] }) {
  return <svg viewBox="0 0 600 220" className="h-[180px] w-full" role="img" aria-label="보호자 서명">{value.map((stroke, i) => <polyline key={i} points={stroke.map(p => `${p.x * 600},${p.y * 220}`).join(" ")} fill="none" stroke="#15213b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />)}</svg>;
}
export default function BookingSignaturePad({ value, onChange, disabled = false }: { value: SignaturePoint[][]; onChange: (value: SignaturePoint[][]) => void; disabled?: boolean }) {
  const current = useRef(value), drawing = useRef<number | null>(null);
  current.current = value;
  const point = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) };
  };
  const update = (next: SignaturePoint[][]) => { current.current = next; onChange(next); };
  return <div className="space-y-2">
    <p className="text-[16px] text-slate-600">아래 창에 손가락이나 마우스로 직접 서명해 주세요.</p>
    <svg viewBox="0 0 600 220" role="img" aria-label="직접 서명하는 창" className="h-[180px] w-full touch-none rounded-[10px] border border-slate-300 bg-white"
      onPointerDown={e => { if (disabled || drawing.current !== null || value.length >= 40) return; e.currentTarget.setPointerCapture(e.pointerId); drawing.current = e.pointerId; update([...current.current, [point(e)]]); }}
      onPointerMove={e => { if (drawing.current !== e.pointerId) return; const next = current.current.map(s => [...s]); const last = next[next.length - 1]; if (last.length < 1500) { last.push(point(e)); update(next); } }}
      onPointerUp={e => { if (drawing.current === e.pointerId) { drawing.current = null; e.currentTarget.releasePointerCapture(e.pointerId); } }}
      onPointerCancel={() => { drawing.current = null; update(current.current.slice(0, -1)); }}>
      {value.map((s, i) => <polyline key={i} points={s.map(p => `${p.x * 600},${p.y * 220}`).join(" ")} fill="none" stroke="#15213b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />)}
    </svg>
    <div className="flex gap-2"><button type="button" disabled={disabled} onClick={() => update(value.slice(0, -1))} className="h-10 rounded-[8px] border px-3 text-[16px]">한 획 지우기</button><button type="button" disabled={disabled} onClick={() => update([])} className="h-10 rounded-[8px] border px-3 text-[16px]">다시 쓰기</button></div>
  </div>;
}
