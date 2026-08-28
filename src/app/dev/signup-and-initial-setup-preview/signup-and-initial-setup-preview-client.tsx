"use client";

import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  FileImage,
  ImagePlus,
  PencilLine,
  Plus,
  ScanText,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type Stage = "price" | "account" | "review" | "complete";
type RecognitionState = "idle" | "fixture" | "failed" | "manual";

type PriceRow = {
  id: string;
  service: string;
  price: string;
  duration: string;
  target: string;
};

type AccountDraft = {
  ownerName: string;
  email: string;
  password: string;
  shopName: string;
  shopPhone: string;
  shopAddress: string;
  requiredConsent: boolean;
};

const demoRows: PriceRow[] = [
  { id: "whole", service: "전체미용", price: "80000", duration: "120", target: "말티즈 · 4kg 이하" },
  { id: "bath", service: "목욕 + 부분정리", price: "55000", duration: "90", target: "푸들 · 6kg 이하" },
  { id: "partial", service: "부분미용", price: "30000", duration: "45", target: "전 품종 · 상담" },
];

const initialAccount: AccountDraft = {
  ownerName: "",
  email: "",
  password: "",
  shopName: "",
  shopPhone: "",
  shopAddress: "",
  requiredConsent: false,
};

const stageIndex: Record<Stage, number> = { price: 0, account: 1, review: 2, complete: 2 };
const stageLabels = ["서비스 요금", "계정 정보", "최종 확인"];

function StepIndicator({ stage }: { stage: Stage }) {
  const active = stageIndex[stage];
  return (
    <ol className="grid grid-cols-3 gap-2" aria-label="회원가입 진행 단계">
      {stageLabels.map((label, index) => (
        <li
          key={label}
          className={cn(
            "flex h-11 items-center justify-center gap-2 rounded-xl border px-2 text-[13px] font-bold transition",
            index < active && "border-[#bad9cb] bg-[#eef8f3] text-[#177856]",
            index === active && "border-[#2f6fde] bg-[#eaf2ff] text-[#1d4ed8]",
            index > active && "border-[#dce4ee] bg-white text-[#8a97a8]",
          )}
        >
          <span className="hidden sm:inline">{index < active ? <Check className="h-4 w-4" /> : `0${index + 1}`}</span>
          {label}
        </li>
      ))}
    </ol>
  );
}

function PriceRowsEditor({ rows, setRows }: { rows: PriceRow[]; setRows: (rows: PriceRow[]) => void }) {
  const update = (id: string, field: keyof Omit<PriceRow, "id">, value: string) => {
    setRows(rows.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  return (
    <div className="space-y-3">
      {rows.map((row, index) => (
        <div key={row.id} className="rounded-2xl border border-[#dce5ef] bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[13px] font-bold text-[#2b3b55]">서비스 {index + 1}</p>
            {rows.length > 1 ? (
              <button type="button" onClick={() => setRows(rows.filter((item) => item.id !== row.id))} className="rounded-lg p-1 text-[#8b98a9] hover:bg-[#f1f4f8]" aria-label={`${row.service || index + 1} 삭제`}><X className="h-4 w-4" /></button>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-[12px] font-semibold text-[#607080]">서비스명<input value={row.service} onChange={(event) => update(row.id, "service", event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#d7e0eb] px-3 text-[14px] text-[#172033] outline-none focus:border-[#2f6fde]" placeholder="예: 전체미용" /></label>
            <label className="text-[12px] font-semibold text-[#607080]">기본 가격<input value={row.price} inputMode="numeric" onChange={(event) => update(row.id, "price", event.target.value.replace(/\D/g, ""))} className="mt-1.5 h-11 w-full rounded-xl border border-[#d7e0eb] px-3 text-[14px] text-[#172033] outline-none focus:border-[#2f6fde]" placeholder="예: 80000" /></label>
            <label className="text-[12px] font-semibold text-[#607080]">예상 시간<input value={row.duration} inputMode="numeric" onChange={(event) => update(row.id, "duration", event.target.value.replace(/\D/g, ""))} className="mt-1.5 h-11 w-full rounded-xl border border-[#d7e0eb] px-3 text-[14px] text-[#172033] outline-none focus:border-[#2f6fde]" placeholder="분 단위" /></label>
            <label className="text-[12px] font-semibold text-[#607080]">품종·체중 기준<input value={row.target} onChange={(event) => update(row.id, "target", event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#d7e0eb] px-3 text-[14px] text-[#172033] outline-none focus:border-[#2f6fde]" placeholder="예: 말티즈 · 4kg 이하" /></label>
          </div>
        </div>
      ))}
      <button type="button" onClick={() => setRows([...rows, { id: crypto.randomUUID(), service: "", price: "", duration: "", target: "" }])} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#afbed1] bg-white text-[13px] font-bold text-[#526174]"><Plus className="h-4 w-4" />서비스 추가</button>
    </div>
  );
}

function PriceStep({
  visionReady,
  rows,
  setRows,
  file,
  setFile,
  recognition,
  setRecognition,
  onNext,
}: {
  visionReady: boolean;
  rows: PriceRow[];
  setRows: (rows: PriceRow[]) => void;
  file: File | null;
  setFile: (file: File | null) => void;
  recognition: RecognitionState;
  setRecognition: (state: RecognitionState) => void;
  onNext: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const handleFile = (selected: File | null) => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = selected ? URL.createObjectURL(selected) : null;
    setPreviewUrl(objectUrlRef.current);
    setFile(selected);
    if (!selected) {
      setRecognition("idle");
      return;
    }
    if (!visionReady) {
      setRecognition("failed");
      setRows([{ id: crypto.randomUUID(), service: "", price: "", duration: "", target: "" }]);
      return;
    }
    setRecognition("fixture");
    setRows(demoRows);
  };

  const rowsValid = rows.length > 0 && rows.every((row) => row.service.trim() && row.price.trim() && row.duration.trim());

  return (
    <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
      <section className="rounded-3xl border border-[#d9e3ef] bg-[#f7faff] p-5 sm:p-6">
        <p className="text-[12px] font-bold tracking-[0.08em] text-[#2f6fde]">FIRST · PRICE GUIDE</p>
        <h2 className="mt-2 text-[25px] font-extrabold tracking-[-0.04em] text-[#14213a]">사용 중인 요금표를<br />먼저 등록해 주세요</h2>
        <p className="mt-2 text-[14px] leading-6 text-[#66748b]">사진을 올리거나 바로 입력할 수 있어요. 가입 완료 전에는 서버에 영구 저장하지 않습니다.</p>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(event) => handleFile(event.target.files?.[0] ?? null)} />
        <button type="button" onClick={() => inputRef.current?.click()} className="mt-5 flex aspect-[4/3] w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-[#9ebcf1] bg-white text-[#2f6fde]">
          {previewUrl ? <img src={previewUrl} alt="선택한 요금표 미리보기" className="h-full w-full object-cover" /> : <><ImagePlus className="h-8 w-8" /><span className="mt-2 text-[14px] font-bold">요금표 사진 선택</span><span className="mt-1 text-[12px] text-[#7b8da8]">JPG · PNG</span></>}
        </button>
        <button type="button" onClick={() => { setRecognition("manual"); setRows([{ id: crypto.randomUUID(), service: "", price: "", duration: "", target: "" }]); }} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#cad5e4] bg-white text-[13px] font-bold text-[#475569]"><PencilLine className="h-4 w-4" />사진 없이 직접 입력</button>
        <div className="mt-4 rounded-xl bg-white px-3.5 py-3 text-[12px] leading-5 text-[#6b7a90]"><ShieldCheck className="mr-1 inline h-4 w-4 text-[#1f9d55]" />사진과 입력값은 현재 브라우저 메모리에만 있습니다.</div>
      </section>

      <section className="rounded-3xl border border-[#d9e3ef] bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2"><ScanText className="h-5 w-5 text-[#2f6fde]" /><h3 className="text-[18px] font-extrabold text-[#172033]">{recognition === "manual" || recognition === "failed" ? "서비스 요금 직접 입력" : "사진 판독 결과 확인"}</h3></div>
          <span className={cn("rounded-full px-3 py-1.5 text-[11px] font-bold", recognition === "fixture" ? "bg-[#e8f7ef] text-[#177856]" : recognition === "failed" ? "bg-[#fff0ed] text-[#b84b3a]" : "bg-[#eef2f7] text-[#607080]")}>{recognition === "fixture" ? "샘플 판독 결과" : recognition === "failed" ? "판독 연결 안 됨" : recognition === "manual" ? "직접 입력" : "사진 대기"}</span>
        </div>

        {recognition === "idle" ? (
          <div className="mt-5 flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-[#e1e8f0] bg-[#fafbfd] text-center"><FileImage className="h-9 w-9 text-[#9aa8b8]" /><p className="mt-3 text-[14px] font-bold text-[#526174]">사진을 올리면 확인할 항목이 나옵니다</p><p className="mt-1 text-[12px] text-[#94a3b8]">서비스명 · 가격 · 예상 시간 · 품종 · 체중 구간</p><button type="button" onClick={() => { setRecognition("fixture"); setRows(demoRows); }} className="mt-5 rounded-xl border border-[#c7d6ec] bg-white px-4 py-2 text-[12px] font-bold text-[#2f6fde]">샘플 판독 결과 보기 · fixture</button></div>
        ) : (
          <>
            {recognition === "failed" ? <div className="mt-4 rounded-xl border border-[#f3c9c2] bg-[#fff5f2] px-4 py-3 text-[13px] leading-5 text-[#9f3f31]"><strong>사진 인식 기능이 연결되지 않았습니다.</strong><br />성공으로 표시하지 않고 직접 입력으로 전환했습니다.</div> : null}
            {recognition === "fixture" ? <p className="mt-4 rounded-xl bg-[#f3f7fd] px-4 py-3 text-[12px] leading-5 text-[#65758c]">실제 Vision 키가 없는 개발 환경을 위한 <strong>fixture</strong>입니다. 운영 판독 성공으로 간주하지 않습니다.</p> : null}
            <div className="mt-4"><PriceRowsEditor rows={rows} setRows={setRows} /></div>
          </>
        )}
        <button type="button" disabled={!rowsValid} onClick={onNext} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#14213a] text-[14px] font-bold text-white disabled:cursor-not-allowed disabled:bg-[#c4ccd8]">요금 확인 완료 <ArrowRight className="h-4 w-4" /></button>
      </section>
    </div>
  );
}

function AccountStep({ account, setAccount, onBack, onNext }: { account: AccountDraft; setAccount: (draft: AccountDraft) => void; onBack: () => void; onNext: () => void }) {
  const fields: Array<{ key: keyof Omit<AccountDraft, "requiredConsent">; label: string; type?: string; placeholder: string }> = [
    { key: "ownerName", label: "대표자 이름", placeholder: "예: 김도윤" },
    { key: "email", label: "이메일", type: "email", placeholder: "owner@example.com" },
    { key: "password", label: "비밀번호", type: "password", placeholder: "8자 이상 입력" },
    { key: "shopName", label: "매장명", placeholder: "예: 멍샵몽샵" },
    { key: "shopPhone", label: "매장 연락처", placeholder: "02-000-0000" },
    { key: "shopAddress", label: "매장 주소", placeholder: "도로명 주소" },
  ];
  const valid = fields.every(({ key }) => account[key].trim()) && account.requiredConsent;
  return (
    <section className="mx-auto max-w-[820px] rounded-3xl border border-[#d9e3ef] bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] sm:p-8">
      <p className="text-[12px] font-bold tracking-[0.08em] text-[#2f6fde]">SECOND · ACCOUNT</p><h2 className="mt-2 text-[26px] font-extrabold tracking-[-0.04em] text-[#14213a]">가입에 필요한 정보만 입력해 주세요</h2><p className="mt-2 text-[14px] text-[#66748b]">앞에서 확인한 요금은 브라우저에만 남아 있고, 아직 서버에 저장되지 않았습니다.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">{fields.map(({ key, label, type, placeholder }) => <label key={key} className="text-[13px] font-bold text-[#526174]">{label}<input type={type ?? "text"} value={account[key]} onChange={(event) => setAccount({ ...account, [key]: event.target.value })} placeholder={placeholder} className="mt-2 h-12 w-full rounded-xl border border-[#d7e0eb] px-4 text-[15px] text-[#172033] outline-none focus:border-[#2f6fde]" /></label>)}</div>
      <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-[#dce5ef] bg-[#f8fafc] p-4 text-[13px] leading-5 text-[#526174]"><input type="checkbox" checked={account.requiredConsent} onChange={(event) => setAccount({ ...account, requiredConsent: event.target.checked })} className="mt-0.5 h-4 w-4 accent-[#2f6fde]" /><span><strong className="text-[#172033]">필수 약관과 개인정보 처리에 동의합니다.</strong><br />마케팅 수신은 회원가입 필수 항목에 포함하지 않습니다.</span></label>
      <div className="mt-6 grid grid-cols-[0.45fr_1fr] gap-3"><button type="button" onClick={onBack} className="flex h-12 items-center justify-center gap-1 rounded-xl border border-[#ced8e5] font-bold text-[#526174]"><ArrowLeft className="h-4 w-4" />이전</button><button type="button" disabled={!valid} onClick={onNext} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#14213a] text-[14px] font-bold text-white disabled:bg-[#c4ccd8]">최종 확인 <ArrowRight className="h-4 w-4" /></button></div>
    </section>
  );
}

function ReviewStep({ rows, account, file, saving, error, onBack, onSubmit }: { rows: PriceRow[]; account: AccountDraft; file: File | null; saving: boolean; error: string | null; onBack: () => void; onSubmit: () => void }) {
  return <section className="mx-auto max-w-[900px] rounded-3xl border border-[#d9e3ef] bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] sm:p-8"><p className="text-[12px] font-bold tracking-[0.08em] text-[#2f6fde]">FINAL REVIEW</p><h2 className="mt-2 text-[26px] font-extrabold tracking-[-0.04em] text-[#14213a]">마지막으로 한 번만 확인해 주세요</h2><p className="mt-2 text-[14px] text-[#66748b]">이 버튼을 누를 때 서비스 요금과 계정 정보를 한 요청으로 검증합니다. 이 데모는 DB에 저장하지 않습니다.</p><div className="mt-6 grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border border-[#dce5ef] p-5"><p className="text-[13px] font-extrabold text-[#172033]">서비스·상세 요금 · {rows.length}개</p><div className="mt-3 space-y-2">{rows.map((row) => <div key={row.id} className="flex items-center justify-between gap-3 rounded-xl bg-[#f6f8fb] px-3 py-2.5 text-[13px]"><span className="font-bold text-[#334155]">{row.service}</span><span className="text-[#607080]">{Number(row.price).toLocaleString()}원 · {row.duration}분</span></div>)}</div><p className="mt-3 text-[12px] text-[#7b899c]">원본: {file?.name ?? "직접 입력"}</p></div><div className="rounded-2xl border border-[#dce5ef] p-5"><p className="text-[13px] font-extrabold text-[#172033]">개인정보·계정 정보</p><dl className="mt-3 grid grid-cols-[92px_1fr] gap-y-2 text-[13px]"><dt className="text-[#7a8798]">대표자</dt><dd className="font-semibold text-[#334155]">{account.ownerName}</dd><dt className="text-[#7a8798]">이메일</dt><dd className="font-semibold text-[#334155]">{account.email}</dd><dt className="text-[#7a8798]">매장</dt><dd className="font-semibold text-[#334155]">{account.shopName}</dd><dt className="text-[#7a8798]">연락처</dt><dd className="font-semibold text-[#334155]">{account.shopPhone}</dd><dt className="text-[#7a8798]">주소</dt><dd className="font-semibold text-[#334155]">{account.shopAddress}</dd></dl></div></div><div className="mt-5 rounded-2xl bg-[#eef8f3] px-4 py-3 text-[13px] font-semibold text-[#177856]"><ShieldCheck className="mr-1 inline h-4 w-4" />현재까지 서버 영구 저장 0회 · 최종 확인에서만 1회 요청</div>{error ? <p className="mt-3 rounded-xl bg-[#fff1ef] px-4 py-3 text-[13px] font-semibold text-[#ad4335]">{error}</p> : null}<div className="mt-6 grid grid-cols-[0.45fr_1fr] gap-3"><button type="button" onClick={onBack} disabled={saving} className="flex h-12 items-center justify-center gap-1 rounded-xl border border-[#ced8e5] font-bold text-[#526174]"><ArrowLeft className="h-4 w-4" />이전</button><button type="button" onClick={onSubmit} disabled={saving} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#2f6fde] text-[14px] font-bold text-white disabled:bg-[#9bb8e8]">{saving ? "최종 경계 검증 중" : "가입 내용 최종 확인"}<CheckCircle2 className="h-4 w-4" /></button></div></section>;
}

function CompleteStep({ requestCount, onRestart }: { requestCount: number; onRestart: () => void }) {
  return <section className="mx-auto max-w-[920px] overflow-hidden rounded-3xl border border-[#d9e3ef] bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)]"><div className="bg-[#14213a] px-6 py-7 text-white sm:px-8"><span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#2f6fde]"><Check className="h-6 w-6" /></span><h2 className="mt-4 text-[27px] font-extrabold tracking-[-0.04em]">회원가입 저장 경계 검증 완료</h2><p className="mt-2 text-[14px] text-[#bdc8d9]">개발 데모 응답만 확인했으며 계정·DB·Storage에는 아무것도 저장하지 않았습니다.</p></div><div className="p-5 sm:p-8"><div className="grid gap-3 sm:grid-cols-3">{[["최종 서버 요청", `${requestCount}회`],["가입 전 영구 저장", "0건"],["Production 변경", "없음"]].map(([label,value]) => <div key={label} className="rounded-2xl border border-[#dce5ef] bg-[#f8fafc] p-4"><p className="text-[12px] font-semibold text-[#7a8798]">{label}</p><p className="mt-1 text-[20px] font-extrabold text-[#172033]">{value}</p></div>)}</div><div className="mt-6 rounded-2xl border border-[#c9d9ee] bg-[#f5f9ff] p-5"><p className="text-[12px] font-bold tracking-[0.08em] text-[#2f6fde]">AFTER SIGNUP · 2 STEPS</p><h3 className="mt-2 text-[22px] font-extrabold text-[#172033]">이제 두 가지만 확인하면 됩니다</h3><div className="mt-4 grid gap-3 sm:grid-cols-2">{[{ Icon: CalendarClock, title: "영업시간·휴무일", text: "실제 매장과 다른 시간만 수정" },{ Icon: Users, title: "직원·근무표", text: "직원 추가 후 근무시간 확인" }].map(({Icon,title,text}, index) => <div key={title} className="flex items-center gap-3 rounded-2xl bg-white p-4"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eaf2ff] text-[#2f6fde]"><Icon className="h-5 w-5" /></span><div><p className="text-[14px] font-extrabold text-[#172033]">{index + 1}. {title}</p><p className="mt-0.5 text-[12px] text-[#6b7a90]">{text}</p></div></div>)}</div><p className="mt-4 text-[13px] font-bold text-[#177856]">서비스·상세 요금은 다시 묻지 않습니다.</p></div><button type="button" onClick={onRestart} className="mt-5 h-11 w-full rounded-xl border border-[#cad5e4] text-[13px] font-bold text-[#526174]">데모 처음부터 다시 보기</button></div></section>;
}

export default function SignupAndInitialSetupPreviewClient({ visionReady }: { visionReady: boolean }) {
  const [stage, setStage] = useState<Stage>("price");
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [recognition, setRecognition] = useState<RecognitionState>("idle");
  const [account, setAccount] = useState<AccountDraft>(initialAccount);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestCount, setRequestCount] = useState(0);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [stage]);

  const submitFinal = async () => {
    setSaving(true); setError(null);
    try {
      const response = await fetch("/api/dev/signup-flow-demo/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ services: rows, account: { ...account, password: account.password ? "[DEMO_REDACTED]" : "" }, sourcePhoto: file ? { name: file.name, size: file.size, type: file.type } : null }) });
      const result = (await response.json()) as { success?: boolean; persisted?: boolean; message?: string };
      setRequestCount((count) => count + 1);
      if (!response.ok || !result.success || result.persisted !== false) throw new Error(result.message ?? "개발 저장 경계를 확인하지 못했습니다.");
      setStage("complete");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "최종 검증 요청에 실패했습니다."); }
    finally { setSaving(false); }
  };

  const restart = () => { setStage("price"); setRows([]); setFile(null); setRecognition("idle"); setAccount(initialAccount); setError(null); setRequestCount(0); };

  return <main className="min-h-screen bg-[#eef3f9] px-4 py-6 text-[#172033] sm:px-6 sm:py-10"><div className="mx-auto max-w-[1160px]"><header className="mb-6 text-center"><span className="inline-flex items-center gap-2 rounded-full border border-[#cbd8ea] bg-white px-3 py-1.5 text-[12px] font-bold text-[#2f6fde]"><Sparkles className="h-4 w-4" />SIGNUP_FLOW_DEMO_IMPLEMENTATION v0.1</span><h1 className="mt-4 text-[30px] font-extrabold tracking-[-0.05em] text-[#111827] sm:text-[40px]">회원가입 중<br className="sm:hidden" /> 서비스·가격 최초 등록</h1><p className="mx-auto mt-2 max-w-[690px] text-[14px] leading-6 text-[#66748b]">가입 첫 단계에서 서비스명과 가격을 입력하고, 가입 완료 시 매장 계정에 저장합니다.</p></header>{stage !== "complete" ? <div className="mx-auto mb-5 max-w-[820px]"><StepIndicator stage={stage} /></div> : null}{stage === "price" ? <PriceStep visionReady={visionReady} rows={rows} setRows={setRows} file={file} setFile={setFile} recognition={recognition} setRecognition={setRecognition} onNext={() => setStage("account")} /> : null}{stage === "account" ? <AccountStep account={account} setAccount={setAccount} onBack={() => setStage("price")} onNext={() => setStage("review")} /> : null}{stage === "review" ? <ReviewStep rows={rows} account={account} file={file} saving={saving} error={error} onBack={() => setStage("account")} onSubmit={() => void submitFinal()} /> : null}{stage === "complete" ? <CompleteStep requestCount={requestCount} onRestart={restart} /> : null}</div></main>;
}
