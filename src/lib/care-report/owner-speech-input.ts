import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

type SpeechResult = { transcript?: string };
type SpeechError = { code?: "CANCELLED" | "EMPTY" | "PERMISSION_DENIED" | "UNAVAILABLE" | "FAILED" };

type OwnerSpeechRecognitionPlugin = {
  start(): Promise<void>;
  stop(): Promise<void>;
  addListener(eventName: "result", listenerFunc: (result: SpeechResult) => void): Promise<PluginListenerHandle>;
  addListener(eventName: "error", listenerFunc: (error: SpeechError) => void): Promise<PluginListenerHandle>;
  addListener(eventName: "end", listenerFunc: () => void): Promise<PluginListenerHandle>;
};

type BrowserRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type BrowserRecognitionConstructor = new () => BrowserRecognition;

export type OwnerSpeechInputErrorCode = SpeechError["code"];

export type OwnerSpeechInputCallbacks = {
  onResult: (transcript: string) => void;
  onError: (code: OwnerSpeechInputErrorCode) => void;
  onEnd: () => void;
};

export type OwnerSpeechInputController = { stop: () => Promise<void> };

const OwnerSpeechRecognition = registerPlugin<OwnerSpeechRecognitionPlugin>("OwnerSpeechRecognition");

function normalizeTranscript(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function getBrowserRecognitionConstructor(): BrowserRecognitionConstructor | null {
  const scope = window as typeof window & {
    SpeechRecognition?: BrowserRecognitionConstructor;
    webkitSpeechRecognition?: BrowserRecognitionConstructor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

function browserErrorCode(error?: string): OwnerSpeechInputErrorCode {
  if (error === "not-allowed" || error === "service-not-allowed") return "PERMISSION_DENIED";
  if (error === "no-speech") return "EMPTY";
  if (error === "aborted") return "CANCELLED";
  return "FAILED";
}

async function startAndroidSpeechInput(callbacks: OwnerSpeechInputCallbacks): Promise<OwnerSpeechInputController> {
  let ended = false;
  let handles: PluginListenerHandle[] = [];
  const finish = () => {
    if (ended) return;
    ended = true;
    void Promise.all(handles.map((handle) => handle.remove()));
    callbacks.onEnd();
  };
  handles = await Promise.all([
    OwnerSpeechRecognition.addListener("result", ({ transcript }) => {
      const value = normalizeTranscript(transcript ?? "");
      if (value) callbacks.onResult(value);
    }),
    OwnerSpeechRecognition.addListener("error", ({ code }) => {
      if (!ended) callbacks.onError(code ?? "FAILED");
    }),
    OwnerSpeechRecognition.addListener("end", finish),
  ]);
  try {
    await OwnerSpeechRecognition.start();
  } catch (error) {
    const code = error instanceof Error && /PERMISSION_DENIED|UNAVAILABLE/.test(error.message)
      ? (error.message as OwnerSpeechInputErrorCode)
      : "FAILED";
    callbacks.onError(code);
    finish();
    throw error;
  }
  return {
    stop: async () => {
      if (ended) return;
      try {
        await OwnerSpeechRecognition.stop();
      } finally {
        finish();
      }
    },
  };
}

function startBrowserSpeechInput(callbacks: OwnerSpeechInputCallbacks): OwnerSpeechInputController {
  const Recognition = getBrowserRecognitionConstructor();
  if (!Recognition) {
    callbacks.onError("UNAVAILABLE");
    callbacks.onEnd();
    throw new Error("UNAVAILABLE");
  }
  const recognition = new Recognition();
  let ended = false;
  const finish = () => {
    if (ended) return;
    ended = true;
    callbacks.onEnd();
  };
  recognition.lang = "ko-KR";
  recognition.interimResults = false;
  recognition.continuous = false;
  recognition.onresult = (event) => {
    const transcript = normalizeTranscript(Array.from(event.results).map((result) => result[0]?.transcript ?? "").join(""));
    if (transcript) callbacks.onResult(transcript);
    else callbacks.onError("EMPTY");
  };
  recognition.onerror = (event) => callbacks.onError(browserErrorCode(event.error));
  recognition.onend = finish;
  recognition.start();
  return {
    stop: async () => {
      if (ended) return;
      recognition.stop();
      finish();
    },
  };
}

export async function startOwnerCareReportSpeechInput(callbacks: OwnerSpeechInputCallbacks): Promise<OwnerSpeechInputController> {
  if (Capacitor.getPlatform() === "android") return startAndroidSpeechInput(callbacks);
  return startBrowserSpeechInput(callbacks);
}
