"use client";

import { useState } from "react";

const STATES = ["필수 누락", "정책 대기", "Preview 잠금", "성공 fixture", "실패 fixture"] as const;
const ROLES = ["오너", "매니저", "스태프"];
const OPERATIONS = ["1인 운영", "2인 이상 운영"];
const CHANNELS = ["전화", "문자", "Instagram DM", "기타 온라인"];
const PAINS = ["미용 중 답변 지연", "예약 재입력", "영업 후 문의 정리"];

export const APPLICATION_FLOW_LOCKS = Object.freeze({ previewOnly: true, formPublishable: false, formSubmissionEnabled: false, analyticsEnabled: false, externalCallsEnabled: false });

export default function ApplicationFlowDemo() {
  const [step, setStep] = useState<"step1" | "step2" | "states" | "events">("step1");
  const [state, setState] = useState<(typeof STATES)[number]>("Preview 잠금");
  const [started, setStarted] = useState(false);
  const [shop, setShop] = useState("");
  const [role, setRole] = useState("");
  const [operation, setOperation] = useState("");
  const [channels, setChannels] = useState<string[]>([]);
  const [pains, setPains] = useState<string[]>([]);
  const [consents, setConsents] = useState([false, false, false]);
  const start = () => setStarted(true);
  const toggle = (list: string[], value: string, set: (next: string[]) => void) => { start(); set(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]); };
  const tabs = [["step1", "신청 1단계"], ["step2", "신청 2단계"], ["states", "상태"], ["events", "이벤트 경계"]] as const;

  return <main className="h-[100dvh] overflow-hidden bg-white px-4 py-3 text-[#171717] md:px-7 md:py-4"><div className="mx-auto flex h-full max-w-[1280px] flex-col">
    <header className="flex items-center justify-between border-b border-[#d4d4d4] pb-3"><div><p className="text-sm text-[#525252]">내부 Preview · 제출/저장/수집/발송 없음</p><h1 className="text-[clamp(24px,3vw,30px)] font-bold">신청 흐름 검수</h1></div><span className="rounded-full border border-[#d4d4d4] px-3 py-1 text-sm">외부 실행 0</span></header>
    <nav className="mt-3 grid min-h-11 grid-cols-4 overflow-hidden rounded-md border border-[#d4d4d4]">{tabs.map(([id, label]) => <button key={id} type="button" onClick={() => setStep(id)} className={`border-r border-[#d4d4d4] px-2 text-sm font-medium last:border-0 md:text-base ${step === id ? "bg-[#171717] text-white" : "bg-white"}`}>{label}</button>)}</nav>
    <section className="mt-3 grid min-h-0 flex-1 gap-3 md:grid-cols-[1fr_320px]">
      <div className="min-h-0 overflow-auto rounded-md border border-[#d4d4d4] p-4">
        {step === "step1" ? <StepOne {...{ shop, setShop: (v: string) => { start(); setShop(v); }, role, setRole: (v: string) => { start(); setRole(v); }, operation, setOperation: (v: string) => { start(); setOperation(v); }, channels, setChannels: (v: string) => toggle(channels, v, setChannels), pains, setPains: (v: string) => toggle(pains, v, setPains) }} /> : null}
        {step === "step2" ? <StepTwo consents={consents} onToggle={(index) => { start(); setConsents((current) => current.map((value, i) => i === index ? !value : value)); }} /> : null}
        {step === "states" ? <States value={state} onChange={setState} /> : null}
        {step === "events" ? <Events started={started} /> : null}
      </div>
      <aside className="rounded-md border border-[#d4d4d4] p-4"><h2 className="text-lg font-medium">현재 검수 상태</h2><dl className="mt-3 divide-y divide-[#e5e5e5] text-base"><Row k="단계" v={tabs.find(([id]) => id === step)?.[1] ?? ""} /><Row k="입력 시작" v={started ? "메모리 상태만 변경" : "아직 없음"} /><Row k="저장" v="0건" /><Row k="analytics" v="0건" /><Row k="외부 호출" v="0건" /></dl><p className="mt-4 border-t border-[#d4d4d4] pt-3 text-sm leading-6 text-[#525252]">정책 확정 전 공개·제출 불가 · 선택하지 않아도 기본 14일 체험 조건은 동일합니다.</p></aside>
    </section>
  </div></main>;
}

function StepOne(p: { shop: string; setShop: (v: string) => void; role: string; setRole: (v: string) => void; operation: string; setOperation: (v: string) => void; channels: string[]; setChannels: (v: string) => void; pains: string[]; setPains: (v: string) => void }) { return <div><h2 className="text-xl font-medium">신청 1단계</h2><p className="mt-1 text-sm text-[#525252]">운영 판단에 필요한 다섯 항목만 확인합니다.</p><div className="mt-4 grid gap-4 md:grid-cols-2"><Field label="매장명"><input value={p.shop} onChange={(e) => p.setShop(e.target.value)} placeholder="테스트 매장" className="min-h-11 w-full rounded-md border border-[#a3a3a3] px-3" /></Field><Field label="신청자 역할"><Choices values={ROLES} selected={[p.role]} onToggle={p.setRole} /></Field><Field label="운영 형태"><Choices values={OPERATIONS} selected={[p.operation]} onToggle={p.setOperation} /></Field><Field label="예약 접수 방식"><Choices values={CHANNELS} selected={p.channels} onToggle={p.setChannels} /></Field><Field label="불편한 장면"><Choices values={PAINS} selected={p.pains} onToggle={p.setPains} /></Field></div></div>; }
function StepTwo({ consents, onToggle }: { consents: boolean[]; onToggle: (i: number) => void }) { const items = ["[선택] Instagram 계정정보의 광고 목적 이용", "[선택] Instagram DM 광고성 정보 1회 수신", "[선택] 사례 활용 + 무료 이용 30일 추가"]; return <div><h2 className="text-xl font-medium">신청 2단계</h2><p className="mt-1 text-sm text-[#525252]">세 선택 동의는 서로 독립이며 모두 기본 미선택입니다.</p><div className="mt-4 space-y-3">{items.map((item, i) => <button key={item} type="button" aria-pressed={consents[i]} onClick={() => onToggle(i)} className={`flex min-h-14 w-full items-center gap-3 rounded-md border p-3 text-left ${consents[i] ? "border-black" : "border-[#d4d4d4]"}`}><span className={`h-5 w-5 rounded-sm border ${consents[i] ? "bg-black" : "bg-white"}`} /><span>{item}</span></button>)}</div><p className="mt-4 text-sm">선택하지 않아도 기본 14일 체험 조건은 동일합니다.</p></div>; }
function States({ value, onChange }: { value: string; onChange: (v: (typeof STATES)[number]) => void }) { return <div><h2 className="text-xl font-medium">데모 상태</h2><div className="mt-4 grid gap-2 sm:grid-cols-2">{STATES.map((item) => <button key={item} type="button" onClick={() => onChange(item)} className={`min-h-11 rounded-md border px-3 text-left ${value === item ? "border-black bg-black text-white" : "border-[#d4d4d4]"}`}>{item}</button>)}</div><p className="mt-5 rounded-md border border-[#d4d4d4] p-4">현재 fixture: {value} · 실제 요청이나 저장은 발생하지 않습니다.</p></div>; }
function Events({ started }: { started: boolean }) { return <div><h2 className="text-xl font-medium">화면 이벤트 경계</h2><ol className="mt-4 divide-y divide-[#e5e5e5] border-y border-[#e5e5e5]">{[["CTA 클릭", "form_view"], ["최초 실제 입력", "form_start"], ["제출 시도", "form_submit_attempt"], ["fixture 결과", "form_submit_result"]].map(([a,b], i) => <li key={b} className="grid grid-cols-2 py-3"><span>{a}</span><code>{b}</code><span className="col-span-2 text-sm text-[#737373]">{i === 1 && started ? "화면 내 메모리 상태만 변경됨" : "외부 전송 0"}</span></li>)}</ol></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <fieldset><legend className="mb-2 font-medium">{label}</legend>{children}</fieldset>; }
function Choices({ values, selected, onToggle }: { values: string[]; selected: string[]; onToggle: (v: string) => void }) { return <div className="flex flex-wrap gap-2">{values.map((v) => <button key={v} type="button" aria-pressed={selected.includes(v)} onClick={() => onToggle(v)} className={`min-h-11 rounded-md border px-3 ${selected.includes(v) ? "border-black bg-black text-white" : "border-[#d4d4d4]"}`}>{v}</button>)}</div>; }
function Row({ k, v }: { k: string; v: string }) { return <div className="grid grid-cols-[90px_1fr] py-3"><dt className="text-[#737373]">{k}</dt><dd>{v}</dd></div>; }
