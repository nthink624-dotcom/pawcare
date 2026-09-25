"use client";

import { CheckCircle2, ImagePlus, Send, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import {
  createOwnerFeedbackPayload,
  ownerFeedbackKindLabels,
  ownerFeedbackKinds,
  type OwnerFeedbackKind,
  type OwnerFeedbackScreenshotReceipt,
  uploadOwnerFeedbackScreenshot,
} from "@/components/owner-web/owner-feedback-adapter";
import type { OwnerWebScreenKey } from "@/components/owner-web/owner-web-data";
import { fetchApiJsonWithAuth } from "@/lib/api";
import { cn } from "@/lib/utils";

const MAX_BODY_LENGTH = 2000;
const ACCEPTED_SCREENSHOT_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

type FeedbackAcknowledgement = {
  feedback: { screenshotAccepted: boolean };
  replayed: boolean;
};

export default function OwnerFeatureRequestDialog({ open, shopId, activeScreen, initialKind = "inquiry", fixtureMode = false, onClose }: {
  open: boolean;
  shopId: string;
  activeScreen: OwnerWebScreenKey;
  initialKind?: OwnerFeedbackKind;
  fixtureMode?: boolean;
  onClose: () => void;
}) {
  const titleId = useId();
  const bodyId = useId();
  const firstControlRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const requestIdRef = useRef<string | null>(null);
  const submittingRef = useRef(false);
  const [kind, setKind] = useState<OwnerFeedbackKind>("inquiry");
  const [body, setBody] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotReceipt, setScreenshotReceipt] = useState<OwnerFeedbackScreenshotReceipt | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setKind(initialKind);
    window.setTimeout(() => firstControlRef.current?.focus(), 0);
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !submittingRef.current) onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [initialKind, onClose, open]);

  if (!open) return null;
  const canSubmit = body.trim().length > 0 && !submitting;

  function closeDialog() {
    if (submittingRef.current) return;
    onClose();
    window.setTimeout(() => {
      setKind("inquiry");
      setBody("");
      setScreenshot(null);
      setScreenshotReceipt(null);
      setSent(false);
      setError("");
      requestIdRef.current = null;
    }, 180);
  }

  async function submitFeedback() {
    if (!canSubmit || submittingRef.current) return;
    const requestId = requestIdRef.current ?? crypto.randomUUID();
    requestIdRef.current = requestId;
    submittingRef.current = true;
    setSubmitting(true);
    setError("");
    try {
      const receipt = screenshot
        ? screenshotReceipt ?? (fixtureMode
            ? {
                mediaAssetId: crypto.randomUUID(),
                contentType: screenshot.type as OwnerFeedbackScreenshotReceipt["contentType"],
                byteSize: screenshot.size,
                consent: true as const,
              }
            : await uploadOwnerFeedbackScreenshot(shopId, screenshot))
        : null;
      if (receipt !== screenshotReceipt) setScreenshotReceipt(receipt);
      const init = {
        method: "POST",
        body: JSON.stringify(createOwnerFeedbackPayload({ shopId, requestId, kind, body, screen: activeScreen, screenshot: receipt })),
      };
      const result = fixtureMode
        ? await fetch("/api/owner/tester-feedback", init).then(async (response) => {
            const json = await response.json() as FeedbackAcknowledgement & { message?: string };
            if (!response.ok) throw new Error(json.message ?? "문의·의견을 보내지 못했습니다. 다시 시도해 주세요.");
            return json;
          })
        : await fetchApiJsonWithAuth<FeedbackAcknowledgement>("/api/owner/tester-feedback", init);
      if (receipt && !result.feedback.screenshotAccepted) {
        throw new Error("스크린샷 접수 여부를 확인하지 못했습니다. 다시 시도해 주세요.");
      }
      setSent(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "문의·의견을 보내지 못했습니다. 다시 시도해 주세요.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#111827]/40 p-3 sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialog(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby={titleId} className="max-h-[calc(100dvh-24px)] w-full max-w-[480px] overflow-y-auto rounded-[12px] border border-[#dbe2ea] bg-white shadow-[0_20px_54px_rgba(15,23,42,0.18)]">
        <header className="flex items-start justify-between gap-4 border-b border-[#e8edf3] px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-[20px] font-semibold tracking-[-0.02em] text-[#111827]">문의·의견 보내기</h2>
            <p className="mt-1 text-[14px] font-normal leading-5 text-[#64748b]">불편한 점이나 필요한 도움을 짧게 알려주세요.</p>
          </div>
          <button type="button" onClick={closeDialog} disabled={submitting} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] text-[#64748b] transition hover:bg-[#f3f6f9] hover:text-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] disabled:opacity-40" aria-label="닫기"><X className="h-5 w-5" /></button>
        </header>

        {sent ? (
          <div className="px-5 py-8 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-[#1f9d55]" strokeWidth={1.8} />
            <h3 className="mt-3 text-[18px] font-semibold text-[#111827]">보냈습니다</h3>
            <p className="mt-1 text-[14px] leading-5 text-[#64748b]">확인한 뒤 필요한 내용을 안내해 드릴게요.</p>
            {screenshotReceipt ? <p className="mt-2 text-[13px] font-medium text-[#1f6b5b]">스크린샷도 함께 접수했습니다.</p> : null}
            <button type="button" onClick={closeDialog} className="mt-5 inline-flex h-11 items-center justify-center rounded-[8px] bg-[#2563eb] px-5 text-[14px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2">확인</button>
          </div>
        ) : (
          <div className="space-y-4 px-5 py-4">
            <fieldset>
              <legend className="text-[14px] font-semibold text-[#334155]">구분</legend>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {ownerFeedbackKinds.map((value, index) => (
                  <button key={value} ref={index === 0 ? firstControlRef : undefined} type="button" onClick={() => setKind(value)} aria-pressed={kind === value} className={cn("inline-flex min-h-11 items-center justify-center rounded-[8px] border px-2 text-[14px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-1", kind === value ? "border-[#9db7db] bg-[#edf4ff] text-[#244f86]" : "border-[#dbe2ea] bg-white text-[#475569] hover:bg-[#f8fafc]")}>{ownerFeedbackKindLabels[value]}</button>
                ))}
              </div>
            </fieldset>

            <label className="grid gap-2" htmlFor={bodyId}>
              <span className="text-[14px] font-semibold text-[#334155]">내용</span>
              <textarea id={bodyId} value={body} onChange={(event) => setBody(event.target.value.slice(0, MAX_BODY_LENGTH))} className="min-h-[124px] resize-y rounded-[8px] border border-[#dbe2ea] bg-white px-3 py-3 text-[15px] font-normal leading-6 text-[#111827] outline-none transition placeholder:text-[#94a3b8] focus:border-[#2563eb] focus:ring-2 focus:ring-[#dbeafe]" placeholder="어떤 점을 확인하거나 개선하면 좋을지 적어주세요." />
              <span className="text-right text-[13px] tabular-nums text-[#64748b]">{body.length}/{MAX_BODY_LENGTH}</span>
            </label>

            <div>
              <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[14px] font-medium text-[#475569] transition hover:bg-[#f8fafc] focus-within:ring-2 focus-within:ring-[#2563eb]">
                <ImagePlus className="h-4 w-4" strokeWidth={1.8} />
                <span>스크린샷 첨부 <span className="font-normal text-[#7c8798]">(선택)</span></span>
                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => { const file = event.currentTarget.files?.[0] ?? null; setError(""); setScreenshotReceipt(null); if (file && !ACCEPTED_SCREENSHOT_TYPES.has(file.type)) { setScreenshot(null); setError("PNG, JPG, WEBP 이미지 파일만 선택해 주세요."); return; } setScreenshot(file); }} />
              </label>
              {screenshot ? <div className="mt-2 flex min-h-11 items-center justify-between gap-3 rounded-[8px] bg-[#f8fafc] px-3 text-[13px] text-[#475569]"><span className="min-w-0 truncate">{screenshot.name}</span><button type="button" onClick={() => { setScreenshot(null); setScreenshotReceipt(null); }} className="inline-flex h-11 shrink-0 items-center px-1 font-semibold text-[#607080] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]">첨부 지우기</button></div> : null}
              <p className="mt-2 text-[13px] font-normal leading-5 text-[#64748b]">화면, 개인정보, 기기 정보는 자동으로 수집하지 않습니다.</p>
            </div>

            {error ? <p role="alert" className="rounded-[8px] border border-[#e7c4c9] bg-[#fff8f8] px-3 py-2 text-[13px] font-medium leading-5 text-[#a04455]">{error}</p> : null}

            <footer className="flex justify-end gap-2 border-t border-[#e8edf3] pt-4">
              <button type="button" onClick={closeDialog} disabled={submitting} className="inline-flex h-11 items-center justify-center rounded-[8px] border border-[#dbe2ea] bg-white px-4 text-[14px] font-semibold text-[#475569] hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] disabled:opacity-40">취소</button>
              <button type="button" onClick={() => void submitFeedback()} disabled={!canSubmit} className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-[#2563eb] px-4 text-[14px] font-semibold text-white transition hover:bg-[#1d4ed8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[#cbd5e1]"><Send className="h-4 w-4" />{submitting ? "보내는 중" : "보내기"}</button>
            </footer>
          </div>
        )}
      </section>
    </div>
  );
}
