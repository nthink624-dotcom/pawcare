"use client";

import { ArrowUp, Loader2, Mic, MicOff, Square } from "lucide-react";
import { type FocusEvent, type KeyboardEvent, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { CARE_REPORT_TYPOGRAPHY as OWNER_TYPOGRAPHY } from "@/components/owner-web/owner-typography";

type SpeechResultEvent = Event & {
  resultIndex: number;
  results: ArrayLike<{
    0: { transcript: string };
    isFinal: boolean;
  }>;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognitionConstructor() {
  if (typeof window === "undefined") return null;
  const speechWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

function subscribeSpeechRecognitionSupport() {
  return () => undefined;
}

function getSpeechRecognitionSupportSnapshot() {
  return Boolean(getSpeechRecognitionConstructor());
}

function getServerSpeechRecognitionSupportSnapshot() {
  return false;
}

function appendTranscript(current: string, transcript: string) {
  const normalized = transcript.trim();
  if (!normalized) return current;
  return [current.trim(), normalized].filter(Boolean).join("\n").slice(0, 1000);
}

export function CalendarCareNoteInput({
  value,
  onChange,
  onSubmit,
  submitLabel,
  submitting,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  submitLabel: "AI 초안 만들기" | "다시 작성";
  submitting?: boolean;
  disabled?: boolean;
}) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const valueRef = useRef(value);
  const speechBaseValueRef = useRef(value);
  const speechSupported = useSyncExternalStore(
    subscribeSpeechRecognitionSupport,
    getSpeechRecognitionSupportSnapshot,
    getServerSpeechRecognitionSupportSnapshot,
  );
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [speechError, setSpeechError] = useState("");
  const [textareaInputModality, setTextareaInputModality] = useState<"keyboard" | "pointer">("keyboard");
  const [textareaFocused, setTextareaFocused] = useState(false);

  useEffect(() => {
    return () => recognitionRef.current?.stop();
  }, []);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  function stopListening() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
    setInterimText("");
  }

  function startListening() {
    if (disabled || listening) return;
    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition) {
      setSpeechError("이 브라우저에서는 음성 입력을 지원하지 않습니다. 직접 입력해 주세요.");
      return;
    }

    setSpeechError("");
    speechBaseValueRef.current = valueRef.current;
    const recognition = new Recognition();
    recognition.lang = "ko-KR";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let finalized = "";
      let interim = "";
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (!result?.[0]?.transcript) continue;
        if (result.isFinal) finalized += `${result[0].transcript} `;
        else interim += `${result[0].transcript} `;
      }
      const spokenText = [finalized.trim(), interim.trim()].filter(Boolean).join(" ");
      if (spokenText) {
        const nextValue = appendTranscript(speechBaseValueRef.current, spokenText);
        valueRef.current = nextValue;
        onChange(nextValue);
      }
      setInterimText(interim.trim());
    };
    recognition.onerror = () => {
      setSpeechError("음성을 듣지 못했습니다. 다시 누르거나 직접 입력해 주세요.");
      setListening(false);
      setInterimText("");
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
      setInterimText("");
    };
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  function markKeyboardTextareaFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Tab") setTextareaInputModality("keyboard");
  }

  function resetTextareaFocusAfterLeave(event: FocusEvent<HTMLDivElement>) {
    const scope = event.currentTarget;
    queueMicrotask(() => {
      if (!scope.contains(document.activeElement)) setTextareaInputModality("keyboard");
    });
  }

  const textareaFocusStyle = textareaFocused && textareaInputModality === "keyboard"
    ? { outline: "2px solid #2563eb", outlineOffset: 2 }
    : undefined;

  return (
    <div
      data-textarea-input-modality={textareaInputModality}
      onPointerDownCapture={() => setTextareaInputModality("pointer")}
      onMouseDownCapture={() => setTextareaInputModality("pointer")}
      onKeyDownCapture={markKeyboardTextareaFocus}
      onBlurCapture={resetTextareaFocusAfterLeave}
      data-care-note-composer
      className="relative overflow-visible rounded-[14px] border border-[#d7dde4] bg-white shadow-[0_7px_20px_rgba(20,39,63,0.06)] transition focus-within:border-[#8c99a7] focus-within:shadow-[0_9px_24px_rgba(20,39,63,0.10)]"
    >
      <textarea
        data-care-note-input
        data-modal-wheel-scope="self"
        value={value}
        onChange={(event) => onChange(event.target.value.slice(0, 1000))}
        onFocus={() => setTextareaFocused(true)}
        onBlur={() => setTextareaFocused(false)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
          event.preventDefault();
          if (!submitting) onSubmit();
        }}
        disabled={disabled}
        maxLength={1000}
        placeholder={"오늘 관찰 메모\n예) 목욕은 잘 진행했고, 귀가 조금 예민했어요."}
        className={`${OWNER_TYPOGRAPHY.body} min-h-[88px] max-h-[164px] w-full resize-none overflow-y-auto overscroll-contain border-0 bg-transparent pb-12 pl-4 pr-4 pt-3 text-[#263547] [field-sizing:content] [line-height:1.5] outline-none focus:outline-none focus:ring-0 placeholder:font-normal placeholder:text-[#a1a9b2] disabled:opacity-60`}
        style={textareaFocusStyle}
      />

      {speechError ? (
        <p className={`${OWNER_TYPOGRAPHY.label} mb-2 ml-4 mr-[96px] flex items-center gap-1.5 text-[#a04455] [line-height:1.5]`}><MicOff className="h-4 w-4" /> {speechError}</p>
      ) : null}

      {listening ? <p className="sr-only" aria-live="polite">{interimText || "듣고 있어요"}</p> : null}

      <div data-care-note-actions-visual className="absolute bottom-1.5 right-1.5 flex items-center justify-end gap-1.5">
        <button
          type="button"
          aria-label={listening ? "음성 입력 마치기" : "음성으로 입력하기"}
          title={listening ? "음성 입력 마치기" : "음성으로 입력하기"}
          onClick={listening ? stopListening : startListening}
          disabled={disabled || (!speechSupported && !listening)}
          className="group grid h-11 w-11 place-items-center rounded-full text-[#44566a] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] disabled:cursor-not-allowed disabled:opacity-35"
        >
          <span className={`grid h-8 w-8 place-items-center rounded-full transition ${listening ? "bg-[#e8edf2] text-[#14273f]" : "bg-[#f3f5f7] group-hover:bg-[#e9eef3]"}`}>
            {listening ? <Square className="h-3.5 w-3.5 fill-current" /> : <Mic className="h-4 w-4" />}
          </span>
        </button>
        <button
          type="button"
          aria-label={submitLabel}
          title={submitLabel}
          onClick={onSubmit}
          disabled={disabled || submitting || !value.trim()}
          className="group inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] bg-[#111a30] px-4 text-[16px] font-medium leading-6 text-white transition hover:bg-[#1b2944] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
