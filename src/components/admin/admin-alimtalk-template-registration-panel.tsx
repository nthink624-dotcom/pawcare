"use client";

import { CheckCircle2, FileCheck2, Loader2, RefreshCcw, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { fetchApiJson } from "@/lib/api";
import type {
  RelayTemplateCategory,
  RelayTemplateCategoryListResponse,
  RelayTemplateCodeCheckResponse,
  RelayTemplateRegisterInput,
  RelayTemplateRegisterResponse,
} from "@/server/admin-alimtalk";

const defaultPhotoTemplateContent = [
  "[#{매장명}]",
  "#{반려동물명} 미용 전후 사진을 보내드려요.",
  "",
  "사진은 개인정보 보호를 위해 일정 기간 후 자동 보관 정책에 따라 정리될 수 있습니다.",
  "궁금한 점이 있으면 매장으로 문의해 주세요.",
].join("\n");

const initialForm: RelayTemplateRegisterInput = {
  templateCode: "grooming_completed_photo",
  templateName: "미용 전후 사진 안내",
  templateContent: defaultPhotoTemplateContent,
  categoryCode: "",
  templateMessageType: "BA",
  templateEmphasizeType: "NONE",
  templateExtra: "",
  templateAd: "",
  templateTitle: "",
  templateSubtitle: "",
  comment: "반려동물 미용 완료 후 보호자에게 전후 사진 확인을 안내하는 비광고성 알림톡입니다.",
  requestReview: true,
  templateConfigKey: "templateGroomingCompleted",
};

const relayMappingOptions: Array<{ value: NonNullable<RelayTemplateRegisterInput["templateConfigKey"]>; label: string }> = [
  { value: "templateGroomingCompleted", label: "미용 완료/전후 사진" },
  { value: "templateGroomingStarted", label: "미용 시작" },
  { value: "templateGroomingAlmostDone", label: "픽업 준비" },
  { value: "templateBookingConfirmed", label: "예약 확정" },
  { value: "templateBookingCancelled", label: "예약 취소" },
  { value: "templateRevisitNotice", label: "재방문 안내" },
];

function AdminTemplateInput({
  label,
  value,
  onChange,
  placeholder,
  help,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  help?: string;
}) {
  return (
    <label className="space-y-2">
      <span className="text-[12px] font-semibold text-[#52667d]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-[6px] border border-[#dbe2ea] bg-white px-3 text-[13px] text-[#111827] outline-none focus:border-[#1f6b5b]"
      />
      {help ? <span className="block text-[11px] leading-4 text-[#7c8da3]">{help}</span> : null}
    </label>
  );
}

function summarizeProviderResponse(value: unknown) {
  try {
    return JSON.stringify(value, null, 2).slice(0, 1000);
  } catch {
    return String(value);
  }
}

export default function AdminAlimtalkTemplateRegistrationPanel({
  onRegistered,
}: {
  onRegistered?: () => void;
}) {
  const [form, setForm] = useState<RelayTemplateRegisterInput>(initialForm);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [categories, setCategories] = useState<RelayTemplateCategory[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [providerResponse, setProviderResponse] = useState<unknown>(null);

  function update<K extends keyof RelayTemplateRegisterInput>(key: K, value: RelayTemplateRegisterInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const selectedCategory = useMemo(
    () => categories.find((category) => category.code === form.categoryCode) ?? null,
    [categories, form.categoryCode],
  );

  async function loadCategories() {
    setLoadingCategories(true);
    setError(null);
    try {
      const result = await fetchApiJson<RelayTemplateCategoryListResponse>(
        "/api/admin/alimtalk/relay/templates/categories",
        { cache: "no-store" },
      );
      setCategories(result.categories);
      if (!form.categoryCode && result.categories[0]) {
        setForm((prev) => ({ ...prev, categoryCode: result.categories[0].code }));
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "템플릿 카테고리를 불러오지 못했습니다.");
    } finally {
      setLoadingCategories(false);
    }
  }

  useEffect(() => {
    void loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCodeCheck() {
    setChecking(true);
    setError(null);
    setMessage(null);
    setProviderResponse(null);
    try {
      const result = await fetchApiJson<RelayTemplateCodeCheckResponse>(
        "/api/admin/alimtalk/relay/templates/code-check",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateCode: form.templateCode }),
        },
      );
      setProviderResponse(result.providerResponse);
      setMessage("쏘다에 템플릿 코드 사용 가능 여부를 확인했습니다.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "템플릿 코드 검증에 실패했습니다.");
    } finally {
      setChecking(false);
    }
  }

  async function handleRegister() {
    setSubmitting(true);
    setError(null);
    setMessage(null);
    setProviderResponse(null);
    try {
      const result = await fetchApiJson<RelayTemplateRegisterResponse>(
        "/api/admin/alimtalk/relay/templates/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        },
      );
      setProviderResponse(result.providerResponse);
      setMessage(
        result.reviewRequested
          ? "템플릿 등록과 검수 요청을 쏘다로 보냈습니다. 카카오 승인 완료 후 실제 발송에 사용할 수 있습니다."
          : "템플릿을 등록했습니다. 검수 요청은 아직 보내지 않았습니다.",
      );
      onRegistered?.();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "템플릿 등록에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-[8px] border border-[#dbe2ea] bg-white p-6 shadow-[0_6px_16px_rgba(15,23,42,0.025)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold tracking-[0.04em] text-[#52667d]">쏘다 템플릿 등록</p>
          <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.03em] text-[#111827]">
            전후 사진 알림톡 템플릿 만들기
          </h2>
          <p className="mt-3 max-w-[760px] text-[13px] leading-6 text-[#64748b]">
            여기서 작성한 내용은 쏘다 템플릿 등록 API로 전송되고, 검수 요청을 켜두면 바로 카카오 검수 단계로 넘어갑니다.
            승인 전에는 실제 고객 발송에 사용하면 안 되고, 승인 완료 후 릴레이 매핑된 코드로 발송됩니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setForm(initialForm)}
          className="h-10 rounded-[6px] border border-[#dbe2ea] bg-white px-4 text-[13px] font-semibold text-[#334155]"
        >
          전후 사진 기본값
        </button>
      </div>

      <div className="mt-5 rounded-[6px] border border-[#dbe2ea] bg-[#f8fafc] px-4 py-3">
        <p className="text-[13px] font-semibold text-[#111827]">사용 순서</p>
        <ol className="mt-2 grid gap-1 text-[12px] leading-5 text-[#64748b] md:grid-cols-3">
          <li>1. 템플릿 코드와 본문을 확인합니다.</li>
          <li>2. 카테고리를 선택하고 코드 검증을 누릅니다.</li>
          <li>3. 등록 후 릴레이 매핑을 확인한 뒤 템플릿 등록을 누릅니다.</li>
        </ol>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <AdminTemplateInput
          label="템플릿 코드"
          value={form.templateCode}
          onChange={(value) => update("templateCode", value)}
          placeholder="grooming_completed_photo"
          help="쏘다에 등록될 고유 코드입니다. 영문, 숫자, 밑줄, 하이픈만 사용하세요."
        />
        <AdminTemplateInput
          label="템플릿 이름"
          value={form.templateName}
          onChange={(value) => update("templateName", value)}
          placeholder="미용 전후 사진 안내"
          help="관리자가 구분하기 위한 이름입니다."
        />
        <label className="space-y-2">
          <span className="text-[12px] font-semibold text-[#52667d]">카테고리</span>
          <div className="flex gap-2">
            <select
              value={form.categoryCode}
              onChange={(event) => update("categoryCode", event.target.value)}
              className="h-10 min-w-0 flex-1 rounded-[6px] border border-[#dbe2ea] bg-white px-3 text-[13px] text-[#111827] outline-none focus:border-[#1f6b5b]"
            >
              {categories.length ? (
                categories.map((category) => (
                  <option key={category.code} value={category.code}>
                    {category.groupName ? `[${category.groupName}] ` : ""}
                    {category.name} · {category.code}
                  </option>
                ))
              ) : (
                <option value={form.categoryCode}>{form.categoryCode || "카테고리 조회 필요"}</option>
              )}
            </select>
            <button
              type="button"
              onClick={() => void loadCategories()}
              disabled={loadingCategories}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[6px] border border-[#dbe2ea] bg-white text-[#334155] disabled:opacity-60"
              aria-label="카테고리 새로고침"
            >
              <RefreshCcw className={`h-4 w-4 ${loadingCategories ? "animate-spin" : ""}`} />
            </button>
          </div>
          <span className="block text-[11px] leading-4 text-[#7c8da3]">
            쏘다에서 내려주는 카카오 템플릿 카테고리입니다.
          </span>
        </label>
      </div>

      {selectedCategory ? (
        <div className="mt-3 rounded-[6px] border border-[#dbe2ea] bg-[#f8fafc] px-4 py-3 text-[12px] leading-5 text-[#64748b]">
          <p className="font-semibold text-[#334155]">
            {selectedCategory.groupName ? `${selectedCategory.groupName} / ` : ""}
            {selectedCategory.name} ({selectedCategory.code})
          </p>
          {selectedCategory.inclusion ? <p className="mt-1">포함: {selectedCategory.inclusion}</p> : null}
          {selectedCategory.exclusion ? <p className="mt-1">제외: {selectedCategory.exclusion}</p> : null}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <label className="space-y-2">
          <span className="text-[12px] font-semibold text-[#52667d]">등록 후 릴레이 매핑</span>
          <select
            value={form.templateConfigKey ?? ""}
            onChange={(event) =>
              update(
                "templateConfigKey",
                (event.target.value || null) as RelayTemplateRegisterInput["templateConfigKey"],
              )
            }
            className="h-10 w-full rounded-[6px] border border-[#dbe2ea] bg-white px-3 text-[13px] text-[#111827] outline-none focus:border-[#1f6b5b]"
          >
            <option value="">매핑하지 않음</option>
            {relayMappingOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="block text-[11px] leading-4 text-[#7c8da3]">
            전후 사진은 기본적으로 미용 완료/전후 사진에 연결합니다.
          </span>
        </label>
        <label className="space-y-2">
          <span className="text-[12px] font-semibold text-[#52667d]">메시지 유형</span>
          <select
            value={form.templateMessageType}
            onChange={(event) => update("templateMessageType", event.target.value as RelayTemplateRegisterInput["templateMessageType"])}
            className="h-10 w-full rounded-[6px] border border-[#dbe2ea] bg-white px-3 text-[13px] text-[#111827] outline-none focus:border-[#1f6b5b]"
          >
            <option value="BA">기본형</option>
            <option value="EX">부가정보형</option>
            <option value="AD">광고추가형</option>
            <option value="MI">복합형</option>
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-[12px] font-semibold text-[#52667d]">강조 유형</span>
          <select
            value={form.templateEmphasizeType}
            onChange={(event) => update("templateEmphasizeType", event.target.value as RelayTemplateRegisterInput["templateEmphasizeType"])}
            className="h-10 w-full rounded-[6px] border border-[#dbe2ea] bg-white px-3 text-[13px] text-[#111827] outline-none focus:border-[#1f6b5b]"
          >
            <option value="NONE">선택 안 함</option>
            <option value="TEXT">강조 표기형</option>
            <option value="IMAGE">이미지형</option>
            <option value="ITEM_LIST">아이템 리스트형</option>
          </select>
        </label>
      </div>

      <label className="mt-4 block space-y-2">
        <span className="text-[12px] font-semibold text-[#52667d]">템플릿 본문</span>
        <textarea
          value={form.templateContent}
          onChange={(event) => update("templateContent", event.target.value)}
          rows={7}
          className="w-full rounded-[6px] border border-[#dbe2ea] bg-white px-4 py-3 text-[13px] leading-6 text-[#111827] outline-none focus:border-[#1f6b5b]"
        />
        <span className="block text-[11px] leading-4 text-[#7c8da3]">
          승인 후 실제 발송 문구와 템플릿 본문이 달라지면 공급자에서 거절될 수 있습니다.
        </span>
      </label>

      <label className="mt-4 block space-y-2">
        <span className="text-[12px] font-semibold text-[#52667d]">검수 의견</span>
        <textarea
          value={form.comment ?? ""}
          onChange={(event) => update("comment", event.target.value)}
          rows={3}
          className="w-full rounded-[6px] border border-[#dbe2ea] bg-white px-4 py-3 text-[13px] leading-6 text-[#111827] outline-none focus:border-[#1f6b5b]"
        />
      </label>

      <label className="mt-4 flex items-center gap-2 text-[13px] font-semibold text-[#334155]">
        <input
          type="checkbox"
          checked={form.requestReview}
          onChange={(event) => update("requestReview", event.target.checked)}
          className="h-4 w-4"
        />
        등록 후 바로 검수 요청
      </label>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void handleCodeCheck()}
          disabled={checking || submitting}
          className="inline-flex h-10 items-center gap-2 rounded-[6px] border border-[#dbe2ea] bg-white px-4 text-[13px] font-semibold text-[#334155] disabled:opacity-60"
        >
          {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />}
          코드 검증
        </button>
        <button
          type="button"
          onClick={() => void handleRegister()}
          disabled={checking || submitting}
          className="inline-flex h-10 items-center gap-2 rounded-[6px] bg-[#1f6b5b] px-4 text-[13px] font-semibold text-white disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          템플릿 등록/검수 요청
        </button>
      </div>

      {message ? (
        <p className="mt-4 flex items-center gap-2 rounded-[6px] border border-[#cfe3dc] bg-white px-4 py-3 text-[13px] text-[#1f6b5b]">
          <CheckCircle2 className="h-4 w-4" />
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-[6px] border border-[#f0d1d1] bg-white px-4 py-3 text-[13px] leading-6 text-[#b54b4b]">
          {error}
        </p>
      ) : null}
      {providerResponse ? (
        <pre className="mt-4 max-h-56 overflow-auto rounded-[6px] border border-[#dbe2ea] bg-[#f8fafc] p-4 text-[12px] leading-5 text-[#334155]">
          {summarizeProviderResponse(providerResponse)}
        </pre>
      ) : null}
    </section>
  );
}
