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

type TemplateDraftGroup = {
  key: string;
  title: string;
  description?: string;
  section: TemplateSectionKey;
  drafts: AppTemplateDraft[];
};

type TemplateSectionKey = "booking" | "visit" | "grooming" | "customer";

type TemplateDraftSection = {
  key: TemplateSectionKey;
  title: string;
  description: string;
  groups: TemplateDraftGroup[];
};

const reservationNoticeTitles: Partial<Record<AlimtalkTemplateAlias, string>> = {
  visit_schedule_notice: "예약 안내 - 내일",
  visit_reminder_notice: "예약 안내 - 오늘",
  appointment_reminder_10m: "예약 안내 - 직전",
};

const templateSectionCopy: Record<TemplateSectionKey, { title: string; description: string }> = {
  booking: {
    title: "예약",
    description: "예약 완료, 변경, 취소처럼 예약 상태가 바뀔 때 보내는 안내입니다.",
  },
  visit: {
    title: "예약 안내",
    description: "내일 예약, 오늘 예약, 방문 직전 예약 안내를 시점별로 나눠 관리합니다.",
  },
  grooming: {
    title: "미용 진행",
    description: "미용 시작, 픽업 준비, 완료 사진처럼 시술 흐름에 맞춰 보내는 안내입니다.",
  },
  customer: {
    title: "고객 관리",
    description: "재방문, 생일처럼 예약 건 밖에서 고객 관리용으로 보내는 안내입니다.",
  },
};

function getTemplateSectionKey(alias: AlimtalkTemplateAlias): TemplateSectionKey {
  switch (alias) {
    case "appointment_reminder_10m":
    case "visit_schedule_notice":
    case "visit_reminder_notice":
      return "visit";
    case "grooming_started":
    case "grooming_almost_done":
    case "grooming_completed":
      return "grooming";
    case "revisit_notice":
    case "birthday_greeting":
      return "customer";
    default:
      return "booking";
  }
}

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
  booking_rejected: ["예약 거절"],
  booking_cancelled: ["예약 취소"],
  booking_time_proposed: [
    "다른 시간",
    "다른시간",
    "다른 시간 제안",
    "다른시간제안",
    "예약 시간 변경",
    "예약시간변경",
    "예약 시간 제안",
    "예약시간제안",
    "예약 일정 변경",
    "예약일정변경",
    "booking_time_proposed",
    "time_proposed",
  ],
  booking_rescheduled_confirmed: ["예약 변경 확정"],
  appointment_reminder_10m: ["예약 안내 직전", "예약 안내_직전", "booking_soon_notice", "booking_soon_notice_v1"],
  visit_schedule_notice: ["예약 안내 내일", "예약 안내_내일", "booking_tomorrow_notice", "booking_tomorrow_notice_v1"],
  visit_reminder_notice: ["예약 안내 오늘", "예약 안내_오늘", "booking_today_notice", "booking_today_notice_v1"],
  grooming_started: ["미용 시작"],
  grooming_almost_done: ["픽업 준비"],
  grooming_completed: ["미용 완료"],
  revisit_notice: ["재방문"],
  birthday_greeting: ["생일"],
};

const aliasTemplateExcludedKeywords: Partial<Record<AlimtalkTemplateAlias, string[]>> = {
  booking_rejected: [
    "다른 시간",
    "다른시간",
    "예약 시간 변경",
    "예약시간변경",
    "예약 시간 제안",
    "예약시간제안",
    "예약 일정 변경",
    "예약일정변경",
    "booking_time_proposed",
    "time_proposed",
  ],
  booking_time_proposed: ["예약 거절"],
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
    case "visit_schedule_notice":
    case "visit_reminder_notice":
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

function getVisibleTemplateDraftGroups(drafts: AppTemplateDraft[]): TemplateDraftGroup[] {
  const visibleDrafts = drafts.filter((draft) => draft.alias !== "booking_received");
  const groups: TemplateDraftGroup[] = [];

  for (const draft of visibleDrafts) {
    groups.push({
      key: draft.alias,
      title: reservationNoticeTitles[draft.alias] ?? draft.title,
      section: getTemplateSectionKey(draft.alias),
      drafts: [draft],
    });
  }

  return groups;
}

function getVisibleTemplateDraftSections(groups: TemplateDraftGroup[]): TemplateDraftSection[] {
  const sectionOrder: TemplateSectionKey[] = ["booking", "visit", "grooming", "customer"];
  return sectionOrder
    .map((sectionKey) => {
      const sectionGroups = groups.filter((group) => group.section === sectionKey);
      const copy = templateSectionCopy[sectionKey];
      return {
        key: sectionKey,
        title: copy.title,
        description: copy.description,
        groups: sectionGroups,
      };
    })
    .filter((section) => section.groups.length > 0);
}

function uniqueTemplatesByCode(items: RelaySsodaaTemplateDetail[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.templateCode;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeTemplateSearchText(value: string) {
  return value.toLowerCase().replace(/[\s_-]+/g, "");
}

function matchesTemplateKeywords(searchTarget: string, keywords: string[]) {
  const normalizedSearchTarget = normalizeTemplateSearchText(searchTarget);
  return keywords.some((keyword) => {
    const lowerKeyword = keyword.toLowerCase();
    return searchTarget.includes(lowerKeyword) || normalizedSearchTarget.includes(normalizeTemplateSearchText(lowerKeyword));
  });
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
  const excludedKeywords = aliasTemplateExcludedKeywords[alias] ?? [];
  const connectedCodeValue = connectedCode?.trim();
  const candidates = allTemplates.filter((template) => {
    const templateName = template.templateName ?? "";
    const templateCode = template.templateCode ?? "";
    const searchTarget = `${templateName} ${templateCode}`.toLowerCase();
    if (matchesTemplateKeywords(searchTarget, excludedKeywords)) return false;
    if (connectedCodeValue && templateCode === connectedCodeValue) return true;
    return matchesTemplateKeywords(searchTarget, keywords);
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
    <div className="mt-2 flex max-h-[120px] min-h-[72px] flex-col overflow-auto rounded-[6px] border border-[#ece8e2] bg-white px-3 py-2">
      <p className="text-[13px] font-semibold text-[#6f665f]">{title}</p>
      {caption ? <p className="mt-1 text-[12px] leading-5 text-[#8a8277]">{caption}</p> : null}
      {buttons.length ? (
        <div className="mt-2 grid flex-1 content-start gap-1.5">
          {buttons.map((button, index) => (
            <div
              key={`${button.name ?? "button"}-${index}`}
              className="rounded-[6px] border border-[#ece8e2] bg-[#fbfaf8] px-2.5 py-1.5 text-[12px] leading-4 text-[#5c554d]"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-[#171411]">{button.name || "-"}</p>
                <span className="text-[12px] font-semibold text-[#8a8277]">{button.type || "WL"}</span>
              </div>
              <p className="mt-0.5 break-all text-[#7a7268]">{button.linkMobile || button.linkPc || button.link || "-"}</p>
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
  onSelectTemplate,
}: {
  appTemplateDrafts: AppTemplateDraft[];
  relayTemplateItems: RelaySsodaaTemplateItem[];
  allSsodaaTemplates: RelaySsodaaTemplateDetail[];
  loadingTemplates: boolean;
  templateError: string | null;
  onReload: () => void;
  onSelectTemplate: (alias: AlimtalkTemplateAlias, templateCode: string) => Promise<RelaySsodaaTemplateDetail | null>;
}) {
  const [editingAlias, setEditingAlias] = useState<AlimtalkTemplateAlias | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [savingAlias, setSavingAlias] = useState<AlimtalkTemplateAlias | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());
  const [selectingTemplateCode, setSelectingTemplateCode] = useState<string | null>(null);
  const visibleTemplateGroups = getVisibleTemplateDraftGroups(appTemplateDrafts);
  const visibleTemplateSections = getVisibleTemplateDraftSections(visibleTemplateGroups);

  async function handleSelectTemplateGroup(group: TemplateDraftGroup, template: RelaySsodaaTemplateDetail) {
    setSelectingTemplateCode(template.templateCode);
    try {
      for (const draft of group.drafts) {
        await onSelectTemplate(draft.alias, template.templateCode);
      }
      setSaveError(null);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "쏘다 템플릿 연결 또는 본문 자동 저장에 실패했습니다.");
    } finally {
      setSelectingTemplateCode(null);
    }
  }

  async function handleSave(alias: AlimtalkTemplateAlias) {
    setSavingAlias(alias);
    try {
      void alias;
      setEditingAlias(null);
      setEditingBody("");
      setSaveError(null);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "쏘다 템플릿 연결에 실패했습니다.");
    } finally {
      setSavingAlias(null);
    }
  }

  function getComparisonState(draft: AppTemplateDraft) {
    const relayItem = relayTemplateItems.find((item) => item.alias === draft.alias) ?? null;
    const ssodaaBody = normalizeTemplateBody(relayItem?.detail?.templateContent);
    const appBody = ssodaaBody || normalizeTemplateBody(draft.body);
    const hasRelayDetail = Boolean(relayItem?.detail);
    const ssodaaButtons = relayItem?.detail?.buttons ?? [];
    const appButtons = hasRelayDetail ? ssodaaButtons : [];
    const candidates = getTemplateCandidates({
      alias: draft.alias,
      connectedCode: relayItem?.configuredCode,
      allTemplates: allSsodaaTemplates,
    });
    const hasCode = Boolean(relayItem?.configuredCode);
    const hasSsodaaBody = Boolean(ssodaaBody);
    const bodyMatches = hasSsodaaBody && ssodaaBody === appBody;
    const buttonsMatch = hasRelayDetail && normalizeButtons(ssodaaButtons) === normalizeButtons(appButtons);
    return { relayItem, ssodaaBody, appBody, ssodaaButtons, appButtons, candidates, hasCode, hasSsodaaBody, bodyMatches, buttonsMatch };
  }

  function getGroupComparisonState(group: TemplateDraftGroup) {
    const states = group.drafts.map((draft) => ({ draft, ...getComparisonState(draft) }));
    const primaryState = states[0];
    const candidates = uniqueTemplatesByCode(states.flatMap((state) => state.candidates));
    const hasCode = states.every((state) => state.hasCode);
    const hasAnyCode = states.some((state) => state.hasCode);
    const hasSsodaaBody = states.every((state) => state.hasSsodaaBody);
    const bodyMatches = states.every((state) => state.bodyMatches);
    const buttonsMatch = states.every((state) => state.buttonsMatch);
    return { states, primaryState, candidates, hasCode, hasAnyCode, hasSsodaaBody, bodyMatches, buttonsMatch };
  }

  function toggleGroup(groupKey: string) {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
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
            onClick={() => setExpandedGroups(new Set(visibleTemplateGroups.map((group) => group.key)))}
            className="inline-flex h-9 items-center rounded-[6px] border border-[#d8d4ce] bg-white px-3 text-[13px] font-semibold text-[#5c554d]"
          >
            전체 펼침
          </button>
          <button
            type="button"
            onClick={() =>
              setExpandedGroups(
                new Set(
                  visibleTemplateGroups
                    .filter((group) => {
                      const state = getGroupComparisonState(group);
                      return !state.bodyMatches || !state.buttonsMatch || !state.hasCode;
                    })
                    .map((group) => group.key),
                ),
              )
            }
            className="inline-flex h-9 items-center rounded-[6px] border border-[#d8d4ce] bg-white px-3 text-[13px] font-semibold text-[#5c554d]"
          >
            확인 필요만
          </button>
          <button
            type="button"
            onClick={() => setExpandedGroups(new Set())}
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
        <div className="mt-3 grid gap-3">
          {visibleTemplateSections.map((section) => (
            <section key={section.key} className="rounded-[9px] border border-[#e6e3dd] bg-[#fbfaf8] p-2.5">
              <div className="mb-2 flex flex-wrap items-end justify-between gap-2 border-b border-[#ece8e2] pb-2">
                <div>
                  <h3 className="text-[16px] font-semibold text-[#171411]">{section.title}</h3>
                  <p className="mt-0.5 text-[12px] leading-4 text-[#7a7268]">{section.description}</p>
                </div>
                <span className="rounded-[999px] border border-[#e6e3dd] bg-white px-2 py-0.5 text-[12px] font-semibold text-[#6f665f]">
                  {section.groups.length}개
                </span>
              </div>
              <div className="grid gap-1.5">
                {section.groups.map((group) => {
            const { states, primaryState, candidates, hasCode, hasAnyCode, hasSsodaaBody, bodyMatches, buttonsMatch } = getGroupComparisonState(group);
            const primaryDraft = primaryState.draft;
            const { relayItem, ssodaaBody, appBody, ssodaaButtons, appButtons } = primaryState;
            const isOpen = expandedGroups.has(group.key) || group.drafts.some((draft) => editingAlias === draft.alias);
            const bodyLabel = !hasCode ? "연결 후 본문 확인" : !hasSsodaaBody ? "본문 조회 실패" : bodyMatches ? "본문 일치" : "본문 불일치";
            const buttonLabel = !hasCode ? "연결 후 버튼 확인" : buttonsMatch ? "버튼 일치" : "버튼 불일치";
            const codeLabel = hasCode ? "코드 연결됨" : hasAnyCode ? "일부 코드 연결" : "코드 연결 필요";
            const statusLabel =
              states.length > 1
                ? states
                    .map((state) => `${state.draft.title.replace(" 안내", "")} ${formatSsodaaStatus(state.relayItem?.detail?.inspectionStatus || state.relayItem?.detail?.serviceStatus)}`)
                    .join(" · ")
                : relayItem?.detail?.inspectionStatus || relayItem?.detail?.serviceStatus
                  ? formatSsodaaStatus(relayItem.detail.inspectionStatus || relayItem.detail.serviceStatus)
                  : relayItem?.error || "-";

            return (
              <article key={group.key} className="rounded-[7px] border border-[#e6e3dd] bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <button type="button" onClick={() => toggleGroup(group.key)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left" aria-expanded={isOpen}>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-[#7a7268] transition ${isOpen ? "rotate-180" : ""}`} />
                    <span className="min-w-[126px] text-[15px] font-semibold text-[#171411]">{group.title}</span>
                    {group.description ? <span className="text-[12px] font-medium text-[#8a8277]">{group.description}</span> : null}
                    {candidates.length > 1 ? (
                      <span className="rounded-[999px] border border-[#e6e3dd] bg-[#fbfaf8] px-2 py-0.5 text-[12px] font-semibold text-[#6f665f]">
                        후보 {candidates.length}개
                      </span>
                    ) : null}
                    <span className={`rounded-[999px] border px-2 py-0.5 text-[12px] font-semibold ${getCodeTone(hasCode)}`}>{codeLabel}</span>
                    <span className={`rounded-[999px] border px-2 py-0.5 text-[12px] font-semibold ${getBodyTone({ hasCode, bodyMatches })}`}>{bodyLabel}</span>
                    <span className={`rounded-[999px] border px-2 py-0.5 text-[12px] font-semibold ${hasCode ? getStatusTone(buttonsMatch) : getCodeTone(false)}`}>{buttonLabel}</span>
                  </button>
                  <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#6f665f]">
                    <span className="rounded-[999px] border border-[#e6e3dd] bg-[#fbfaf8] px-2 py-0.5">
                      쏘다 상태 {statusLabel}
                    </span>
                  </div>
                </div>

                {isOpen ? (
                  <div className="grid gap-2 border-t border-[#e6e3dd] p-2">
                    {states.length > 1 ? (
                      <div className="flex flex-wrap gap-1.5 rounded-[7px] border border-[#ece8e2] bg-[#fbfaf8] px-2.5 py-1.5">
                        {states.map((state) => (
                          <span key={state.draft.alias} className="rounded-[999px] border border-[#e6e3dd] bg-white px-2 py-0.5 text-[12px] font-semibold text-[#6f665f]">
                            {state.draft.title}: {state.hasCode ? "코드 연결됨" : "코드 연결 필요"}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <section className="rounded-[7px] border border-[#e6e3dd] bg-[#fbfaf8] p-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[14px] font-semibold text-[#171411]">연결 가능한 쏘다 템플릿</p>
                        <span className="text-[12px] text-[#8a8277]">{candidates.length}개</span>
                      </div>
                      <div className="mt-1.5 grid max-h-[132px] gap-1.5 overflow-auto pr-1 md:grid-cols-2 xl:grid-cols-3">
                        {candidates.length ? (
                          candidates.map((template) => {
                            const connectedCount = states.filter((state) => template.templateCode === state.relayItem?.configuredCode).length;
                            const isConnected = connectedCount === states.length;
                            const isPartiallyConnected = connectedCount > 0 && !isConnected;
                            return (
                              <div
                                key={template.templateCode}
                                role={isConnected ? undefined : "button"}
                                tabIndex={isConnected ? undefined : 0}
                                onClick={() => {
                                  if (!isConnected) void handleSelectTemplateGroup(group, template);
                                }}
                                onKeyDown={(event) => {
                                  if (isConnected) return;
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    void handleSelectTemplateGroup(group, template);
                                  }
                                }}
                                className={`rounded-[6px] border px-3 py-2 transition ${
                                  isConnected
                                    ? "border-[#cfe3dc] bg-white text-[#1f6b5b]"
                                    : "cursor-pointer border-[#ece8e2] bg-white text-[#5c554d] hover:border-[#d8d4ce] hover:bg-[#fbfaf8]"
                                }`}
                              >
                                <div className="flex min-w-0 items-center gap-2">
                                  <span className="shrink-0 text-[11px] font-semibold text-[#8a8277]">템플릿명</span>
                                  <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-[#171411]">{template.templateName || "이름 없음"}</span>
                                  {isConnected ? (
                                    <span className="shrink-0 rounded-[999px] border border-[#cfe3dc] bg-[#f5fbf8] px-2 py-1 text-[12px] font-semibold text-[#1f6b5b]">
                                      현재 연결
                                    </span>
                                  ) : isPartiallyConnected ? (
                                    <span className="shrink-0 rounded-[999px] border border-[#ead7b7] bg-[#fffaf0] px-2 py-1 text-[12px] font-semibold text-[#8a5b11]">
                                      일부 연결
                                    </span>
                                  ) : null}
                                </div>
                                <div className="mt-1.5 flex min-w-0 items-center gap-2">
                                  <span className="shrink-0 text-[11px] font-semibold text-[#8a8277]">코드</span>
                                  <span className="min-w-0 flex-1 truncate font-mono text-[14px] text-[#5c554d]">{template.templateCode}</span>
                                  <span className="shrink-0 text-[14px] font-semibold text-[#7a7268]">
                                    {formatSsodaaStatus(template.inspectionStatus || template.serviceStatus)}
                                  </span>
                                  {!isConnected ? (
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        void handleSelectTemplateGroup(group, template);
                                      }}
                                      disabled={Boolean(selectingTemplateCode)}
                                      className="h-7 shrink-0 rounded-[6px] border border-[#d8d4ce] bg-white px-3 text-[14px] font-semibold text-[#5c554d] disabled:opacity-60"
                                    >
                                      {selectingTemplateCode === template.templateCode ? "연결 중" : states.length > 1 ? "둘 다 연결" : "연결"}
                                    </button>
                                  ) : null}
                                </div>
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
                      <section className="flex flex-col rounded-[8px] border border-[#e6e3dd] bg-[#fbfaf8] p-3">
                        <div className="flex h-8 items-center justify-between gap-3">
                          <p className="text-[15px] font-semibold text-[#171411]">쏘다 템플릿</p>
                          <span className="min-w-0 truncate text-[15px] font-semibold text-[#5c554d]">
                            {relayItem?.detail?.templateName || "등록명 없음"}
                          </span>
                        </div>
                        <pre className="mt-2 h-[132px] overflow-auto whitespace-pre-wrap break-words rounded-[6px] border border-[#ece8e2] bg-white px-3 py-2.5 font-[inherit] text-[13px] leading-5 text-[#171411]">
                          {ssodaaBody || relayItem?.error || "쏘다 등록 본문을 아직 불러오지 못했습니다."}
                        </pre>
                        <ButtonList title="쏘다 버튼" buttons={ssodaaButtons} caption="쏘다에 등록된 버튼 URL 형식입니다." />
                      </section>

                      <section className="flex flex-col rounded-[8px] border border-[#e6e3dd] bg-[#fbfaf8] p-3">
                        <div className="flex h-8 items-center justify-between gap-3">
                          <p className="text-[15px] font-semibold text-[#171411]">우리 발송 기준</p>
                          <span className="rounded-[999px] border border-[#cfe3dc] bg-white px-2.5 py-1 text-[12px] font-semibold text-[#1f6b5b]">
                            쏘다 연결본 자동 적용
                          </span>
                          <div className="hidden">
                          {primaryDraft.isOverride ? (
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
                                setEditingAlias(primaryDraft.alias);
                                setEditingBody(ssodaaBody);
                                setSaveError(null);
                              }}
                              disabled={savingAlias === primaryDraft.alias}
                              className="h-8 rounded-[6px] border border-[#d8d4ce] bg-white px-3 text-[13px] font-semibold text-[#5c554d] disabled:opacity-60"
                            >
                              쏘다 본문으로 맞추기
                            </button>
                          ) : null}
                          {editingAlias === primaryDraft.alias ? (
                            <>
                                <button
                                  type="button"
                                  onClick={() => void handleSave(primaryDraft.alias)}
                                  disabled={savingAlias === primaryDraft.alias}
                                  className="h-8 rounded-[6px] bg-[#1f6b5b] px-3 text-[13px] font-semibold text-white disabled:opacity-60"
                                >
                                  {savingAlias === primaryDraft.alias ? "저장 중" : "저장"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingAlias(null);
                                    setEditingBody("");
                                    setSaveError(null);
                                  }}
                                  disabled={savingAlias === primaryDraft.alias}
                                  className="h-8 rounded-[6px] border border-[#d8d4ce] bg-white px-3 text-[13px] font-semibold text-[#5c554d] disabled:opacity-60"
                                >
                                  취소
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingAlias(primaryDraft.alias);
                                  setEditingBody(primaryDraft.body);
                                  setSaveError(null);
                                }}
                                className="h-8 rounded-[6px] border border-[#d8d4ce] bg-white px-3 text-[13px] font-semibold text-[#5c554d]"
                              >
                                수정
                              </button>
                            )}
                          </div>
                        </div>
                        {editingAlias === primaryDraft.alias ? (
                          <textarea
                            value={editingBody}
                            onChange={(event) => setEditingBody(event.target.value)}
                            rows={8}
                            className="mt-2 h-[132px] w-full resize-none overflow-auto rounded-[6px] border border-[#d8d4ce] bg-white px-3 py-2.5 font-[inherit] text-[13px] leading-5 text-[#171411] outline-none focus:border-[#1f6b5b]"
                          />
                        ) : (
                          <pre className="mt-2 h-[132px] overflow-auto whitespace-pre-wrap break-words rounded-[6px] border border-[#ece8e2] bg-white px-3 py-2.5 font-[inherit] text-[13px] leading-5 text-[#171411]">
                            {appBody}
                          </pre>
                        )}
                        <ButtonList
                          title="우리 발송 버튼 기준"
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
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
