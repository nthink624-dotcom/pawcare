"use client";

import { ChevronDown, RefreshCcw } from "lucide-react";
import { useState } from "react";

import type { AlimtalkTemplateAlias } from "@/lib/notification-registry";
import type { AppTemplateDraft, RelaySsodaaTemplateDetail, RelaySsodaaTemplateItem } from "@/server/admin-alimtalk";

type TemplateButton = {
  type?: string | null;
  name: string | null;
  link?: string | null;
  linkMobile?: string | null;
  linkPc?: string | null;
};

const ssodaaStatusLabels: Record<string, string> = {
  REG: "등록",
  REQ: "검수 요청",
  REJ: "반려",
  STP: "차단",
  RDY: "발송 가능",
  ACT: "사용 중",
  DMT: "휴면",
  BLK: "차단",
};

const aliasTemplateKeywords: Record<AlimtalkTemplateAlias, string[]> = {
  booking_received: ["예약 접수"],
  booking_confirmed: ["예약 확정", "펫매니저 예약 확정"],
  booking_rejected: ["예약 거절", "예약 일정 변경"],
  booking_cancelled: ["예약 취소"],
  booking_time_proposed: ["다른 시간", "예약 시간 변경", "예약 일정 변경"],
  booking_rescheduled_confirmed: ["예약 변경 확정"],
  appointment_reminder_10m: ["방문 전"],
  grooming_started: ["미용 시작"],
  grooming_almost_done: ["픽업 준비"],
  grooming_completed: ["미용 완료"],
  revisit_notice: ["재방문"],
  birthday_greeting: ["생일"],
};

function formatSsodaaStatus(value: string | null | undefined) {
  if (!value) return "-";
  return ssodaaStatusLabels[value] ? `${ssodaaStatusLabels[value]} (${value})` : value;
}

function normalizeTemplateBody(value: string | null | undefined) {
  return (value ?? "").replace(/\r\n/g, "\n").trim();
}

function normalizeButtonName(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeButtons(buttons: TemplateButton[]) {
  return buttons.map((button) => `${normalizeButtonName(button.name)}|${button.type ?? "WL"}`).join("\n");
}

function getStatusTone(isOk: boolean) {
  return isOk ? "border-[#cfe3dc] bg-[#f5fbf8] text-[#1f6b5b]" : "border-[#f0d1d1] bg-[#fff7f7] text-[#b54b4b]";
}

function getCodeTone(hasCode: boolean) {
  return hasCode ? "border-[#cfe3dc] bg-[#f5fbf8] text-[#1f6b5b]" : "border-[#ead7b7] bg-[#fffaf0] text-[#8a5b11]";
}

function getBodyTone({ hasCode, bodyMatches }: { hasCode: boolean; bodyMatches: boolean }) {
  if (!hasCode) return "border-[#ead7b7] bg-[#fffaf0] text-[#8a5b11]";
  return getStatusTone(bodyMatches);
}

function getAppButtons(alias: AlimtalkTemplateAlias): TemplateButton[] {
  switch (alias) {
    case "booking_confirmed":
      return [
        { type: "WL", name: "예약 확인", link: "#{예약관리링크}" },
        { type: "WL", name: "길찾기", link: "#{길찾기링크}" },
      ];
    case "appointment_reminder_10m":
      return [
        { type: "WL", name: "길찾기", link: "#{길찾기링크}" },
        { type: "WL", name: "예약확인", link: "#{예약관리링크}" },
      ];
    case "booking_rescheduled_confirmed":
      return [
        { type: "WL", name: "예약 확인", link: "#{예약관리링크}" },
        { type: "WL", name: "예약 다시 변경", link: "#{예약시간변경링크}" },
      ];
    case "booking_rejected":
      return [{ type: "WL", name: "예약 변경", link: "#{예약시간변경링크}" }];
    case "booking_cancelled":
      return [];
    case "booking_time_proposed":
      return [{ type: "WL", name: "예약 시간 변경", link: "#{예약시간변경링크}" }];
    case "grooming_completed":
      return [{ type: "WL", name: "사진 확인", link: "#{예약관리링크}" }];
    default:
      return [];
  }
}

function getTemplateCandidates({
  alias,
  connectedCode,
  allTemplates,
}: {
  alias: AlimtalkTemplateAlias;
  connectedCode: string | null | undefined;
  allTemplates: RelaySsodaaTemplateDetail[];
}) {
  const keywords = aliasTemplateKeywords[alias] ?? [];
  const connectedCodeValue = connectedCode?.trim();
  const candidates = allTemplates.filter((template) => {
    const templateName = template.templateName ?? "";
    const templateCode = template.templateCode ?? "";
    if (connectedCodeValue && templateCode === connectedCodeValue) return true;
    return keywords.some((keyword) => templateName.includes(keyword) || templateCode.toLowerCase().includes(keyword.toLowerCase()));
  });

  return candidates.sort((a, b) => {
    const aConnected = connectedCodeValue && a.templateCode === connectedCodeValue ? 0 : 1;
    const bConnected = connectedCodeValue && b.templateCode === connectedCodeValue ? 0 : 1;
    if (aConnected !== bConnected) return aConnected - bConnected;
    return (b.templateCode ?? "").localeCompare(a.templateCode ?? "");
  });
}

function ButtonList({
  title,
  buttons,
  caption,
}: {
  title: string;
  buttons: TemplateButton[];
  caption?: string;
}) {
  return (
    <div className="mt-3 flex min-h-[196px] flex-col rounded-[6px] border border-[#ece8e2] bg-white px-3 py-3">
      <p className="text-[13px] font-semibold text-[#6f665f]">{title}</p>
      {caption ? <p className="mt-1 text-[12px] leading-5 text-[#8a8277]">{caption}</p> : null}
      {buttons.length ? (
        <div className="mt-2 grid flex-1 content-start gap-2">
          {buttons.map((button, index) => (
            <div
              key={`${button.name ?? "button"}-${index}`}
              className="rounded-[6px] border border-[#ece8e2] bg-[#fbfaf8] px-3 py-2 text-[13px] leading-5 text-[#5c554d]"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-[#171411]">{button.name || "-"}</p>
                <span className="text-[12px] font-semibold text-[#8a8277]">{button.type || "WL"}</span>
              </div>
              <p className="mt-1 break-all text-[#7a7268]">{button.linkMobile || button.linkPc || button.link || "-"}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-[13px] text-[#8a8277]">버튼 없음</p>
      )}
    </div>
  );
}

export default function AdminAlimtalkTemplateComparisonPanel({
  appTemplateDrafts,
  relayTemplateItems,
  allSsodaaTemplates,
  loadingTemplates,
  templateError,
  onReload,
  onSaveTemplate,
  onSelectTemplate,
}: {
  appTemplateDrafts: AppTemplateDraft[];
  relayTemplateItems: RelaySsodaaTemplateItem[];
  allSsodaaTemplates: RelaySsodaaTemplateDetail[];
  loadingTemplates: boolean;
  templateError: string | null;
  onReload: () => void;
  onSaveTemplate: (alias: AlimtalkTemplateAlias, body: string) => Promise<void>;
  onSelectTemplate: (alias: AlimtalkTemplateAlias, templateCode: string) => Promise<void>;
}) {
  const [editingAlias, setEditingAlias] = useState<AlimtalkTemplateAlias | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [savingAlias, setSavingAlias] = useState<AlimtalkTemplateAlias | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [expandedAliases, setExpandedAliases] = useState<Set<AlimtalkTemplateAlias>>(() => new Set());
  const [selectingTemplateCode, setSelectingTemplateCode] = useState<string | null>(null);
  const visibleAppTemplateDrafts = appTemplateDrafts.filter((draft) => draft.alias !== "booking_received");

  async function handleSelectTemplate(alias: AlimtalkTemplateAlias, templateCode: string) {
    setSelectingTemplateCode(templateCode);
    try {
      await onSelectTemplate(alias, templateCode);
      setSaveError(null);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "쏘다 템플릿 연결에 실패했습니다.");
    } finally {
      setSelectingTemplateCode(null);
    }
  }

  async function handleSave(alias: AlimtalkTemplateAlias) {
    setSavingAlias(alias);
    try {
      await onSaveTemplate(alias, editingBody);
      setEditingAlias(null);
      setEditingBody("");
      setSaveError(null);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "우리 템플릿 저장에 실패했습니다.");
    } finally {
      setSavingAlias(null);
    }
  }

  function getComparisonState(draft: AppTemplateDraft) {
    const relayItem = relayTemplateItems.find((item) => item.alias === draft.alias) ?? null;
    const ssodaaBody = normalizeTemplateBody(relayItem?.detail?.templateContent);
    const appBody = normalizeTemplateBody(draft.body);
    const ssodaaButtons = relayItem?.detail?.buttons ?? [];
    const appButtons = getAppButtons(draft.alias);
    const candidates = getTemplateCandidates({
      alias: draft.alias,
      connectedCode: relayItem?.configuredCode,
      allTemplates: allSsodaaTemplates,
    });
    const hasCode = Boolean(relayItem?.configuredCode);
    const hasSsodaaBody = Boolean(ssodaaBody);
    const bodyMatches = hasSsodaaBody && ssodaaBody === appBody;
    const buttonsMatch = normalizeButtons(ssodaaButtons) === normalizeButtons(appButtons);
    return { relayItem, ssodaaBody, appBody, ssodaaButtons, appButtons, candidates, hasCode, hasSsodaaBody, bodyMatches, buttonsMatch };
  }

  function toggleAlias(alias: AlimtalkTemplateAlias) {
    setExpandedAliases((current) => {
      const next = new Set(current);
      if (next.has(alias)) next.delete(alias);
      else next.add(alias);
      return next;
    });
  }

  return (
    <section className="rounded-[8px] border border-[#e6e3dd] bg-white p-4 shadow-[0_6px_16px_rgba(23,20,17,0.025)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h2 className="text-[22px] font-semibold tracking-[-0.03em] text-[#171411]">템플릿 본문 비교</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setExpandedAliases(new Set(visibleAppTemplateDrafts.map((draft) => draft.alias)))}
            className="inline-flex h-9 items-center rounded-[6px] border border-[#d8d4ce] bg-white px-3 text-[13px] font-semibold text-[#5c554d]"
          >
            전체 펼침
          </button>
          <button
            type="button"
            onClick={() =>
              setExpandedAliases(
                new Set(
                  visibleAppTemplateDrafts
                    .filter((draft) => {
                      const state = getComparisonState(draft);
                      return !state.bodyMatches || !state.buttonsMatch || !state.hasCode;
                    })
                    .map((draft) => draft.alias),
                ),
              )
            }
            className="inline-flex h-9 items-center rounded-[6px] border border-[#d8d4ce] bg-white px-3 text-[13px] font-semibold text-[#5c554d]"
          >
            확인 필요만
          </button>
          <button
            type="button"
            onClick={() => setExpandedAliases(new Set())}
            className="inline-flex h-9 items-center rounded-[6px] border border-[#d8d4ce] bg-white px-3 text-[13px] font-semibold text-[#5c554d]"
          >
            전체 접힘
          </button>
          <button
            type="button"
            onClick={onReload}
            disabled={loadingTemplates}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-[6px] border border-[#d8d4ce] bg-white px-3 text-[13px] font-semibold text-[#5c554d] disabled:opacity-60"
          >
            <RefreshCcw className="h-4 w-4" />
            쏘다 조회
          </button>
        </div>
      </div>

      {templateError ? (
        <p className="mt-4 rounded-[6px] border border-[#f0d1d1] bg-white px-4 py-3 text-[14px] leading-6 text-[#b54b4b]">
          {templateError}
        </p>
      ) : null}
      {saveError ? (
        <p className="mt-4 rounded-[6px] border border-[#f0d1d1] bg-white px-4 py-3 text-[14px] leading-6 text-[#b54b4b]">
          {saveError}
        </p>
      ) : null}

      {loadingTemplates ? (
        <div className="mt-4 rounded-[6px] border border-[#e6e3dd] bg-white px-4 py-4 text-[15px] text-[#7a7268]">
          쏘다 템플릿을 불러오는 중입니다.
        </div>
      ) : (
        <div className="mt-4 grid gap-2">
          {visibleAppTemplateDrafts.map((draft) => {
            const { relayItem, ssodaaBody, appBody, ssodaaButtons, appButtons, candidates, hasCode, hasSsodaaBody, bodyMatches, buttonsMatch } =
              getComparisonState(draft);
            const isOpen = expandedAliases.has(draft.alias) || editingAlias === draft.alias;
            const bodyLabel = !hasCode ? "연결 후 본문 확인" : !hasSsodaaBody ? "본문 조회 실패" : bodyMatches ? "본문 일치" : "본문 불일치";
            const buttonLabel = !hasCode ? "연결 후 버튼 확인" : buttonsMatch ? "버튼 일치" : "버튼 불일치";
            const codeLabel = hasCode ? "코드 연결됨" : "코드 연결 필요";

            return (
              <article key={draft.alias} className="rounded-[8px] border border-[#e6e3dd] bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <button type="button" onClick={() => toggleAlias(draft.alias)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-expanded={isOpen}>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-[#7a7268] transition ${isOpen ? "rotate-180" : ""}`} />
                    <span className="min-w-[132px] text-[16px] font-semibold text-[#171411]">{draft.title}</span>
                    {candidates.length > 1 ? (
                      <span className="rounded-[999px] border border-[#e6e3dd] bg-[#fbfaf8] px-2.5 py-1 text-[12px] font-semibold text-[#6f665f]">
                        후보 {candidates.length}개
                      </span>
                    ) : null}
                    <span className={`rounded-[999px] border px-2.5 py-1 text-[12px] font-semibold ${getCodeTone(hasCode)}`}>{codeLabel}</span>
                    <span className={`rounded-[999px] border px-2.5 py-1 text-[12px] font-semibold ${getBodyTone({ hasCode, bodyMatches })}`}>{bodyLabel}</span>
                    <span className={`rounded-[999px] border px-2.5 py-1 text-[12px] font-semibold ${hasCode ? getStatusTone(buttonsMatch) : getCodeTone(false)}`}>{buttonLabel}</span>
                  </button>
                  <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#6f665f]">
                    <span className="rounded-[999px] border border-[#e6e3dd] bg-[#fbfaf8] px-2.5 py-1">
                      쏘다 상태{" "}
                      {relayItem?.detail?.inspectionStatus || relayItem?.detail?.serviceStatus
                        ? formatSsodaaStatus(relayItem.detail.inspectionStatus || relayItem.detail.serviceStatus)
                        : relayItem?.error || "-"}
                    </span>
                  </div>
                </div>

                {isOpen ? (
                  <div className="grid gap-3 border-t border-[#e6e3dd] p-3">
                    <section className="rounded-[8px] border border-[#e6e3dd] bg-[#fbfaf8] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[15px] font-semibold text-[#171411]">연결 가능한 쏘다 템플릿</p>
                        <span className="text-[13px] text-[#8a8277]">{candidates.length}개</span>
                      </div>
                      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        {candidates.length ? (
                          candidates.map((template) => {
                            const isConnected = template.templateCode === relayItem?.configuredCode;
                            return (
                              <div
                                key={template.templateCode}
                                className={`rounded-[6px] border px-3 py-3 ${
                                  isConnected ? "border-[#cfe3dc] bg-white text-[#1f6b5b]" : "border-[#ece8e2] bg-white text-[#5c554d]"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="text-[12px] font-semibold text-[#8a8277]">템플릿명</p>
                                    <p className="mt-1 truncate text-[15px] font-semibold text-[#171411]">{template.templateName || "이름 없음"}</p>
                                    <p className="mt-2 text-[12px] font-semibold text-[#8a8277]">템플릿 코드</p>
                                    <p className="mt-1 break-all font-mono text-[12px] text-[#6f665f]">{template.templateCode}</p>
                                  </div>
                                  {isConnected ? (
                                    <span className="shrink-0 rounded-[999px] border border-[#cfe3dc] bg-[#f5fbf8] px-2 py-1 text-[12px] font-semibold text-[#1f6b5b]">
                                      현재 연결
                                    </span>
                                  ) : null}
                                </div>
                                <p className="mt-2 text-[12px] font-semibold text-[#7a7268]">
                                  {formatSsodaaStatus(template.inspectionStatus || template.serviceStatus)}
                                </p>
                                {!isConnected ? (
                                  <button
                                    type="button"
                                    onClick={() => void handleSelectTemplate(draft.alias, template.templateCode)}
                                    disabled={Boolean(selectingTemplateCode)}
                                    className="mt-3 h-8 rounded-[6px] border border-[#d8d4ce] bg-white px-3 text-[12px] font-semibold text-[#5c554d] disabled:opacity-60"
                                  >
                                    {selectingTemplateCode === template.templateCode ? "연결 중" : "이 템플릿 연결"}
                                  </button>
                                ) : null}
                              </div>
                            );
                          })
                        ) : (
                          <p className="rounded-[6px] border border-[#ece8e2] bg-white px-3 py-3 text-[13px] text-[#8a8277]">
                            같은 종류로 보이는 쏘다 템플릿이 없습니다.
                          </p>
                        )}
                      </div>
                    </section>

                    <div className="grid gap-3 xl:grid-cols-2">
                      <section className="flex flex-col rounded-[8px] border border-[#e6e3dd] bg-[#fbfaf8] p-4">
                        <div className="flex h-10 items-center justify-between gap-3">
                          <p className="text-[15px] font-semibold text-[#171411]">쏘다 템플릿</p>
                          <span className="min-w-0 truncate text-[15px] font-semibold text-[#5c554d]">
                            {relayItem?.detail?.templateName || "등록명 없음"}
                          </span>
                        </div>
                        <pre className="mt-3 h-[288px] overflow-auto whitespace-pre-wrap break-words rounded-[6px] border border-[#ece8e2] bg-white px-4 py-4 font-[inherit] text-[14px] leading-6 text-[#171411]">
                          {ssodaaBody || relayItem?.error || "쏘다 등록 본문을 아직 불러오지 못했습니다."}
                        </pre>
                        <ButtonList title="쏘다 버튼" buttons={ssodaaButtons} caption="쏘다에 등록된 버튼 URL 형식입니다." />
                      </section>

                      <section className="flex flex-col rounded-[8px] border border-[#e6e3dd] bg-[#fbfaf8] p-4">
                        <div className="flex h-10 items-center justify-between gap-3">
                          <p className="text-[15px] font-semibold text-[#171411]">우리 템플릿</p>
                          <div className="flex items-center gap-2">
                          {draft.isOverride ? (
                            <span className="rounded-[999px] border border-[#cfe3dc] bg-white px-2.5 py-1 text-[12px] font-semibold text-[#1f6b5b]">
                              수정본 적용 중
                            </span>
                          ) : (
                            <span className="text-[13px] text-[#8a8277]">기본 코드 기준</span>
                          )}
                          {ssodaaBody ? (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingAlias(draft.alias);
                                setEditingBody(ssodaaBody);
                                setSaveError(null);
                              }}
                              disabled={savingAlias === draft.alias}
                              className="h-8 rounded-[6px] border border-[#d8d4ce] bg-white px-3 text-[13px] font-semibold text-[#5c554d] disabled:opacity-60"
                            >
                              쏘다 본문으로 맞추기
                            </button>
                          ) : null}
                          {editingAlias === draft.alias ? (
                            <>
                                <button
                                  type="button"
                                  onClick={() => void handleSave(draft.alias)}
                                  disabled={savingAlias === draft.alias}
                                  className="h-8 rounded-[6px] bg-[#1f6b5b] px-3 text-[13px] font-semibold text-white disabled:opacity-60"
                                >
                                  {savingAlias === draft.alias ? "저장 중" : "저장"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingAlias(null);
                                    setEditingBody("");
                                    setSaveError(null);
                                  }}
                                  disabled={savingAlias === draft.alias}
                                  className="h-8 rounded-[6px] border border-[#d8d4ce] bg-white px-3 text-[13px] font-semibold text-[#5c554d] disabled:opacity-60"
                                >
                                  취소
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingAlias(draft.alias);
                                  setEditingBody(draft.body);
                                  setSaveError(null);
                                }}
                                className="h-8 rounded-[6px] border border-[#d8d4ce] bg-white px-3 text-[13px] font-semibold text-[#5c554d]"
                              >
                                수정
                              </button>
                            )}
                          </div>
                        </div>
                        {editingAlias === draft.alias ? (
                          <textarea
                            value={editingBody}
                            onChange={(event) => setEditingBody(event.target.value)}
                            rows={8}
                            className="mt-3 h-[288px] w-full resize-none overflow-auto rounded-[6px] border border-[#d8d4ce] bg-white px-4 py-4 font-[inherit] text-[14px] leading-6 text-[#171411] outline-none focus:border-[#1f6b5b]"
                          />
                        ) : (
                          <pre className="mt-3 h-[288px] overflow-auto whitespace-pre-wrap break-words rounded-[6px] border border-[#ece8e2] bg-white px-4 py-4 font-[inherit] text-[14px] leading-6 text-[#171411]">
                            {appBody}
                          </pre>
                        )}
                        <ButtonList
                          title="우리 발송 버튼"
                          buttons={appButtons}
                          caption="실제 발송 때 예약별 링크로 채워집니다. 쏘다 등록 URL과 역할이 같으면 됩니다."
                        />
                      </section>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
