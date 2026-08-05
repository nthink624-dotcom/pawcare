"use client";

import { CheckCircle2, FileSpreadsheet, ShieldCheck, Upload, X } from "lucide-react";
import { useRef, useState } from "react";

import { fetchApiJsonWithAuth } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { DataImportCommitResult, DataImportPreview, DataImportSource } from "@/types/data-import";

type PreviewTab = "customers" | "visits" | "priceGuide";

function SummaryCell({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "merge" | "skip" }) {
  return (
    <div className="rounded-[8px] border border-[#e5e9ef] bg-white px-3 py-2.5">
      <p className="text-[11px] font-medium text-[#7b8798]">{label}</p>
      <p className={cn("mt-0.5 text-[18px] font-bold", tone === "merge" ? "text-[#326b61]" : tone === "skip" ? "text-[#9a5b20]" : "text-[#172033]")}>{value.toLocaleString("ko-KR")}</p>
    </div>
  );
}

function ActionBadge({ action }: { action: "create" | "merge" | "skip" }) {
  const label = action === "create" ? "신규" : action === "merge" ? "합치기" : "제외";
  return <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold", action === "create" ? "border-[#cfe4dd] text-[#2f6f61]" : action === "merge" ? "border-[#d8e0ea] text-[#526174]" : "border-[#eadccf] text-[#9a5b20]")}>{label}</span>;
}

export default function DataImportDialog({
  open,
  shopId,
  onClose,
  onCompleted,
}: {
  open: boolean;
  shopId: string;
  onClose: () => void;
  onCompleted: (result: DataImportCommitResult) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [source, setSource] = useState<DataImportSource>("teepee");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<DataImportPreview | null>(null);
  const [tab, setTab] = useState<PreviewTab>("customers");
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function submit(mode: "preview" | "commit") {
    if (!file) {
      setError("이전할 엑셀 파일을 선택해 주세요.");
      return;
    }
    const formData = new FormData();
    formData.set("shopId", shopId);
    formData.set("source", source);
    formData.set("mode", mode);
    formData.set("file", file);
    setError("");
    if (mode === "preview") setLoading(true);
    else setCommitting(true);
    try {
      if (mode === "preview") {
        const nextPreview = await fetchApiJsonWithAuth<DataImportPreview>("/api/owner/data-import", {
          method: "POST",
          body: formData,
        });
        setPreview(nextPreview);
        setTab(nextPreview.customers.length > 0 ? "customers" : nextPreview.visits.length > 0 ? "visits" : "priceGuide");
      } else {
        const result = await fetchApiJsonWithAuth<DataImportCommitResult>("/api/owner/data-import", {
          method: "POST",
          body: formData,
        });
        onCompleted(result);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "파일을 처리하지 못했습니다.");
    } finally {
      setLoading(false);
      setCommitting(false);
    }
  }

  function resetFile(nextFile: File | null) {
    setFile(nextFile);
    setPreview(null);
    setError("");
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#0f172a]/25 p-5 backdrop-blur-[1px]" onMouseDown={(event) => { if (event.target === event.currentTarget && !committing) onClose(); }}>
      <section className="flex max-h-[88vh] w-full max-w-[1080px] flex-col overflow-hidden rounded-[12px] border border-[#dce3eb] bg-[#f7f8fa] shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
        <header className="flex items-start justify-between gap-4 border-b border-[#e2e7ee] bg-white px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-[#edf5f2] text-[#256a5d]"><FileSpreadsheet className="h-5 w-5" /></span>
            <div><h2 className="text-[18px] font-bold tracking-[-0.02em] text-[#111827]">티피에서 펫매니저로 옮기기</h2><p className="mt-1 text-[12px] text-[#64748b]">고객·반려동물·방문기록·요금표를 한 파일에서 자동 분류합니다.</p></div>
          </div>
          <button type="button" onClick={onClose} disabled={committing} aria-label="닫기" className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#718096] hover:bg-[#f1f4f7]"><X className="h-4 w-4" /></button>
        </header>

        <div className="min-h-0 flex-1 overflow-auto p-5">
          <div className="grid gap-4 lg:grid-cols-[330px_1fr]">
            <aside className="space-y-3">
              <div className="rounded-[10px] border border-[#e2e7ee] bg-white p-4">
                <label className="text-[12px] font-bold text-[#334155]">이전 원본</label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => { setSource("teepee"); setPreview(null); }} className={cn("h-9 rounded-[8px] border text-[12px] font-semibold", source === "teepee" ? "border-[#2f7568] bg-[#f2f8f6] text-[#255f55]" : "border-[#dfe5ec] text-[#64748b]")}>티피</button>
                  <button type="button" onClick={() => { setSource("generic"); setPreview(null); }} className={cn("h-9 rounded-[8px] border text-[12px] font-semibold", source === "generic" ? "border-[#2f7568] bg-[#f2f8f6] text-[#255f55]" : "border-[#dfe5ec] text-[#64748b]")}>일반 엑셀</button>
                </div>
                <input ref={inputRef} type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" className="hidden" onChange={(event) => resetFile(event.target.files?.[0] ?? null)} />
                <button type="button" onClick={() => inputRef.current?.click()} className="mt-3 flex min-h-[112px] w-full flex-col items-center justify-center rounded-[9px] border border-dashed border-[#cfd8e3] bg-[#fafbfc] px-3 text-center hover:bg-[#f7f9fb]">
                  <Upload className="h-5 w-5 text-[#708096]" />
                  <span className="mt-2 max-w-full truncate text-[12px] font-semibold text-[#334155]">{file?.name ?? ".xlsx 또는 .csv 선택"}</span>
                  <span className="mt-1 text-[10px] text-[#94a3b8]">최대 10MB · 5,000행</span>
                </button>
                <button type="button" onClick={() => void submit("preview")} disabled={!file || loading || committing} className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-[8px] bg-[#152033] text-[13px] font-bold text-white disabled:opacity-45">
                  {loading ? "자동 분류 중..." : "이전 결과 미리보기"}
                </button>
              </div>

              <div className="rounded-[10px] border border-[#e2e7ee] bg-white p-4">
                <div className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#2f7568]" /><div><p className="text-[12px] font-bold text-[#334155]">원본 파일은 저장하지 않습니다.</p><p className="mt-1 text-[11px] leading-5 text-[#718096]">확정 전에는 DB에 아무것도 쓰지 않고, 확정 후에는 중복 방지용 파일 지문과 처리 결과만 보관합니다.</p></div></div>
                <a href="/owner?screen=help" className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-[8px] border border-[#dfe5ec] text-[12px] font-semibold text-[#526174] hover:bg-[#f8fafc]">펫매니저 이전 대행 요청</a>
              </div>
            </aside>

            <main className="min-w-0">
              {!preview ? (
                <div className="flex min-h-[420px] flex-col items-center justify-center rounded-[10px] border border-dashed border-[#d8dee8] bg-white text-center">
                  <FileSpreadsheet className="h-8 w-8 text-[#9aa7b8]" strokeWidth={1.5} />
                  <p className="mt-3 text-[15px] font-bold text-[#253044]">파일을 선택하면 먼저 이전 결과를 보여드립니다.</p>
                  <p className="mt-1 max-w-[460px] text-[12px] leading-5 text-[#718096]">전화번호로 보호자를 합치고, 같은 보호자의 같은 반려동물은 중복 생성하지 않습니다. 오류 행은 자동 제외됩니다.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 xl:grid-cols-6">
                    <SummaryCell label="보호자 신규" value={preview.summary.guardiansToCreate} />
                    <SummaryCell label="보호자 합치기" value={preview.summary.guardiansToMerge} tone="merge" />
                    <SummaryCell label="반려동물 신규" value={preview.summary.petsToCreate} />
                    <SummaryCell label="반려동물 합치기" value={preview.summary.petsToMerge} tone="merge" />
                    <SummaryCell label="방문기록" value={preview.summary.visitsToImport} />
                    <SummaryCell label="제외 행" value={preview.summary.skippedRows} tone="skip" />
                  </div>
                  {preview.warnings.length > 0 ? <div className="rounded-[8px] border border-[#eadfce] bg-[#fffdf9] px-3 py-2 text-[11px] leading-5 text-[#805c2b]">{preview.warnings.join(" · ")}</div> : null}
                  <div className="overflow-hidden rounded-[10px] border border-[#e2e7ee] bg-white">
                    <div className="flex items-center gap-1 border-b border-[#e7ebf0] px-3 pt-2">
                      {([
                        ["customers", `고객 ${preview.customers.length}`],
                        ["visits", `방문기록 ${preview.visits.length}`],
                        ["priceGuide", `요금표 ${preview.priceGuide.length}`],
                      ] as Array<[PreviewTab, string]>).map(([value, label]) => <button key={value} type="button" onClick={() => setTab(value)} className={cn("border-b-2 px-3 py-2 text-[12px] font-semibold", tab === value ? "border-[#256a5d] text-[#255f55]" : "border-transparent text-[#7b8798]")}>{label}</button>)}
                    </div>
                    <div className="max-h-[360px] overflow-auto">
                      <table className="w-full min-w-[680px] text-left">
                        <thead className="sticky top-0 bg-[#fafbfc] text-[10px] font-semibold text-[#718096]">
                          {tab === "customers" ? <tr><th className="px-3 py-2">처리</th><th className="px-3 py-2">보호자</th><th className="px-3 py-2">연락처</th><th className="px-3 py-2">반려동물</th><th className="px-3 py-2">품종·체중</th><th className="px-3 py-2">확인</th></tr> : tab === "visits" ? <tr><th className="px-3 py-2">처리</th><th className="px-3 py-2">방문일</th><th className="px-3 py-2">보호자·반려동물</th><th className="px-3 py-2">서비스</th><th className="px-3 py-2 text-right">실제시간</th><th className="px-3 py-2 text-right">금액</th></tr> : <tr><th className="px-3 py-2">처리</th><th className="px-3 py-2">그룹</th><th className="px-3 py-2">무게</th><th className="px-3 py-2">항목</th><th className="px-3 py-2 text-right">예상시간</th><th className="px-3 py-2 text-right">가격</th></tr>}
                        </thead>
                        <tbody className="divide-y divide-[#eef1f4] text-[11px] text-[#526174]">
                          {tab === "customers" ? preview.customers.map((row) => <tr key={`${row.sheetName}-${row.rowNumber}`}><td className="px-3 py-2"><ActionBadge action={row.action} /></td><td className="px-3 py-2 font-semibold text-[#253044]">{row.guardianName}</td><td className="px-3 py-2">{row.phone}</td><td className="px-3 py-2 font-semibold text-[#253044]">{row.petName}</td><td className="px-3 py-2">{row.breed}{row.weightKg ? ` · ${row.weightKg}kg` : ""}</td><td className="max-w-[220px] px-3 py-2 text-[#8a6a3a]">{row.issues.join(" ") || `${row.visitCount}건 연결`}</td></tr>) : tab === "visits" ? preview.visits.map((row) => <tr key={`${row.sheetName}-${row.rowNumber}`}><td className="px-3 py-2"><ActionBadge action={row.action} /></td><td className="px-3 py-2">{row.visitDate}</td><td className="px-3 py-2 font-semibold text-[#253044]">{row.guardianName} · {row.petName}</td><td className="px-3 py-2">{row.serviceName}</td><td className="px-3 py-2 text-right">{row.actualMinutes ? `${row.actualMinutes}분` : "-"}</td><td className="px-3 py-2 text-right font-semibold text-[#253044]">{row.amount.toLocaleString("ko-KR")}원</td></tr>) : preview.priceGuide.map((row) => <tr key={`${row.sheetName}-${row.rowNumber}`}><td className="px-3 py-2"><ActionBadge action={row.action} /></td><td className="px-3 py-2 font-semibold text-[#253044]">{row.groupName}</td><td className="px-3 py-2">{row.weightBand}</td><td className="px-3 py-2">{row.serviceName}</td><td className="px-3 py-2 text-right">{row.durationMinutes ? `${row.durationMinutes}분` : "확인 필요"}</td><td className="px-3 py-2 text-right font-semibold text-[#253044]">{row.price.toLocaleString("ko-KR")}원</td></tr>)}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </main>
          </div>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-[#e2e7ee] bg-white px-5 py-3">
          <div>{error ? <p className="text-[12px] font-semibold text-[#a04455]">{error}</p> : preview ? <p className="flex items-center gap-1.5 text-[11px] text-[#607080]"><CheckCircle2 className="h-3.5 w-3.5 text-[#2f7568]" />확정 후 같은 파일을 다시 올려도 중복 등록되지 않습니다.</p> : null}</div>
          <div className="flex items-center gap-2"><button type="button" onClick={onClose} disabled={committing} className="h-9 rounded-[8px] border border-[#dfe5ec] px-4 text-[12px] font-semibold text-[#526174]">취소</button><button type="button" onClick={() => void submit("commit")} disabled={!preview || committing || loading} className="h-9 rounded-[8px] bg-[#1f6f5f] px-5 text-[12px] font-bold text-white disabled:opacity-45">{committing ? "안전하게 이전 중..." : "이 결과대로 이전"}</button></div>
        </footer>
      </section>
    </div>
  );
}
