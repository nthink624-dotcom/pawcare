"use client";

import { Bug, CheckCircle2, Clipboard, Lightbulb, Mail, MessageSquareText, Send, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { WebSurface } from "@/components/owner-web/owner-web-ui";
import { fetchApiJsonWithAuth } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { BootstrapPayload } from "@/types/domain";

type HelpRequestType = "bug" | "improvement" | "question";

const requestTypes: Array<{
  key: HelpRequestType;
  label: string;
  icon: typeof Bug;
}> = [
  { key: "bug", label: "기능 오류", icon: Bug },
  { key: "improvement", label: "개선 요청", icon: Lightbulb },
  { key: "question", label: "사용 문의", icon: MessageSquareText },
];

const faqItems = [
  {
    question: "예약 시간이 노출되지 않아요.",
    answer: "예약 가능 시간은 영업시간, 휴무, 예약 금지 시간, 직원 근무, 이미 잡힌 예약을 모두 반영해서 계산됩니다.",
  },
  {
    question: "알림톡이 안 가요.",
    answer: "알림톡 설정, 고객 수신 설정, 템플릿 연결, 매장 잔여 건수, 쏘다 릴레이 상태를 순서대로 확인해 주세요.",
  },
  {
    question: "고객 예약페이지 사진이 안 보여요.",
    answer: "매장 정보의 고객 예약페이지 사진은 R2에 저장된 매장 이미지 기준으로 불러옵니다. 저장 후 새로고침해도 안 보이면 문의해 주세요.",
  },
  {
    question: "서비스 가격이 이상하게 보여요.",
    answer: "고객에게 보이는 가격은 서비스/가격의 상세 요금표 원본을 기준으로 표시됩니다. 혜택이나 노출 설정에서는 가격 원본을 따로 만들지 않습니다.",
  },
  {
    question: "직원별 예약 색상이 달라 보여요.",
    answer: "예약 카드와 직원 관련 화면은 저장된 직원 개인 색상을 기준으로 맞춰야 합니다. 다르게 보이면 화면 위치를 함께 알려주세요.",
  },
];

const convenienceIdeas = [
  "문의 보낼 때 현재 매장, 화면, 브라우저 정보를 자동으로 함께 붙이기",
  "오너가 자주 쓰는 예약 링크와 고객 예약페이지를 한 곳에서 바로 복사하기",
  "알림톡 실패 로그에서 바로 템플릿 비교 화면으로 이동하기",
  "고객/예약/알림톡 주요 오류를 매일 한 번 자동 점검하기",
  "새 기능 요청을 상태별로 모아보고 처리 여부를 확인하기",
];

function buildStorageKey(shopId: string) {
  return `petmanager.ownerHelpDraft.${shopId}`;
}

function readSavedHelpDraft(storageKey: string) {
  if (typeof window === "undefined") return null;

  const saved = window.localStorage.getItem(storageKey);
  if (!saved) return null;

  try {
    const parsed = JSON.parse(saved) as Partial<{
      requestType: HelpRequestType;
      message: string;
      contact: string;
    }>;

    return {
      requestType:
        parsed.requestType === "bug" || parsed.requestType === "improvement" || parsed.requestType === "question"
          ? parsed.requestType
          : null,
      message: typeof parsed.message === "string" ? parsed.message : null,
      contact: typeof parsed.contact === "string" ? parsed.contact : null,
    };
  } catch {
    window.localStorage.removeItem(storageKey);
    return null;
  }
}

function buildSystemContext(shop: BootstrapPayload["shop"], requestType: HelpRequestType) {
  const lines = [
    `요청 구분: ${requestTypes.find((item) => item.key === requestType)?.label ?? requestType}`,
    `매장명: ${shop.name || "-"}`,
    `매장 ID: ${shop.id}`,
    typeof window !== "undefined" ? `현재 주소: ${window.location.href}` : null,
    typeof window !== "undefined" ? `브라우저: ${window.navigator.userAgent}` : null,
    `작성 시각: ${new Date().toLocaleString("ko-KR")}`,
  ];

  return lines.filter(Boolean).join("\n");
}

export default function OwnerHelpScreen({ initialData }: { initialData: BootstrapPayload }) {
  const shop = initialData.shop;
  const storageKey = useMemo(() => buildStorageKey(shop.id), [shop.id]);
  const savedDraft = useMemo(() => readSavedHelpDraft(storageKey), [storageKey]);
  const [requestType, setRequestType] = useState<HelpRequestType>(() => savedDraft?.requestType ?? "bug");
  const [message, setMessage] = useState(() => savedDraft?.message ?? "");
  const [contact, setContact] = useState(() => savedDraft?.contact ?? shop.phone ?? "");
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [openedFaq, setOpenedFaq] = useState<string | null>(faqItems[0]?.question ?? null);
  const systemContext = useMemo(() => buildSystemContext(shop, requestType), [requestType, shop]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        requestType,
        message,
        contact,
      }),
    );
  }, [contact, message, requestType, storageKey]);

  const requestBody = useMemo(() => {
    return [`문의 내용`, message.trim() || "(내용을 입력해 주세요)", "", `연락처`, contact.trim() || "-", "", `시스템 정보`, systemContext].join(
      "\n",
    );
  }, [contact, message, systemContext]);

  async function copyRequest() {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    await navigator.clipboard.writeText(requestBody);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function submitRequest() {
    if (submitting) return;
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      setSubmitError("문의 내용을 입력해 주세요.");
      setSubmitMessage("");
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    setSubmitMessage("");
    try {
      await fetchApiJsonWithAuth<{ request: { id: string } }>("/api/owner/support-requests", {
        method: "POST",
        body: JSON.stringify({
          shopId: shop.id,
          requestType,
          contact,
          message: trimmedMessage,
          context: {
            shopName: shop.name,
            shopId: shop.id,
            currentUrl: typeof window !== "undefined" ? window.location.href : "",
            userAgent: typeof window !== "undefined" ? window.navigator.userAgent : "",
            createdAt: new Date().toISOString(),
          },
        }),
      });
      setSubmitMessage("접수되었습니다. 운영자가 관리자 페이지에서 확인할 수 있습니다.");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "문의를 접수하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto pr-1">
      <WebSurface className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[13px] font-semibold text-[#316fe8]">도움말</p>
            <h1 className="mt-1 text-[24px] font-semibold tracking-[-0.02em] text-[#111827]">문의와 개선 요청</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={copyRequest}
              className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-[#dbe2ea] bg-white px-3.5 text-[14px] font-semibold text-[#334155] transition hover:bg-[#f8fafc]"
            >
              {copied ? <CheckCircle2 className="h-4 w-4 text-[#2f7866]" /> : <Clipboard className="h-4 w-4" />}
              {copied ? "복사됨" : "내용 복사"}
            </button>
            <button
              type="button"
              onClick={() => void submitRequest()}
              disabled={submitting}
              className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-[#316fe8] px-3.5 text-[14px] font-semibold text-white transition hover:bg-[#245bd0] disabled:bg-[#94a3b8]"
            >
              <Mail className="h-4 w-4" />
              {submitting ? "접수 중" : "접수하기"}
            </button>
          </div>
        </div>
      </WebSurface>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <WebSurface className="p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            {requestTypes.map((item) => {
              const Icon = item.icon;
              const active = requestType === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setRequestType(item.key)}
                  className={cn(
                    "flex h-12 items-center justify-center gap-2 rounded-[10px] border text-[15px] font-semibold transition",
                    active
                      ? "border-[#316fe8] bg-[#edf4ff] text-[#245bd0]"
                      : "border-[#dbe2ea] bg-white text-[#334155] hover:bg-[#f8fafc]",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid gap-3">
            <label className="grid gap-1.5">
              <span className="text-[14px] font-semibold text-[#334155]">연락 받을 번호 또는 메일</span>
              <input
                value={contact}
                onChange={(event) => setContact(event.target.value)}
                className="h-11 rounded-[10px] border border-[#dbe2ea] bg-white px-3 text-[15px] font-medium text-[#111827] outline-none transition focus:border-[#316fe8] focus:ring-2 focus:ring-[#dce8ff]"
                placeholder="연락처를 입력해 주세요"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-[14px] font-semibold text-[#334155]">내용</span>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                className="min-h-[220px] resize-y rounded-[10px] border border-[#dbe2ea] bg-white px-3 py-3 text-[15px] font-medium leading-6 text-[#111827] outline-none transition focus:border-[#316fe8] focus:ring-2 focus:ring-[#dce8ff]"
                placeholder="어느 화면에서 어떤 문제가 있었는지 적어주세요."
              />
            </label>
            {submitMessage ? (
              <p className="rounded-[10px] border border-[#cfe4dc] bg-[#f8fdfb] px-3 py-2 text-[14px] font-semibold text-[#1f6b5b]">
                {submitMessage}
              </p>
            ) : null}
            {submitError ? (
              <p className="rounded-[10px] border border-[#efcaca] bg-[#fff7f7] px-3 py-2 text-[14px] font-semibold text-[#b42318]">
                {submitError}
              </p>
            ) : null}
            <div className="rounded-[10px] border border-[#e5eaf0] bg-[#f8fafc] p-3">
              <p className="mb-2 text-[13px] font-semibold text-[#64748b]">함께 첨부되는 정보</p>
              <pre className="whitespace-pre-wrap break-words text-[13px] leading-5 text-[#334155]">{systemContext}</pre>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setMessage("");
                  setCopied(false);
                  setSubmitError("");
                  setSubmitMessage("");
                }}
                className="inline-flex h-10 items-center rounded-[10px] border border-[#dbe2ea] bg-white px-4 text-[14px] font-semibold text-[#334155] transition hover:bg-[#f8fafc]"
              >
                비우기
              </button>
              <button
                type="button"
                onClick={() => void submitRequest()}
                disabled={submitting}
                className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-[#316fe8] px-4 text-[14px] font-semibold text-white transition hover:bg-[#245bd0] disabled:bg-[#94a3b8]"
              >
                <Send className="h-4 w-4" />
                {submitting ? "접수 중" : "접수하기"}
              </button>
            </div>
          </div>
        </WebSurface>

        <div className="grid gap-4">
          <WebSurface className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#316fe8]" />
              <h2 className="text-[18px] font-semibold text-[#111827]">오너 편의 추천</h2>
            </div>
            <div className="grid gap-2">
              {convenienceIdeas.map((idea) => (
                <div key={idea} className="rounded-[10px] border border-[#e5eaf0] bg-[#fbfcfd] px-3 py-2.5 text-[14px] font-medium leading-5 text-[#334155]">
                  {idea}
                </div>
              ))}
            </div>
          </WebSurface>

          <WebSurface className="p-5">
            <h2 className="mb-3 text-[18px] font-semibold text-[#111827]">자주 묻는 질문</h2>
            <div className="divide-y divide-[#e5eaf0] rounded-[10px] border border-[#e5eaf0]">
              {faqItems.map((item) => {
                const open = openedFaq === item.question;
                return (
                  <div key={item.question}>
                    <button
                      type="button"
                      onClick={() => setOpenedFaq(open ? null : item.question)}
                      className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left text-[15px] font-semibold text-[#111827]"
                    >
                      <span>{item.question}</span>
                      <span className="text-[13px] font-bold text-[#64748b]">{open ? "닫기" : "보기"}</span>
                    </button>
                    {open ? <p className="px-3.5 pb-3 text-[14px] font-medium leading-6 text-[#64748b]">{item.answer}</p> : null}
                  </div>
                );
              })}
            </div>
          </WebSurface>
        </div>
      </div>
    </div>
  );
}
