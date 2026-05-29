"use client";

import { CheckCircle2, FileCheck2, HelpCircle, Loader2, RefreshCcw, Send } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

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
  "#{반려동물명} 미용이 완료되었습니다.",
  "",
  "미용 후 사진을 함께 보내드립니다.",
  "첨부된 사진을 확인해 주세요.",
  "",
  "문의가 필요하시면 매장으로 연락해 주세요.",
].join("\n");

const emptyTemplateForm: RelayTemplateRegisterInput = {
  templateCode: "",
  templateName: "",
  templateContent: "",
  categoryCode: "",
  templateMessageType: "BA",
  templateEmphasizeType: "NONE",
  templateExtra: "",
  templateAd: "",
  templateTitle: "",
  templateSubtitle: "",
  comment: "",
  requestReview: true,
  templateConfigKey: null,
  templateButtons: [],
};

const photoTemplatePreset: RelayTemplateRegisterInput = {
  templateCode: "grooming_after_photo_notice",
  templateName: "미용 완료 사진 안내",
  templateContent: defaultPhotoTemplateContent,
  categoryCode: "",
  templateMessageType: "BA",
  templateEmphasizeType: "NONE",
  templateExtra: "",
  templateAd: "",
  templateTitle: "",
  templateSubtitle: "",
  comment: "반려동물 미용 완료 후 보호자에게 완료 사진 확인을 안내하는 정보성 알림톡입니다.",
  requestReview: true,
  templateConfigKey: "templateGroomingCompleted",
  templateButtons: [
    {
      buttonType: "WL",
      buttonName: "사진 확인",
      linkMobile: "#{예약 확인 링크}",
      linkPc: "#{예약 확인 링크}",
    },
  ],
};

const relayMappingOptions: Array<{ value: NonNullable<RelayTemplateRegisterInput["templateConfigKey"]>; label: string }> = [
  { value: "templateGroomingCompleted", label: "미용 완료 사진" },
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
    <div className="space-y-2">
      <FieldLabel label={label} help={help} />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-[6px] border border-[#dbe2ea] bg-white px-3 text-[14px] text-[#111827] outline-none focus:border-[#1f6b5b]"
      />
    </div>
  );
}

function FieldLabel({ label, help }: { label: string; help?: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target;
      if (target instanceof Node && rootRef.current?.contains(target)) return;
      setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-flex items-center gap-1.5">
      <span className="text-[14px] font-semibold text-[#52667d]">{label}</span>
      {help ? (
        <>
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[#7c8da3] transition hover:bg-[#f1f5f9] hover:text-[#334155]"
            aria-label={`${label} 도움말`}
            aria-expanded={open}
          >
            <HelpCircle className="h-4 w-4" />
          </button>
          {open ? (
            <div className="absolute left-0 top-7 z-20 w-[280px] rounded-[6px] border border-[#dbe2ea] bg-white px-3 py-2 text-[14px] leading-5 text-[#475569] shadow-[0_12px_28px_rgba(15,23,42,0.14)]">
              {help}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
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
  const [form, setForm] = useState<RelayTemplateRegisterInput>(emptyTemplateForm);
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

  function updateTemplateButton(field: "buttonName" | "linkMobile" | "linkPc", value: string) {
    setForm((prev) => {
      const current = prev.templateButtons?.[0] ?? {
        buttonType: "WL" as const,
        buttonName: "사진 확인",
        linkMobile: "",
        linkPc: "",
      };
      return {
        ...prev,
        templateButtons: [
          {
            ...current,
            [field]: value,
          },
        ],
      };
    });
  }

  function setTemplateButtonEnabled(enabled: boolean) {
    setForm((prev) => ({
      ...prev,
      templateButtons: enabled
        ? [
            prev.templateButtons?.[0] ?? {
              buttonType: "WL",
              buttonName: "사진 확인",
              linkMobile: "#{예약 확인 링크}",
              linkPc: "#{예약 확인 링크}",
            },
          ]
        : [],
    }));
  }

  function buildSubmitPayload(): RelayTemplateRegisterInput {
    const button = form.templateButtons?.[0];
    const templateButtons =
      button?.buttonName.trim() && button.linkMobile.trim()
        ? [
            {
              buttonType: "WL" as const,
              buttonName: button.buttonName.trim(),
              linkMobile: button.linkMobile.trim(),
              linkPc: button.linkPc?.trim() || button.linkMobile.trim(),
            },
          ]
        : [];

    return {
      ...form,
      templateCode: form.templateCode.trim(),
      templateName: form.templateName.trim(),
      templateContent: form.templateContent.trim(),
      categoryCode: form.categoryCode.trim(),
      comment: form.comment?.trim() || null,
      templateConfigKey: form.templateConfigKey || null,
      templateButtons,
    };
  }

  const selectedCategory = useMemo(
    () => categories.find((category) => category.code === form.categoryCode) ?? null,
    [categories, form.categoryCode],
  );
  const canCodeCheck = Boolean(form.templateCode.trim());
  const canRegister = Boolean(
    form.templateCode.trim() &&
      form.templateName.trim() &&
      form.templateContent.trim() &&
      form.categoryCode.trim(),
  );
  const templateButton = form.templateButtons?.[0] ?? null;

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
          body: JSON.stringify(buildSubmitPayload()),
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
          <p className="text-[14px] font-semibold tracking-[0.04em] text-[#52667d]">쏘다 템플릿 등록</p>
          <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.03em] text-[#111827]">
            신규 템플릿 등록
          </h2>
          <p className="mt-3 max-w-[760px] text-[14px] leading-6 text-[#64748b]">
            알림톡으로 보낼 문구를 만들고 쏘다 등록과 카카오 검수 요청을 진행합니다.
            아래에서 이 템플릿을 어떤 알림에 사용할지 선택할 수 있습니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setForm((prev) => ({ ...emptyTemplateForm, categoryCode: prev.categoryCode }))}
            className="h-10 rounded-[6px] border border-[#dbe2ea] bg-white px-4 text-[14px] font-semibold text-[#334155]"
          >
            새 템플릿
          </button>
          <button
            type="button"
            onClick={() => setForm((prev) => ({ ...photoTemplatePreset, categoryCode: prev.categoryCode || photoTemplatePreset.categoryCode }))}
            className="h-10 rounded-[6px] border border-[#dbe2ea] bg-white px-4 text-[14px] font-semibold text-[#334155]"
          >
            완료 사진 예시 불러오기
          </button>
        </div>
      </div>

      <div className="mt-5 rounded-[6px] border border-[#dbe2ea] bg-[#f8fafc] px-4 py-3">
        <p className="text-[14px] font-semibold text-[#111827]">사용 순서</p>
        <ol className="mt-2 grid gap-1 text-[14px] leading-5 text-[#64748b] md:grid-cols-3">
          <li>1. 신규 템플릿 코드와 본문을 입력합니다.</li>
          <li>2. 쏘다 카테고리와 사용할 알림을 선택합니다.</li>
          <li>3. 링크 버튼이 필요하면 버튼 정보를 입력한 뒤 등록합니다.</li>
        </ol>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="space-y-2">
          <FieldLabel label="템플릿 코드" help="쏘다에 등록될 고유 코드입니다. 영문, 숫자, 밑줄, 하이픈만 사용하세요. 이미 사용 중인 코드는 등록할 수 없습니다." />
          <div className="flex gap-2">
            <input
              value={form.templateCode}
              onChange={(event) => update("templateCode", event.target.value)}
              placeholder="grooming_after_photo_notice"
              className="h-10 min-w-0 flex-1 rounded-[6px] border border-[#dbe2ea] bg-white px-3 text-[14px] text-[#111827] outline-none focus:border-[#1f6b5b]"
            />
            <button
              type="button"
              onClick={() => void handleCodeCheck()}
              disabled={!canCodeCheck || checking || submitting}
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-[6px] border border-[#dbe2ea] bg-white px-3 text-[14px] font-semibold text-[#334155] disabled:opacity-60"
            >
              {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />}
              중복 확인
            </button>
          </div>
        </div>
        <AdminTemplateInput
          label="템플릿 이름"
          value={form.templateName}
          onChange={(value) => update("templateName", value)}
          placeholder="생일 축하 안내"
          help="관리자가 구분하기 위한 이름입니다."
        />
        <div className="space-y-2">
          <FieldLabel label="카테고리" help="쏘다에서 내려주는 카카오 템플릿 분류입니다. 본문 목적과 맞지 않으면 검수에서 반려될 수 있습니다." />
          <div className="flex gap-2">
            <select
              value={form.categoryCode}
              onChange={(event) => update("categoryCode", event.target.value)}
              className="h-10 min-w-0 flex-1 rounded-[6px] border border-[#dbe2ea] bg-white px-3 text-[14px] text-[#111827] outline-none focus:border-[#1f6b5b]"
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
        </div>
      </div>

      {selectedCategory ? (
        <div className="mt-3 rounded-[6px] border border-[#dbe2ea] bg-[#f8fafc] px-4 py-3 text-[14px] leading-5 text-[#64748b]">
          <p className="font-semibold text-[#334155]">
            {selectedCategory.groupName ? `${selectedCategory.groupName} / ` : ""}
            {selectedCategory.name} ({selectedCategory.code})
          </p>
          {selectedCategory.inclusion ? <p className="mt-1">포함: {selectedCategory.inclusion}</p> : null}
          {selectedCategory.exclusion ? <p className="mt-1">제외: {selectedCategory.exclusion}</p> : null}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="space-y-2">
          <FieldLabel label="사용할 알림" help="이 템플릿을 펫매니저의 어떤 알림에 사용할지 정합니다. 예를 들어 미용 완료 사진을 선택하면 오너가 미용 후 사진을 보낼 때 이 템플릿이 사용됩니다. 아직 정하지 않았다면 나중에 정하기를 선택하세요." />
          <select
            value={form.templateConfigKey ?? ""}
            onChange={(event) =>
              update(
                "templateConfigKey",
                (event.target.value || null) as RelayTemplateRegisterInput["templateConfigKey"],
              )
            }
            className="h-10 w-full rounded-[6px] border border-[#dbe2ea] bg-white px-3 text-[14px] text-[#111827] outline-none focus:border-[#1f6b5b]"
          >
            <option value="">나중에 정하기</option>
            {relayMappingOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <FieldLabel label="메시지 유형" help="쏘다/카카오 템플릿의 메시지 형식입니다. 일반 안내성 알림톡은 보통 기본형을 사용합니다." />
          <select
            value={form.templateMessageType}
            onChange={(event) => update("templateMessageType", event.target.value as RelayTemplateRegisterInput["templateMessageType"])}
            className="h-10 w-full rounded-[6px] border border-[#dbe2ea] bg-white px-3 text-[14px] text-[#111827] outline-none focus:border-[#1f6b5b]"
          >
            <option value="BA">기본형</option>
            <option value="EX">부가정보형</option>
            <option value="AD">광고추가형</option>
            <option value="MI">복합형</option>
          </select>
        </div>
        <div className="space-y-2">
          <FieldLabel label="강조 유형" help="템플릿에서 특정 영역을 강조하는 방식입니다. 정보성 기본 안내는 선택 안 함이 가장 안전합니다." />
          <select
            value={form.templateEmphasizeType}
            onChange={(event) => update("templateEmphasizeType", event.target.value as RelayTemplateRegisterInput["templateEmphasizeType"])}
            className="h-10 w-full rounded-[6px] border border-[#dbe2ea] bg-white px-3 text-[14px] text-[#111827] outline-none focus:border-[#1f6b5b]"
          >
            <option value="NONE">선택 안 함</option>
            <option value="TEXT">강조 표기형</option>
            <option value="IMAGE">이미지형</option>
            <option value="ITEM_LIST">아이템 리스트형</option>
          </select>
        </div>
      </div>

      <div className="mt-4 block space-y-2">
        <FieldLabel label="템플릿 본문" help="카카오 검수와 실제 발송에 사용될 문구입니다. 홍보, 혜택, 재방문 유도 표현은 피하고 사실 안내 중심으로 작성합니다." />
        <textarea
          value={form.templateContent}
          onChange={(event) => update("templateContent", event.target.value)}
          rows={7}
          placeholder={`[#{매장명}]\n#{보호자명}, 안내드립니다.\n\n등록할 알림톡 본문을 입력해 주세요.`}
          className="w-full rounded-[6px] border border-[#dbe2ea] bg-white px-4 py-3 text-[14px] leading-6 text-[#111827] outline-none focus:border-[#1f6b5b]"
        />
      </div>

      <div className="mt-4 rounded-[6px] border border-[#dbe2ea] bg-[#f8fafc] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FieldLabel label="링크 버튼" help="알림톡 하단에 보이는 버튼입니다. 사진 확인, 예약 확인처럼 보호자가 눌러 확인해야 하는 링크가 있을 때 사용합니다. 웹링크 버튼은 쏘다 기준으로 버튼명, 모바일 링크, PC 링크가 함께 등록됩니다." />
          <label className="inline-flex items-center gap-2 text-[14px] font-semibold text-[#334155]">
            <input
              type="checkbox"
              checked={Boolean(templateButton)}
              onChange={(event) => setTemplateButtonEnabled(event.target.checked)}
              className="h-4 w-4"
            />
            버튼 사용
          </label>
        </div>
        {templateButton ? (
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <AdminTemplateInput
              label="버튼명"
              value={templateButton.buttonName}
              onChange={(value) => updateTemplateButton("buttonName", value)}
              placeholder="사진 확인"
              help="카카오 알림톡 버튼에 노출되는 이름입니다. 짧고 기능이 바로 이해되는 문구가 좋습니다."
            />
            <AdminTemplateInput
              label="모바일 링크"
              value={templateButton.linkMobile}
              onChange={(value) => updateTemplateButton("linkMobile", value)}
              placeholder="#{예약 확인 링크}"
              help="휴대폰에서 버튼을 눌렀을 때 열릴 링크입니다. 펫매니저 변수인 #{예약 확인 링크}를 사용할 수 있습니다."
            />
            <AdminTemplateInput
              label="PC 링크"
              value={templateButton.linkPc ?? ""}
              onChange={(value) => updateTemplateButton("linkPc", value)}
              placeholder="#{예약 확인 링크}"
              help="PC에서 버튼을 눌렀을 때 열릴 링크입니다. 비워두면 모바일 링크와 같은 값으로 등록합니다."
            />
          </div>
        ) : null}
      </div>

      <div className="mt-4 block space-y-2">
        <FieldLabel label="검수 의견" help="쏘다/카카오 검수 담당자에게 이 템플릿이 어떤 상황에서 발송되는지 설명하는 영역입니다." />
        <textarea
          value={form.comment ?? ""}
          onChange={(event) => update("comment", event.target.value)}
          rows={3}
          className="w-full rounded-[6px] border border-[#dbe2ea] bg-white px-4 py-3 text-[14px] leading-6 text-[#111827] outline-none focus:border-[#1f6b5b]"
        />
      </div>

      <label className="mt-4 flex items-center gap-2 text-[14px] font-semibold text-[#334155]">
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
          onClick={() => void handleRegister()}
          disabled={!canRegister || checking || submitting}
          className="inline-flex h-10 items-center gap-2 rounded-[6px] bg-[#1f6b5b] px-4 text-[14px] font-semibold text-white disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          템플릿 등록/검수 요청
        </button>
      </div>

      {message ? (
        <p className="mt-4 flex items-center gap-2 rounded-[6px] border border-[#cfe3dc] bg-white px-4 py-3 text-[14px] text-[#1f6b5b]">
          <CheckCircle2 className="h-4 w-4" />
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-[6px] border border-[#f0d1d1] bg-white px-4 py-3 text-[14px] leading-6 text-[#b54b4b]">
          {error}
        </p>
      ) : null}
      {providerResponse ? (
        <pre className="mt-4 max-h-56 overflow-auto rounded-[6px] border border-[#dbe2ea] bg-[#f8fafc] p-4 text-[14px] leading-5 text-[#334155]">
          {summarizeProviderResponse(providerResponse)}
        </pre>
      ) : null}
    </section>
  );
}
