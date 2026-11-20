"use client";

/** Kokonut UI Wheel Picker by @dorianbaffier (MIT), adapted for PetManager. */
import { animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform, type AnimationPlaybackControls, type MotionValue } from "motion/react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "../../lib/cn";

export interface WheelOption { value: string; label: string }
export interface WheelColumn { id: string; label: string; options: WheelOption[]; loop?: boolean; className?: string }
export interface WheelPickerProps {
  columns?: WheelColumn[]; value?: Record<string, string>; defaultValue?: Record<string, string>;
  onValueChange?: (value: Record<string, string>) => void; label?: string; className?: string;
}
export interface WheelPickerHandle { getValue: () => Record<string, string> }
const columnsDefault: WheelColumn[] = [
  { id: "hour", label: "시", loop: true, options: Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })) },
  { id: "minute", label: "분", loop: true, options: Array.from({ length: 60 }, (_, i) => ({ value: String(i), label: String(i).padStart(2, "0") })) },
  { id: "period", label: "오전·오후", options: [{ value: "am", label: "오전" }, { value: "pm", label: "오후" }] },
];
const defaults: Record<string, string> = { hour: "9", minute: "41", period: "am" };
const ITEM_HEIGHT = 26, ITEM_ANGLE = 20;
const RADIUS = Math.round((ITEM_HEIGHT / 2 / Math.tan(ITEM_ANGLE / 2 * Math.PI / 180)) * 100) / 100;
const WINDOW = Math.ceil(90 / ITEM_ANGLE);
const VIEW_HEIGHT = Math.round(RADIUS * 2) + ITEM_HEIGHT / 2;
const mod = (n: number, m: number) => ((n % m) + m) % m;
const damp = (distance: number) => 1.2 * (1 - Math.exp(-distance / 1.2));

const WheelPicker = forwardRef<WheelPickerHandle, WheelPickerProps>(function WheelPicker({ columns = columnsDefault, value: controlled, defaultValue = defaults, onValueChange, label = "시간", className }, ref) {
  const [internal, setInternal] = useState(defaultValue);
  const value = controlled ?? internal;
  const readers = useRef(new Map<string, () => string>());
  const register = useCallback((id: string, reader: (() => string) | null) => {
    if (reader) readers.current.set(id, reader);
    else readers.current.delete(id);
  }, []);
  useImperativeHandle(ref, () => ({ getValue: () => Object.fromEntries(columns.map((column) => [column.id, readers.current.get(column.id)?.() ?? value[column.id]])) }), [columns, value]);
  function select(id: string, option: string) {
    if (value[id] === option) return;
    const next = { ...value, [id]: option };
    if (controlled === undefined) setInternal(next);
    onValueChange?.(next);
  }
  return <div role="group" aria-label={label} className={cn("relative flex select-none justify-center rounded-[14px] border border-[#e8edf3] bg-white px-2", className)}>
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-2 top-1/2 -translate-y-1/2 rounded-[8px] bg-[#f1f3f7]" style={{ height: ITEM_HEIGHT }} />
    <span aria-hidden="true" className="pointer-events-none absolute left-0.5 top-1/2 h-px w-1 bg-[#a1a1aa]" />
    <span aria-hidden="true" className="pointer-events-none absolute right-0.5 top-1/2 h-px w-1 bg-[#a1a1aa]" />
    {columns.filter((column) => column.options.length > 0).map((column) => <WheelColumnView key={column.id} column={column} selected={value[column.id]} onSelect={(option) => select(column.id, option)} register={register} />)}
  </div>;
});
export default WheelPicker;

function WheelColumnView({ column, selected, onSelect, register }: { column: WheelColumn; selected?: string; onSelect: (value: string) => void; register: (id: string, reader: (() => string) | null) => void }) {
  const { options, loop = false } = column;
  const count = options.length;
  const selectedIndex = Math.max(options.findIndex((option) => option.value === selected), 0);
  const reduceMotion = useReducedMotion();
  const position = useMotionValue(selectedIndex);
  const [center, setCenter] = useState(selectedIndex);
  const animation = useRef<AnimationPlaybackControls | null>(null);
  const pointerType = useRef("mouse");
  const drag = useRef<{ id: number; startY: number; startPosition: number; moved: boolean; samples: { t: number; v: number }[] } | null>(null);
  const columnRef = useRef<HTMLDivElement>(null);
  const optionAt = (index: number) => options[mod(index, count)];
  const clampIndex = (index: number) => loop ? index : Math.min(Math.max(index, 0), count - 1);
  const drum = useTransform(position, (p) => `translateZ(${-RADIUS}px) rotateX(${p * ITEM_ANGLE}deg)`);
  const latest = useRef({ options, onSelect });
  useLayoutEffect(() => { latest.current = { options, onSelect }; });

  useEffect(() => {
    register(column.id, () => {
      const index = Math.round(position.get());
      const list = latest.current.options;
      return list[loop ? mod(index, list.length) : Math.max(0, Math.min(index, list.length - 1))].value;
    });
    return () => register(column.id, null);
  }, [column.id, register, position, loop]);

  useMotionValueEvent(position, "change", (p) => {
    const rounded = Math.round(p);
    if (rounded !== center) {
      setCenter(rounded);
      if (pointerType.current === "touch" && typeof navigator.vibrate === "function") navigator.vibrate(1);
    }
  });
  const optionKey = options.map((option) => option.value).join("|");
  useEffect(() => {
    // Changed option sets (e.g. available appointment hours) invalidate the old drum indexes.
    animation.current?.stop(); animation.current = null; drag.current = null;
    const current = mod(Math.round(position.get()), count);
    let delta = selectedIndex - current;
    if (loop && Math.abs(delta) > count / 2) delta -= Math.sign(delta) * count;
    position.jump(Math.round(position.get()) + delta);
  }, [selectedIndex, optionKey, count, loop, position]);
  useEffect(() => () => animation.current?.stop(), []);

  function settle() {
    animation.current = null;
    latest.current.onSelect(optionAt(clampIndex(Math.round(position.get()))).value);
  }
  function goTo(target: number) {
    animation.current?.stop(); animation.current = null;
    if (reduceMotion || Math.abs(position.get() - target) < 0.001) { position.jump(target); settle(); return; }
    animation.current = animate(position, target, { type: "spring", duration: 0.4, bounce: 0.15, restDelta: 0.001, onComplete: settle });
  }
  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (drag.current || (event.pointerType === "mouse" && event.button !== 0)) return;
    animation.current?.stop(); animation.current = null;
    pointerType.current = event.pointerType;
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, startY: event.clientY, startPosition: position.get(), moved: false, samples: [{ t: event.timeStamp, v: position.get() }] };
  }
  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    const dy = event.clientY - current.startY;
    if (!current.moved && Math.abs(dy) < 4) return;
    current.moved = true;
    const raw = current.startPosition - dy / ITEM_HEIGHT;
    position.set(loop ? raw : raw < 0 ? -damp(-raw) : raw > count - 1 ? count - 1 + damp(raw - count + 1) : raw);
    current.samples.push({ t: event.timeStamp, v: raw });
    while (current.samples.length > 2 && event.timeStamp - current.samples[0].t > 80) current.samples.shift();
  }
  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    drag.current = null;
    if (event.type === "pointercancel" || event.type === "lostpointercapture") { goTo(clampIndex(Math.round(position.get()))); return; }
    if (!current.moved) {
      const rect = event.currentTarget.getBoundingClientRect();
      const ratio = Math.max(-1, Math.min(1, (event.clientY - rect.top - rect.height / 2) / RADIUS));
      goTo(clampIndex(Math.round(position.get()) + Math.round(Math.asin(ratio) * 180 / Math.PI / ITEM_ANGLE))); return;
    }
    const first = current.samples[0], last = current.samples.at(-1) ?? first;
    const elapsed = (last.t - first.t) / 1000;
    const velocity = elapsed > 0 && event.timeStamp - last.t <= 80 ? (last.v - first.v) / elapsed : 0;
    const p = position.get();
    if (reduceMotion || (!loop && (p < 0 || p > count - 1)) || Math.abs(velocity) < 2) { goTo(clampIndex(Math.round(p))); return; }
    animation.current = animate(position, clampIndex(Math.round(p + velocity * 0.32)), { type: "spring", velocity, stiffness: 140, damping: 24, restDelta: 0.005, onComplete: settle });
  }
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = Math.round(position.get());
    const moves: Record<string, number> = { ArrowUp: 1, ArrowDown: -1, PageUp: 5, PageDown: -5 };
    const target = event.key === "Home" ? index - mod(index, count) : event.key === "End" ? index - mod(index, count) + count - 1 : event.key in moves ? clampIndex(index + moves[event.key]) : null;
    if (target === null) return;
    event.preventDefault(); event.stopPropagation();
    animation.current?.stop(); animation.current = null; pointerType.current = "keyboard";
    position.jump(target); settle();
  }
  const wheel = useRef({ loop, count, goTo, clampIndex });
  useLayoutEffect(() => { wheel.current = { loop, count, goTo, clampIndex }; });
  useEffect(() => {
    const node = columnRef.current;
    if (!node) return;
    let timer: number | undefined;
    function onWheel(event: WheelEvent) {
      event.preventDefault(); event.stopPropagation();
      const current = wheel.current;
      animation.current?.stop(); animation.current = null; pointerType.current = "mouse";
      const pixels = event.deltaY * (event.deltaMode === 1 ? ITEM_HEIGHT : event.deltaMode === 2 ? VIEW_HEIGHT : 1);
      const raw = position.get() + pixels / ITEM_HEIGHT * 0.4;
      position.set(current.loop ? raw : Math.min(Math.max(raw, -0.4), current.count - 1 + 0.4));
      window.clearTimeout(timer);
      timer = window.setTimeout(() => { const current = wheel.current; current.goTo(current.clampIndex(Math.round(position.get()))); }, 120);
    }
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => { node.removeEventListener("wheel", onWheel); window.clearTimeout(timer); };
  }, [position]);
  const rows = Array.from({ length: WINDOW * 2 + 1 }, (_, i) => center - WINDOW + i).filter((i) => loop || (i >= 0 && i < count));
  return <div ref={columnRef} role="spinbutton" tabIndex={0} aria-label={column.label} aria-valuemin={0} aria-valuemax={count - 1} aria-valuenow={selectedIndex} aria-valuetext={options[selectedIndex]?.label}
    className={cn("relative min-w-0 flex-1 cursor-grab touch-none rounded-[8px] outline-none active:cursor-grabbing focus-visible:after:absolute focus-visible:after:inset-x-2 focus-visible:after:top-[calc(50%+13px)] focus-visible:after:border-b-2 focus-visible:after:border-[#64748b] focus-visible:after:content-['']", column.className)}
    style={{ height: VIEW_HEIGHT }} onKeyDown={handleKeyDown} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} onLostPointerCapture={handlePointerUp}>
    <div className="absolute inset-0" style={{ maskImage: "linear-gradient(to bottom, transparent, #000 34%, #000 66%, transparent)" }}>
      <Drum drum={drum} rows={rows} optionAt={optionAt} rowClassName="text-[#94a3b8]" />
      <Drum clip drum={drum} rows={rows} optionAt={optionAt} rowClassName="font-medium text-[#15213b]" />
    </div>
  </div>;
}

function Drum({ drum, rows, optionAt, rowClassName, clip = false }: { drum: MotionValue<string>; rows: number[]; optionAt: (index: number) => WheelOption; rowClassName: string; clip?: boolean }) {
  return <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ perspective: 1000, clipPath: clip ? `inset(calc(50% - ${ITEM_HEIGHT / 2}px) 0 calc(50% - ${ITEM_HEIGHT / 2}px) 0)` : undefined }}>
    <motion.div className="absolute inset-x-0 top-1/2" style={{ transform: drum, transformStyle: "preserve-3d" }}>
      {rows.map((index) => <div key={index} className={cn("absolute inset-x-0 flex items-center justify-center text-[18px] leading-6 tabular-nums [backface-visibility:hidden]", rowClassName)} style={{ top: -ITEM_HEIGHT / 2, height: ITEM_HEIGHT, transform: `rotateX(${-index * ITEM_ANGLE}deg) translateZ(${RADIUS}px)` }}>{optionAt(index).label}</div>)}
    </motion.div>
  </div>;
}
