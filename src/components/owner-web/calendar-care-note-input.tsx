"use client";

import { ArrowUp, Loader2, Mic, MicOff, Sparkles, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { OWNER_TYPOGRAPHY } from "@/components/owner-web/owner-typography";

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

function appendTranscript(current: string, transcript: string) {
  const normalized = transcript.trim();
  if (!normalized) return current;
  return [current.trim(), normalized].filter(Boolean).join("\n").slice(0, 2000);
}

export function CalendarCareNoteInput({
  value,
  onChange,
  onSubmit,
  submitting,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  submitting?: boolean;
  disabled?: boolean;
}) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const valueRef = useRef(value);
  const speechBaseValueRef = useRef(value);
  const [speechSupported] = useState(() => Boolean(getSpeechRecognitionConstructor()));
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [speechError, setSpeechError] = useState("");

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

  return (
    <div className="overflow-hidden rounded-[22px] border border-[#cbdced] bg-white shadow-[0_10px_30px_rgba(44,91,143,0.09)] transition focus-within:border-[#8cb4df] focus-within:shadow-[0_12px_34px_rgba(47,111,214,0.13)]">
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value.slice(0, 2000))}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
          event.preventDefault();
          if (!submitting) onSubmit();
        }}
        disabled={disabled}
        maxLength={2000}
        placeholder="케어 내용을 입력하거나 말해 주세요."
        className={`${OWNER_TYPOGRAPHY.body} min-h-[112px] w-full resize-y border-0 bg-transparent px-5 pb-2 pt-4 text-[#20364f] outline-none placeholder:font-normal placeholder:text-[#a4adb8] disabled:opacity-60`}
      />

      {speechError ? (
        <p className={`${OWNER_TYPOGRAPHY.label} mx-5 mb-2 flex items-center gap-1.5 text-[#a04455]`}><MicOff className="h-4 w-4" /> {speechError}</p>
      ) : null}

      <div className="flex min-h-14 items-center justify-between gap-4 px-4 pb-3 pt-1">
        <div className={`${OWNER_TYPOGRAPHY.meta} flex min-w-0 items-center gap-2 text-[#657b92]`}>
          {listening ? (
            <>
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2f6fd6] opacity-45" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#2f6fd6]" />
              </span>
              <span className="truncate">{interimText || "듣고 있어요"}</span>
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 shrink-0 text-[#3978b5]" />
              <span>AI 케어리포트</span>
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            aria-label={listening ? "음성 입력 마치기" : "음성으로 입력하기"}
            title={listening ? "음성 입력 마치기" : "음성으로 입력하기"}
            onClick={listening ? stopListening : startListening}
            disabled={disabled || (!speechSupported && !listening)}
            className={`grid h-10 w-10 place-items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-35 ${
              listening
                ? "bg-[#e7f0fc] text-[#2f6fd6]"
                : "text-[#44566a] hover:bg-[#f0f4f8]"
            }`}
          >
            {listening ? <Square className="h-4 w-4 fill-current" /> : <Mic className="h-5 w-5" />}
          </button>
          <button
            type="button"
            aria-label="AI에게 정리 맡기기"
            title="AI에게 정리 맡기기"
            onClick={onSubmit}
            disabled={disabled || submitting}
            className="grid h-11 w-11 place-items-center rounded-full bg-[#172c46] text-white shadow-[0_8px_20px_rgba(23,44,70,0.24)] transition hover:bg-[#234b78] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowUp className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
