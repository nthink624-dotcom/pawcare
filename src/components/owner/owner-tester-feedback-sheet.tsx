"use client";

import { AlertCircle, HelpCircle, Lightbulb, Paperclip } from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";

import { ActionButton, Sheet } from "@/components/owner/owner-app-ui";
import {
  createTesterFeedbackRequestId,
  normalizeTesterFeedbackBody,
  TESTER_FEEDBACK_BODY_MIN_LENGTH,
  TESTER_FEEDBACK_BODY_MAX_LENGTH,
  testerFeedbackCategoryLabels,
  type TesterFeedbackCategory,
  type TesterFeedbackScreenKey,
} from "@/lib/tester-feedback";
import type { OwnerFeedbackAdapter, OwnerFeedbackScreenshotReceipt } from "@/lib/owner-feedback-adapter";

const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;

function draftKey(shopId: string, screenKey: TesterFeedbackScreenKey) {
  return `petmanager.owner.feedback-draft.v2:${shopId}:${screenKey}`;
}

function legacyDraftKey(shopId: string, screenKey: TesterFeedbackScreenKey, isTester: boolean) {
  return `petmanager.owner.feedback-draft.v1:${shopId}:${screenKey}:${isTester ? "tester" : "owner"}`;
}

function readDraft(shopId: string, screenKey: TesterFeedbackScreenKey, isTester: boolean, initialCategory: TesterFeedbackCategory) {
  if (typeof window === "undefined") return { body: "", category: initialCategory } as const;
  try {
    const saved = window.sessionStorage.getItem(draftKey(shopId, screenKey))
      ?? window.sessionStorage.getItem(legacyDraftKey(shopId, screenKey, isTester));
    const draft = saved ? JSON.parse(saved) as { body?: string; category?: TesterFeedbackCategory } : null;
    return { body: draft?.body ?? "", category: draft?.category ?? initialCategory };
  } catch {
    window.sessionStorage.removeItem(draftKey(shopId, screenKey));
    window.sessionStorage.removeItem(legacyDraftKey(shopId, screenKey, isTester));
    return { body: "", category: initialCategory } as const;
  }
}

export default function OwnerTesterFeedbackSheet({
  shopId,
  screenKey,
  appVersion,
  onClose,
  returnFocusRef,
  isTester,
  initialCategory,
  adapter,
}: {
  shopId: string;
  screenKey: TesterFeedbackScreenKey;
  appVersion: string;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLElement | null>;
  isTester: boolean;
  initialCategory: TesterFeedbackCategory;
  /** General-owner transport is injected only after shared contract landing. */
  adapter?: OwnerFeedbackAdapter;
}) {
  const initialDraft = readDraft(shopId, screenKey, isTester, initialCategory);
  const [category, setCategory] = useState<TesterFeedbackCategory>(initialDraft.category);
  const [body, setBody] = useState(initialDraft.body);
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotReceipt, setScreenshotReceipt] = useState<OwnerFeedbackScreenshotReceipt | null>(null);
  const [submitState, setSubmitState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requestIdRef = useRef<string | null>(null);
  const lastAttemptFingerprintRef = useRef<string | null>(null);
  const categoryRef = useRef<HTMLButtonElement | null>(null);

  const normalizedBody = normalizeTesterFeedbackBody(body);
  const canSubmit = normalizedBody.length >= TESTER_FEEDBACK_BODY_MIN_LENGTH && normalizedBody.length <= TESTER_FEEDBACK_BODY_MAX_LENGTH;

  useEffect(() => {
    if (!body) return;
    window.sessionStorage.setItem(draftKey(shopId, screenKey), JSON.stringify({ body, category }));
  }, [body, category, isTester, screenKey, shopId]);

  async function submitFeedback() {
    if (!canSubmit || submitState === "submitting") return;
    if (!adapter) return;

    const fingerprint = `${category}\n${normalizedBody}`;
    if (lastAttemptFingerprintRef.current !== fingerprint) {
      requestIdRef.current = createTesterFeedbackRequestId();
      lastAttemptFingerprintRef.current = fingerprint;
    }
    const requestId = requestIdRef.current;
    if (!requestId) return;

    setSubmitState("submitting");
    setErrorMessage(null);
    try {
      let receipt = screenshotReceipt;
      if (screenshot && !receipt) {
        if (!adapter.createScreenshotReceipt) throw new Error("스크린샷 전송 연결을 준비하고 있습니다.");
        receipt = await adapter.createScreenshotReceipt(shopId, screenshot);
        setScreenshotReceipt(receipt);
      }
      await adapter.submit({
        shopId,
        requestId,
        category,
        body: normalizedBody,
        screenKey,
        appVersion,
        screenshot: receipt,
      });
      setSubmitState("success");
      setBody("");
      setScreenshot(null);
      setScreenshotReceipt(null);
      window.sessionStorage.removeItem(draftKey(shopId, screenKey));
      window.sessionStorage.removeItem(legacyDraftKey(shopId, screenKey, isTester));
    } catch (error) {
      setSubmitState("error");
      setErrorMessage(error instanceof Error ? error.message : "피드백을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
  }

  if (submitState === "success") {
    return (
      <Sheet title="피드백 보내기" onClose={onClose} dialogLabel="문의·의견 보내기" initialFocusRef={categoryRef} restoreFocusRef={returnFocusRef} focusKey="success" safeAreaPadding>
        <div className="space-y-4 pb-1">
          <div className="rounded-[12px] border border-[#d9e5dd] bg-[#f7fbf8] px-3.5 py-3 text-[14px] leading-5 text-[#1f6b5b]">
            피드백을 보냈어요. 확인 후 개선에 반영하겠습니다.
          </div>
          <ActionButton onClick={onClose}>닫기</ActionButton>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title="문의·의견 보내기" onClose={onClose} dialogLabel="문의·의견 보내기" initialFocusRef={categoryRef} restoreFocusRef={returnFocusRef} focusKey="feedback-form" safeAreaPadding>
      <div className="space-y-4 pb-1">
        <div className="grid grid-cols-1 gap-2 min-[340px]:grid-cols-3" aria-label="피드백 종류">
          {(["inquiry", "improvement", "bug"] as TesterFeedbackCategory[]).map((nextCategory) => {
            const selected = category === nextCategory;
            const Icon = nextCategory === "bug" ? AlertCircle : nextCategory === "improvement" ? Lightbulb : HelpCircle;
            return (
              <button
                key={nextCategory}
                type="button"
                ref={nextCategory === "inquiry" ? categoryRef : undefined}
                aria-pressed={selected}
                disabled={submitState === "submitting"}
                className={`flex min-h-11 items-center justify-center gap-2 rounded-[10px] border px-3 text-[14px] font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] ${
                  selected ? "border-[#d8c59c] bg-[#fffaf0] text-[#74531e]" : "border-[var(--border)] bg-white text-[var(--muted)]"
                }`}
                onClick={() => {
                  setCategory(nextCategory);
                  setSubmitState("idle");
                  setErrorMessage(null);
                }}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {testerFeedbackCategoryLabels[nextCategory]}
              </button>
            );
          })}
        </div>

        <label className="block">
          <span className="mb-1.5 flex items-center justify-between gap-2 text-[13px] font-medium text-[var(--text)]"><span>내용</span></span>
          <textarea
            value={body}
            onChange={(event) => {
              setBody(event.target.value);
              setSubmitState("idle");
              setErrorMessage(null);
            }}
            disabled={submitState === "submitting"}
            required
            aria-required="true"
            maxLength={TESTER_FEEDBACK_BODY_MAX_LENGTH}
            aria-describedby="tester-feedback-privacy-note"
            className="field min-h-[132px] w-full resize-y !rounded-[12px] !px-3.5 !py-3 text-[16px] leading-6"
            placeholder="불편했던 점이나 바라는 점을 적어 주세요"
          />
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-[10px] border border-[var(--border)] bg-white px-3 text-[14px] font-medium text-[var(--text)] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#2563eb]">
          <Paperclip className="h-4 w-4 text-[var(--muted)]" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">{screenshot ? "스크린샷 선택됨" : "스크린샷 첨부 (선택)"}</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              event.target.value = "";
              if (!file) return;
              if (!/image\/(png|jpeg|webp)/.test(file.type) || file.size > MAX_SCREENSHOT_BYTES) {
                setErrorMessage("스크린샷은 5MB 이하의 PNG, JPG 또는 WebP만 첨부할 수 있습니다.");
                return;
              }
              setScreenshot(file);
              setScreenshotReceipt(null);
              setErrorMessage(null);
            }}
          />
        </label>
        <p className="text-[12px] leading-5 text-[var(--muted)]">선택한 스크린샷만 전송하며, 고객 정보가 보이지 않는 화면으로 첨부해 주세요.</p>
        <p id="tester-feedback-privacy-note" className="text-[13px] leading-5 text-[var(--muted)]">고객 개인정보는 입력하지 마세요</p>
        {errorMessage ? <p role="alert" className="rounded-[10px] border border-[#f0d7d7] bg-[#fff7f7] px-3 py-2 text-[14px] leading-5 text-[#9a5e4e]">{errorMessage}</p> : null}
        <ActionButton disabled={!canSubmit || submitState === "submitting"} onClick={() => void submitFeedback()}>
          {submitState === "submitting" ? "보내는 중" : "제출하기"}
        </ActionButton>
      </div>
    </Sheet>
  );
}
