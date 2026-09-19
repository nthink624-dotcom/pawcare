"use client";

import { ArrowUp, Camera, Check, ImagePlus, LoaderCircle, Mic, Pause, Send, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { fetchApiJsonWithAuth } from "@/lib/api";
import { clearOwnerCareReportLocalDraft, readOwnerCareReportLocalDraft, writeOwnerCareReportLocalDraft } from "@/lib/care-report/owner-care-report-local-draft";
import { startOwnerCareReportSpeechInput, type OwnerSpeechInputErrorCode, type OwnerSpeechInputController } from "@/lib/care-report/owner-speech-input";
import { createOwnerMediaAssetFromFile, getOwnerMediaSignedUrl, type MediaAssetListItem } from "@/lib/media/owner-media-client";
import { DEFAULT_REVISIT_REMINDER_DAYS } from "@/lib/notification-settings";
import { fetchOwnerAppointmentVisitWeight } from "@/lib/owner-appointment-visit-weight";
import { addDate, currentDateInTimeZone } from "@/lib/utils";
import type { Appointment, MediaKind, Pet, Service } from "@/types/domain";

export type CareReport = {
  reportText: string;
};

type DraftResponse = {
  draft: {
    afterMediaAssetId?: string | null;
    nextRecommendedVisitDate?: string | null;
    reportText?: string | null;
    careReportAiDraft?: unknown;
    careReportPhotoConsent?: boolean;
  } | null;
};

export type OwnerCareReportDevelopmentFixture = {
  items?: MediaAssetListItem[];
  draft?: DraftResponse["draft"];
  visitWeightKg?: number | null;
};

export type OwnerCareReportInitialData = {
  items: MediaAssetListItem[];
  selectedIds: Partial<Record<"grooming_before" | "grooming_after", string>>;
  signedUrl: string;
  nextDate: string | null;
  sourceText: string;
  revisionText: string;
  report: CareReport | null;
  visitWeightKg: number | null;
  recoveredDraft: ReturnType<typeof readOwnerCareReportLocalDraft>;
};

export function normalizeCareReport(value: unknown): CareReport | null {
  if (typeof value === "string") return value.trim() ? { reportText: value.trim() } : null;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.reportText === "string" && row.reportText.trim()) return { reportText: row.reportText.trim().slice(0, 4000) };
  const legacyParts = [
    row.oneLineSummary,
    row.treatmentSummary,
    row.conditionSummary,
    row.groomingResponse,
    ...(Array.isArray(row.homeCareTips) ? row.homeCareTips : []),
    row.nextVisitGuide,
  ].filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim());
  const reportText = legacyParts.filter((part, index) => legacyParts.indexOf(part) === index).join(" ").slice(0, 4000);
  return reportText ? { reportText } : null;
}

function resizeTextarea(element: HTMLTextAreaElement | null, minHeight: number, maxHeight: number) {
  if (!element) return;
  element.style.height = "auto";
  const nextHeight = Math.min(Math.max(element.scrollHeight, minHeight), maxHeight);
  element.style.height = `${nextHeight}px`;
  element.style.overflowY = element.scrollHeight > maxHeight ? "auto" : "hidden";
}

function clampReminderDays(value: number) {
  return Math.min(Math.max(Math.round(Number.isFinite(value) ? value : DEFAULT_REVISIT_REMINDER_DAYS), 1), 365);
}

function reminderDaysBetween(today: string, target: string) {
  const difference = (new Date(`${target}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000;
  return clampReminderDays(difference);
}

export async function prepareOwnerCareReportInitialData({
  shopId,
  appointmentId,
  publishedCareReport,
  developmentFixture,
}: {
  shopId: string;
  appointmentId: string;
  publishedCareReport: CareReport | null;
  developmentFixture?: OwnerCareReportDevelopmentFixture;
}): Promise<OwnerCareReportInitialData> {
  const recoveredDraft = publishedCareReport ? null : readOwnerCareReportLocalDraft(shopId, appointmentId);
  if (developmentFixture) {
    const draft = developmentFixture.draft ?? null;
    const items = developmentFixture.items ?? [];
    const firstBefore = items.find((item) => item.mediaAsset.media_kind === "grooming_before")?.mediaAsset.id;
    const firstAfter = draft?.afterMediaAssetId ?? items.find((item) => item.mediaAsset.media_kind === "grooming_after")?.mediaAsset.id;
    return {
      items,
      selectedIds: recoveredDraft?.selectedIds ?? { grooming_before: firstBefore, grooming_after: firstAfter },
      signedUrl: "",
      nextDate: recoveredDraft?.nextDate ?? draft?.nextRecommendedVisitDate ?? null,
      sourceText: recoveredDraft?.sourceText ?? "",
      revisionText: recoveredDraft?.revisionText ?? "",
      report: normalizeCareReport(recoveredDraft?.reportText ?? draft?.reportText ?? draft?.careReportAiDraft ?? publishedCareReport),
      visitWeightKg: developmentFixture.visitWeightKg ?? null,
      recoveredDraft,
    };
  }

  const mediaQuery = new URLSearchParams({ shopId, appointmentId, includeVariants: "true", limit: "40" });
  const draftQuery = new URLSearchParams({ shopId, appointmentId });
  const [media, draft, visitWeight] = await Promise.all([
    fetchApiJsonWithAuth<{ items: MediaAssetListItem[] }>(`/api/owner/media/assets?${mediaQuery.toString()}`, { cache: "no-store" }),
    fetchApiJsonWithAuth<DraftResponse>(`/api/owner/grooming-record-drafts?${draftQuery.toString()}`, { cache: "no-store" }),
    fetchOwnerAppointmentVisitWeight(shopId, appointmentId),
  ]);
  const items = media.items.filter((item) => item.mediaAsset.media_kind === "grooming_before" || item.mediaAsset.media_kind === "grooming_after");
  const firstBefore = items.find((item) => item.mediaAsset.media_kind === "grooming_before")?.mediaAsset.id;
  const firstAfter = draft.draft?.afterMediaAssetId ?? items.find((item) => item.mediaAsset.media_kind === "grooming_after")?.mediaAsset.id;
  const selectedIds = recoveredDraft?.selectedIds ?? { grooming_before: firstBefore, grooming_after: firstAfter };
  const selectedItem = items.find((item) => item.mediaAsset.id === selectedIds.grooming_after) ?? null;
  let signedUrl = "";
  if (selectedItem) {
    try {
      signedUrl = await getOwnerMediaSignedUrl(shopId, selectedItem.mediaAsset.id, "provider_ready");
    } catch {
      signedUrl = "";
    }
  }
  return {
    items,
    selectedIds,
    signedUrl,
    nextDate: recoveredDraft?.nextDate ?? draft.draft?.nextRecommendedVisitDate ?? null,
    sourceText: recoveredDraft?.sourceText ?? "",
    revisionText: recoveredDraft?.revisionText ?? "",
    report: normalizeCareReport(recoveredDraft?.reportText ?? draft.draft?.reportText ?? draft.draft?.careReportAiDraft ?? publishedCareReport),
    visitWeightKg: visitWeight.current?.weightKg ?? null,
    recoveredDraft,
  };
}

export default function OwnerAiCareReportSheet({
  shopId,
  appointment,
  pet,
  services,
  staffName,
  publishedCareReport = null,
  developmentFixture,
  initialData,
  revisitReminderDefaultDays = DEFAULT_REVISIT_REMINDER_DAYS,
  onClose,
  onReturnToDetail,
  onPublished,
}: {
  shopId: string;
  appointment: Appointment;
  pet: Pet;
  services: Service[];
  staffName: string;
  publishedCareReport?: CareReport | null;
  /** Development-only no-network seam used by the real sheet preview. */
  developmentFixture?: OwnerCareReportDevelopmentFixture;
  initialData?: OwnerCareReportInitialData;
  revisitReminderDefaultDays?: number;
  onClose: () => void;
  onReturnToDetail: () => void;
  onPublished: () => void;
}) {
  const cameraInputId = useId();
  const albumInputId = useId();
  const exitDialogTitleId = useId();
  const voiceControllerRef = useRef<OwnerSpeechInputController | null>(null);
  const voiceSessionRef = useRef(0);
  const lastVoiceTranscriptRef = useRef("");
  const generationInFlightRef = useRef(false);
  const reportTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const exitDialogRef = useRef<HTMLElement | null>(null);
  const exitPrimaryActionRef = useRef<HTMLButtonElement | null>(null);
  const exitReturnFocusRef = useRef<HTMLElement | null>(null);
  const exitHistoryActiveRef = useRef(false);
  const exitAfterHistoryRef = useRef<"dismiss" | "close" | null>(null);
  const reminderHistoryActiveRef = useRef(false);
  const viewportBaselineHeightRef = useRef(0);
  const initialRecoveredDraftRef = useRef(initialData?.recoveredDraft ?? null);
  const activeKind: Extract<MediaKind, "grooming_before" | "grooming_after"> = "grooming_after";
  const [items, setItems] = useState<MediaAssetListItem[]>(initialData?.items ?? []);
  const [selectedIds, setSelectedIds] = useState<Partial<Record<"grooming_before" | "grooming_after", string>>>(initialData?.selectedIds ?? {});
  const [signedUrl, setSignedUrl] = useState(initialData?.signedUrl ?? "");
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>(() => {
    const selectedAfterId = initialData?.selectedIds.grooming_after;
    return selectedAfterId && initialData?.signedUrl ? { [selectedAfterId]: initialData.signedUrl } : {};
  });
  // Care-report photos are included when a suitable grooming-after asset exists.
  // Missing photos never block drafting, generation, saving, or publishing.
  const photoConsent = true;
  const [visitWeightKg, setVisitWeightKg] = useState<number | null>(initialData?.visitWeightKg ?? null);
  const [nextDate, setNextDate] = useState<string | null>(initialData?.nextDate ?? null);
  const [sourceText, setSourceText] = useState(initialData?.sourceText ?? "");
  const [revisionText, setRevisionText] = useState(initialData?.revisionText ?? "");
  const [report, setReport] = useState<CareReport | null>(initialData?.report ?? null);
  const [loading, setLoading] = useState(!initialData);
  const [initialLoadError, setInitialLoadError] = useState("");
  const [action, setAction] = useState<"upload" | "generate" | "save" | "publish" | null>(null);
  const [recording, setRecording] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState("");
  const [error, setError] = useState("");
  const [hasEdited, setHasEdited] = useState(Boolean(initialData?.recoveredDraft));
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [showReminderSheet, setShowReminderSheet] = useState(false);
  const [pendingReminderMode, setPendingReminderMode] = useState<"default" | "custom">("default");
  const [pendingReminderDays, setPendingReminderDays] = useState(DEFAULT_REVISIT_REMINDER_DAYS);
  const [isReportEditing, setIsReportEditing] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [visualViewport, setVisualViewport] = useState<{ height: number; offsetTop: number } | null>(null);

  const selectedService = useMemo(() => services.find((service) => service.id === appointment.service_id), [appointment.service_id, services]);
  const isPublished = Boolean(publishedCareReport);
  const selectedId = selectedIds[activeKind] ?? "";
  const selectedItem = items.find((item) => item.mediaAsset.id === selectedId) ?? null;
  const photoItems = useMemo(() => items.filter((item) => (item.mediaAsset.media_kind === "grooming_before" || item.mediaAsset.media_kind === "grooming_after") && item.mediaAsset.status === "ready"), [items]);
  const composerText = report ? revisionText : sourceText;
  const hasComposerInput = Boolean(composerText.trim());
  const defaultReminderDays = clampReminderDays(revisitReminderDefaultDays);
  const today = currentDateInTimeZone();
  const defaultReminderDate = addDate(today, defaultReminderDays);
  const resolvedReminderDate = nextDate ?? defaultReminderDate;
  const reminderOptions = useMemo(() => [defaultReminderDays, 30, 45, 60, 90].filter((days, index, values) => values.indexOf(days) === index), [defaultReminderDays]);

  useEffect(() => {
    const syncHeight = () => resizeTextarea(reportTextareaRef.current, 128, 288);
    syncHeight();
    window.addEventListener("resize", syncHeight);
    return () => window.removeEventListener("resize", syncHeight);
  }, [isReportEditing, report?.reportText]);

  useEffect(() => {
    const syncHeight = () => resizeTextarea(composerTextareaRef.current, 84, 144);
    syncHeight();
    window.addEventListener("resize", syncHeight);
    return () => window.removeEventListener("resize", syncHeight);
  }, [composerText]);

  useEffect(() => {
    const viewport = window.visualViewport;
    const syncViewport = () => {
      const height = viewport?.height ?? window.innerHeight;
      const offsetTop = viewport?.offsetTop ?? 0;
      const activeElement = document.activeElement;
      const isTextInput = activeElement instanceof HTMLTextAreaElement || activeElement instanceof HTMLInputElement;
      if (!isTextInput) viewportBaselineHeightRef.current = Math.max(window.innerHeight, height + offsetTop);
      if (!viewportBaselineHeightRef.current) viewportBaselineHeightRef.current = Math.max(window.innerHeight, height + offsetTop);
      const keyboardOpen = isTextInput && viewportBaselineHeightRef.current - (height + offsetTop) > 120;
      setVisualViewport({ height, offsetTop });
      setIsKeyboardOpen(keyboardOpen);
    };
    const syncAfterFocusChange = () => requestAnimationFrame(syncViewport);
    syncViewport();
    viewport?.addEventListener("resize", syncViewport);
    viewport?.addEventListener("scroll", syncViewport);
    window.addEventListener("resize", syncViewport);
    document.addEventListener("focusin", syncAfterFocusChange);
    document.addEventListener("focusout", syncAfterFocusChange);
    return () => {
      viewport?.removeEventListener("resize", syncViewport);
      viewport?.removeEventListener("scroll", syncViewport);
      window.removeEventListener("resize", syncViewport);
      document.removeEventListener("focusin", syncAfterFocusChange);
      document.removeEventListener("focusout", syncAfterFocusChange);
    };
  }, []);

  useEffect(() => {
    if (!isKeyboardOpen) return;
    const activeElement = document.activeElement;
    if (!(activeElement instanceof HTMLElement)) return;
    requestAnimationFrame(() => activeElement.scrollIntoView({ block: "center" }));
  }, [isKeyboardOpen, visualViewport?.height]);

  useEffect(() => {
    if (!showExitConfirm) return;

    const restoreFocus = () => requestAnimationFrame(() => exitReturnFocusRef.current?.focus());
    const handlePopState = () => {
      exitHistoryActiveRef.current = false;
      setShowExitConfirm(false);
      const nextAction = exitAfterHistoryRef.current;
      exitAfterHistoryRef.current = null;
      if (nextAction === "close") onClose();
      else restoreFocus();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        dismissExitConfirm();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(exitDialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])") ?? []);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    if (!exitHistoryActiveRef.current) {
      window.history.pushState({ ...window.history.state, petManagerExitConfirm: true }, "");
      exitHistoryActiveRef.current = true;
    }
    window.addEventListener("popstate", handlePopState);
    document.addEventListener("keydown", handleKeyDown);
    exitPrimaryActionRef.current?.focus();
    return () => {
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showExitConfirm, onClose]);

  useEffect(() => {
    if (!showReminderSheet) return;
    const handlePopState = () => {
      reminderHistoryActiveRef.current = false;
      setShowReminderSheet(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (reminderHistoryActiveRef.current) window.history.back();
      else setShowReminderSheet(false);
    };
    if (!reminderHistoryActiveRef.current) {
      window.history.pushState({ ...window.history.state, petManagerReminderSheet: true }, "");
      reminderHistoryActiveRef.current = true;
    }
    window.addEventListener("popstate", handlePopState);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showReminderSheet]);

  async function load() {
    setLoading(true);
    setInitialLoadError("");
    try {
      const prepared = await prepareOwnerCareReportInitialData({
        shopId,
        appointmentId: appointment.id,
        publishedCareReport,
        developmentFixture,
      });
      initialRecoveredDraftRef.current = prepared.recoveredDraft;
      setItems(prepared.items);
      setSelectedIds(prepared.selectedIds);
      setSignedUrl(prepared.signedUrl);
      if (prepared.selectedIds.grooming_after && prepared.signedUrl) {
        setPhotoUrls((current) => ({ ...current, [prepared.selectedIds.grooming_after as string]: prepared.signedUrl }));
      }
      setNextDate(prepared.nextDate);
      setSourceText(prepared.sourceText);
      setRevisionText(prepared.revisionText);
      setReport(prepared.report);
      setVisitWeightKg(prepared.visitWeightKg);
      setHasEdited(Boolean(prepared.recoveredDraft));
    } catch {
      setInitialLoadError("케어리포트를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialData) return;
    void load();
  }, [appointment.id, developmentFixture, initialData, publishedCareReport, shopId]);

  useEffect(() => {
    if (isPublished) {
      clearOwnerCareReportLocalDraft(shopId, appointment.id);
      return;
    }
    if (!hasEdited || loading) return;
    writeOwnerCareReportLocalDraft(shopId, appointment.id, {
      sourceText,
      revisionText,
      reportText: report?.reportText ?? null,
      photoConsent,
      weight: visitWeightKg === null ? "" : String(visitWeightKg),
      nextDate,
      selectedIds,
    });
  }, [appointment.id, hasEdited, isPublished, loading, nextDate, photoConsent, report, revisionText, selectedIds, shopId, sourceText, visitWeightKg]);

  useEffect(() => () => {
    voiceSessionRef.current += 1;
    void voiceControllerRef.current?.stop();
    voiceControllerRef.current = null;
  }, []);

  useEffect(() => {
    let active = true;
    if (developmentFixture) { setSignedUrl(""); return; }
    if (!selectedItem) { setSignedUrl(""); return; }
    if (initialData?.selectedIds.grooming_after === selectedItem.mediaAsset.id && initialData.signedUrl) {
      setSignedUrl(initialData.signedUrl);
      return;
    }
    void getOwnerMediaSignedUrl(shopId, selectedItem.mediaAsset.id, "provider_ready")
      .then((result) => { if (active) setSignedUrl(result); })
      .catch(() => { if (active) setSignedUrl(""); });
    return () => { active = false; };
  }, [developmentFixture, initialData?.selectedIds.grooming_after, initialData?.signedUrl, selectedItem, shopId]);

  useEffect(() => {
    let active = true;
    if (developmentFixture || !photoItems.length) return;
    void Promise.all(photoItems.map(async (item) => {
      try {
        const url = await getOwnerMediaSignedUrl(shopId, item.mediaAsset.id, "provider_ready");
        return [item.mediaAsset.id, url] as const;
      } catch {
        return null;
      }
    })).then((results) => {
      if (!active) return;
      const resolved = Object.fromEntries(results.filter((result): result is readonly [string, string] => Boolean(result)));
      if (Object.keys(resolved).length) setPhotoUrls((current) => ({ ...current, ...resolved }));
    });
    return () => { active = false; };
  }, [developmentFixture, photoItems, shopId]);

  async function upload(file: File) {
    if (developmentFixture) {
      setError("개발 미리보기에서는 사진을 추가할 수 없습니다.");
      return;
    }
    setAction("upload");
    setError("");
    try {
      const result = await createOwnerMediaAssetFromFile({ shopId, guardianId: appointment.guardian_id, petId: appointment.pet_id, appointmentId: appointment.id, groomingRecordId: null }, activeKind, file);
      setItems((current) => [{ mediaAsset: result.mediaAsset, variants: result.variant ? [result.variant] : [] }, ...current]);
      setSelectedIds((current) => ({ ...current, [activeKind]: result.mediaAsset.id }));
      setHasEdited(true);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "사진을 등록하지 못했습니다.");
    } finally { setAction(null); }
  }

  async function persistDraft(): Promise<boolean> {
    if (developmentFixture) {
      setError("개발 미리보기에서는 서버 저장을 실행하지 않습니다.");
      return false;
    }
    try {
      await fetchApiJsonWithAuth("/api/owner/grooming-record-drafts", {
        method: "PUT",
        body: JSON.stringify({ shopId, appointmentId: appointment.id, treatmentNotes: "", specialNotes: "", internalNotes: "", nextRecommendedVisitDate: resolvedReminderDate, afterMediaAssetId: selectedIds.grooming_after ?? null, careReportPhotoConsent: photoConsent }),
      });
      if (report) {
        await fetchApiJsonWithAuth("/api/owner/care-reports", { method: "PATCH", body: JSON.stringify({ shopId, appointmentId: appointment.id, reportText: report.reportText, photoConsent, action: "save_draft" }) });
      }
      return true;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "임시저장하지 못했습니다.");
      return false;
    }
  }

  async function saveDraft() {
    setAction("save");
    setError("");
    try {
      if (await persistDraft()) setHasEdited(false);
    }
    finally { setAction(null); }
  }

  async function generate() {
    if (developmentFixture) {
      setError("개발 미리보기에서는 케어리포트를 만들지 않습니다.");
      return;
    }
    if (generationInFlightRef.current) return;
    const input = [sourceText.trim(), revisionText.trim()].filter(Boolean).join("\n");
    if (!input) return;
    generationInFlightRef.current = true;
    setAction("generate");
    setError("");
    try {
      const result = await fetchApiJsonWithAuth<{ reportText: string }>("/api/owner/care-reports", {
        method: "POST",
        body: JSON.stringify(report
          ? { shopId, appointmentId: appointment.id, sourceText: "", currentReportText: report.reportText, revisionRequest: revisionText, photoConsent }
          : { shopId, appointmentId: appointment.id, sourceText: input, photoConsent }),
      });
      setReport({ reportText: result.reportText });
      setRevisionText("");
      setIsReportEditing(false);
      setHasEdited(true);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "AI 케어리포트를 만들지 못했습니다.");
    } finally {
      generationInFlightRef.current = false;
      setAction(null);
    }
  }

  async function publish() {
    if (developmentFixture) {
      setError("개발 미리보기에서는 발행하지 않습니다.");
      return;
    }
    if (!report) return;
    setAction("publish");
    setError("");
    try {
      if (!(await persistDraft())) return;
      await fetchApiJsonWithAuth("/api/owner/care-reports", { method: "PATCH", body: JSON.stringify({ shopId, appointmentId: appointment.id, reportText: report.reportText, photoConsent, action: "publish" }) });
      setHasEdited(false);
      clearOwnerCareReportLocalDraft(shopId, appointment.id);
      onPublished();
      onClose();
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "리포트를 보내지 못했습니다.");
    } finally { setAction(null); }
  }

  function requestClose() {
    if (developmentFixture) {
      if (hasEdited) {
        writeOwnerCareReportLocalDraft(shopId, appointment.id, {
          sourceText,
          revisionText,
          reportText: report?.reportText ?? null,
          photoConsent,
          weight: visitWeightKg === null ? "" : String(visitWeightKg),
          nextDate,
          selectedIds,
        });
      }
      onClose();
      return;
    }
    if (hasEdited) {
      exitReturnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setShowExitConfirm(true);
      return;
    }
    onClose();
  }

  function finishExitConfirm(nextAction: "dismiss" | "close") {
    if (exitHistoryActiveRef.current) {
      exitAfterHistoryRef.current = nextAction;
      window.history.back();
      return;
    }
    setShowExitConfirm(false);
    if (nextAction === "close") onClose();
    else requestAnimationFrame(() => exitReturnFocusRef.current?.focus());
  }

  function dismissExitConfirm() {
    finishExitConfirm("dismiss");
  }

  function discardAndClose() {
    const recoveredDraft = initialRecoveredDraftRef.current;
    if (recoveredDraft) writeOwnerCareReportLocalDraft(shopId, appointment.id, recoveredDraft);
    else clearOwnerCareReportLocalDraft(shopId, appointment.id);
    finishExitConfirm("close");
  }

  async function saveAndExit() {
    setAction("save");
    setError("");
    try {
      if (await persistDraft()) {
        setHasEdited(false);
        finishExitConfirm("close");
      }
    } finally {
      setAction(null);
    }
  }

  function openReminderSettings() {
    setPendingReminderMode(nextDate ? "custom" : "default");
    setPendingReminderDays(nextDate ? reminderDaysBetween(today, nextDate) : defaultReminderDays);
    setShowReminderSheet(true);
  }

  function dismissReminderSettings() {
    if (reminderHistoryActiveRef.current) window.history.back();
    else {
      setShowReminderSheet(false);
    }
  }

  function applyReminderSettings() {
    setNextDate(pendingReminderMode === "custom" ? addDate(today, pendingReminderDays) : null);
    setHasEdited(true);
    dismissReminderSettings();
  }

  function getVoiceMessage(code: OwnerSpeechInputErrorCode) {
    if (code === "PERMISSION_DENIED") return "마이크 권한이 필요합니다. 권한을 허용한 뒤 다시 시도해 주세요.";
    if (code === "UNAVAILABLE") return "이 기기에서는 음성 입력을 사용할 수 없습니다. 텍스트로 입력해 주세요.";
    if (code === "EMPTY") return "음성을 인식하지 못했습니다. 다시 시도해 주세요.";
    if (code === "CANCELLED") return "음성 입력을 취소했습니다.";
    return "음성 입력을 가져오지 못했습니다. 다시 시도해 주세요.";
  }

  async function toggleVoice() {
    if (recording) {
      voiceSessionRef.current += 1;
      await voiceControllerRef.current?.stop();
      voiceControllerRef.current = null;
      setRecording(false);
      return;
    }
    const session = voiceSessionRef.current + 1;
    voiceSessionRef.current = session;
    lastVoiceTranscriptRef.current = "";
    setVoiceMessage("");
    setRecording(true);
    try {
      voiceControllerRef.current = await startOwnerCareReportSpeechInput({
        onResult: (transcript) => {
          if (voiceSessionRef.current !== session || transcript === lastVoiceTranscriptRef.current) return;
          lastVoiceTranscriptRef.current = transcript;
          if (report) {
            setRevisionText((current) => `${current}${current ? "\n" : ""}${transcript}`.slice(0, 1000));
          } else {
            setSourceText((current) => `${current}${current ? "\n" : ""}${transcript}`.slice(0, 4000));
          }
          setHasEdited(true);
        },
        onError: (code) => {
          if (voiceSessionRef.current !== session || code === "CANCELLED") return;
          setVoiceMessage(getVoiceMessage(code));
          setRecording(false);
        },
        onEnd: () => {
          if (voiceSessionRef.current !== session) return;
          voiceControllerRef.current = null;
          setRecording(false);
        },
      });
    } catch {
      if (voiceSessionRef.current === session) setRecording(false);
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0b1b2c]/35 px-5">
        <section data-testid="care-report-loading-plane" aria-busy="true" aria-label="케어리포트 준비 중" className="flex min-h-24 w-full max-w-[360px] items-center justify-center rounded-[18px] border border-[#dce7f2] bg-white">
          <LoaderCircle className="h-5 w-5 animate-spin text-[#2f6fd6] motion-reduce:animate-none" aria-hidden="true" />
        </section>
      </div>
    );
  }

  if (initialLoadError) {
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0b1b2c]/35 px-5">
        <section role="alertdialog" aria-modal="true" aria-label="케어리포트 불러오기 실패" className="w-full max-w-[360px] rounded-[18px] border border-[#dce7f2] bg-white p-6">
          <p className="text-[16px] font-normal leading-6 text-[#101a31]">{initialLoadError}</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={onClose} className="min-h-11 rounded-[10px] border border-[#d7e4f2] bg-white px-3 text-[16px] font-medium leading-6 text-[#526b84]">닫기</button>
            <button type="button" onClick={() => void load()} className="min-h-11 rounded-[10px] bg-[#2f6fd6] px-3 text-[16px] font-medium leading-6 text-white">다시 시도</button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[80] flex justify-center bg-[#0b1b2c]/35" role="dialog" aria-modal="true" aria-label="케어리포트 작성">
      <section
        className="flex h-[100dvh] min-h-0 w-full max-w-[430px] flex-col overflow-hidden bg-white"
        style={visualViewport ? { height: `${visualViewport.height}px`, marginTop: `${visualViewport.offsetTop}px` } : undefined}
      >
        <header className="flex shrink-0 items-start justify-between border-b border-[#dce7f2] bg-white px-5 pb-3 pt-[calc(env(safe-area-inset-top)+12px)]">
          <div className="min-w-0 pr-2"><h1 className="text-[20px] font-semibold leading-7 tracking-[-0.015em] text-[#14213a]">케어리포트 작성</h1><p className="mt-1 text-[14px] font-normal leading-5 text-[#637890] [overflow-wrap:anywhere]">{pet.name} · {staffName || "담당 디자이너"} · {selectedService?.name ?? "서비스 확인 필요"}</p></div>
          <button type="button" onClick={requestClose} className="ml-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#eef4fa] text-[#58708a]" aria-label="닫기"><X className="h-5 w-5" /></button>
        </header>

        <div data-testid="care-report-scroll-region" role="region" aria-label="케어리포트 내용" tabIndex={0} className="min-h-0 max-h-[calc(100dvh-180px)] flex-none overflow-y-auto px-5 pb-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#2563eb]" style={{ flex: "1 1 auto", maxHeight: "none" }}>
          <div data-testid="care-report-summary">
          <section className="pb-0 pt-3" aria-label="미용 사진">
            <div className="mb-2 flex min-h-6 items-center justify-between gap-3">
              <h2 className="text-[14px] font-medium leading-5 text-[#526b84]">오늘 사진</h2>
              <span className="text-[13px] font-normal leading-5 text-[#64748b]">{photoItems.length ? `${photoItems.length}장` : "사진 없음"}</span>
            </div>
            <input id={cameraInputId} type="file" accept="image/*" capture="environment" disabled={action !== null} className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(file); }} />
            <input id={albumInputId} type="file" accept="image/*" disabled={action !== null} className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(file); }} />
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="list" aria-label="등록된 미용 사진">
              <div className="flex h-24 w-[108px] shrink-0 flex-col justify-between rounded-[14px] border border-dashed border-[#cbd8e5] bg-[#fafcfe] p-1.5" role="listitem">
                <span className="px-1 pt-1 text-center text-[13px] font-medium leading-5 text-[#64748b]">사진 추가</span>
                <div className="flex items-center justify-center gap-1">
                  <label htmlFor={cameraInputId} aria-label="미용 사진 촬영" className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-[#d7e4f2] bg-white text-[#52708c] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#2563eb] ${action !== null ? "pointer-events-none opacity-50" : "cursor-pointer"}`}><Camera className="h-4 w-4" aria-hidden="true" /></label>
                  <label htmlFor={albumInputId} aria-label="미용 사진 선택" className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-[#d7e4f2] bg-white text-[#52708c] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#2563eb] ${action !== null ? "pointer-events-none opacity-50" : "cursor-pointer"}`}><ImagePlus className="h-4 w-4" aria-hidden="true" /></label>
                </div>
              </div>
              {photoItems.map((item) => {
                const id = item.mediaAsset.id;
                const kind = item.mediaAsset.media_kind;
                const label = kind === "grooming_before" ? "미용 전" : "미용 후";
                const url = photoUrls[id] || (id === selectedId ? signedUrl : "");
                const selected = kind === "grooming_after" && id === selectedId;
                const content = <>{url ? <Image src={url} alt={`${label} 사진`} fill sizes="96px" unoptimized className="object-cover" /> : <span className="flex h-full w-full items-center justify-center bg-[#f4f7fa] text-[#71859a]"><ImagePlus className="h-5 w-5" aria-hidden="true" /><span className="sr-only">{label} 사진 미리보기 없음</span></span>}<span className="absolute bottom-1.5 left-1.5 rounded-full bg-[#101a31]/75 px-2 py-0.5 text-[12px] font-medium leading-[18px] text-white">{label}</span>{selected ? <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#2f6fd6] text-white" aria-label="케어리포트에 포함됨"><Check className="h-3.5 w-3.5" aria-hidden="true" /></span> : null}</>;
                return kind === "grooming_after" ? <div key={id} role="listitem" className="h-24 w-24 shrink-0"><button type="button" aria-pressed={selected} aria-label={`${label} 사진을 케어리포트에 포함`} onClick={() => { setSelectedIds((current) => ({ ...current, grooming_after: id })); setHasEdited(true); }} className={`relative h-full w-full overflow-hidden rounded-[14px] border bg-[#f4f7fa] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] ${selected ? "border-[#2f6fd6]" : "border-[#d7e4f2]"}`}>{content}</button></div> : <div key={id} role="listitem" className="relative h-24 w-24 shrink-0 overflow-hidden rounded-[14px] border border-[#d7e4f2] bg-[#f4f7fa]">{content}</div>;
              })}
            </div>
          </section>

          <section className="mt-3 flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-t-[14px] border border-[#e8edf3] bg-[#fbfcfe] px-3 py-px" aria-label="예약 정보">
            <div className="min-w-0 flex-1"><p className="text-[13px] leading-5 text-[#64748b]">예약 서비스</p><p className="text-[16px] font-medium leading-6 text-[#20344c] [overflow-wrap:anywhere]">{selectedService?.name ?? "서비스 확인 필요"}</p></div>
            <div><p className="text-[13px] leading-5 text-[#64748b]">오늘 몸무게</p><p className="text-[16px] font-medium leading-6 tabular-nums text-[#20344c]">{visitWeightKg === null ? "미입력" : `${visitWeightKg}kg`}</p></div>
            <button type="button" onClick={onReturnToDetail} aria-label="예약 정보 수정" className="min-h-11 shrink-0 rounded-[10px] border border-[#cbddec] bg-white px-4 text-[16px] font-medium leading-6 text-[#2f6fd6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]">수정</button>
          </section>
          <button data-testid="care-report-revisit-row" type="button" onClick={openReminderSettings} aria-haspopup="dialog" style={{ fontWeight: 400 }} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-b-[14px] border-x border-b border-[#e8edf3] bg-white px-3 py-0 text-left font-normal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#2563eb]">
            <span className="text-[16px] font-normal leading-6 text-[#526b84]">재예약 알림 설정</span>
            <span className="min-w-0 text-right text-[16px] font-normal leading-6 text-[#64748b]">{nextDate ? `${reminderDaysBetween(today, nextDate)}일 후` : `매장 기본값 · ${defaultReminderDays}일 후`} <span aria-hidden="true" className="text-[#a5b1bf]">›</span></span>
          </button>
          </div>

          {sourceText.trim() && (report || action === "generate") ? <div data-testid="care-report-user-memo" className="ml-auto mt-3 max-w-[88%] whitespace-pre-wrap rounded-[14px] rounded-br-[6px] bg-[#eef2f7] px-4 py-3 text-[16px] font-normal leading-6 text-[#414b5b] [overflow-wrap:anywhere]">{sourceText.trim()}</div> : null}
          {action === "generate" ? <div data-testid="care-report-generation-loading" role="status" aria-live="polite" className="mt-3 flex min-h-14 items-center gap-3 rounded-[14px] border border-[#e8edf3] bg-[#fbfcfe] px-4 py-3"><LoaderCircle className="h-5 w-5 shrink-0 animate-spin text-[#2f6fd6] motion-reduce:animate-none" aria-hidden="true" /><span className="text-[14px] font-normal leading-5 text-[#64748b]">보호자에게 보낼 문장으로 정리하고 있어요</span></div> : null}
          {report ? <section data-testid="care-report-draft" className="mt-3"><div className="overflow-hidden rounded-[18px] border border-[#d8e5f4] bg-[#f6f9fd]"><div data-testid="care-report-ai-result-divider" className="flex min-h-11 items-center justify-between gap-3 px-4 pt-2"><h2 id="care-report-ai-result-title" className="flex min-w-0 items-center gap-2 text-[14px] font-medium leading-5 text-[#2f6fd6]"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#2f6fd6]" aria-hidden="true" />AI가 정리한 케어리포트</h2></div>{isReportEditing && !isPublished ? <div className="px-3 pb-3 pt-1"><textarea ref={reportTextareaRef} aria-label="케어리포트 초안" disabled={isPublished} value={report.reportText} onChange={(event) => { setReport({ reportText: event.target.value.slice(0, 4000) }); setHasEdited(true); }} maxLength={4000} wrap="soft" className="min-h-[128px] max-h-72 w-full resize-none overflow-y-auto rounded-[14px] border border-[#76a8df] bg-white px-3 py-3 text-[16px] font-normal leading-6 text-[#263b53] [overflow-wrap:anywhere] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] disabled:bg-[#f8fbfe] disabled:opacity-70" /></div> : <div role="region" aria-label="AI 케어리포트 본문" tabIndex={0} className="max-h-72 overflow-y-auto whitespace-pre-wrap px-4 pb-4 pt-1 text-[16px] font-normal leading-6 text-[#263b53] [overflow-wrap:anywhere] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#2563eb]">{report.reportText}</div>}{!isPublished ? <div className="grid grid-cols-2 gap-2 px-3 pb-3 pt-1"><button type="button" onClick={() => { if (isReportEditing) setIsReportEditing(false); else { setIsReportEditing(true); requestAnimationFrame(() => reportTextareaRef.current?.focus()); } }} disabled={action !== null} className="min-h-11 rounded-[10px] border border-[#d7e4f2] bg-white px-3 text-[16px] font-medium leading-6 text-[#44556a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] disabled:opacity-50">{isReportEditing ? "수정 완료" : "직접 수정"}</button><button type="button" onClick={() => void generate()} disabled={action !== null || !revisionText.trim()} className="min-h-11 rounded-[10px] border border-[#d7e4f2] bg-white px-3 text-[16px] font-medium leading-6 text-[#44556a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] disabled:opacity-40">다시 정리</button></div> : null}</div></section> : null}
          {error ? <p className="mt-3 rounded-[10px] border border-[#f0c4c8] bg-[#fff8f8] px-3 py-2 text-[14px] leading-5 text-[#a04455]">{error}</p> : null}
        </div>
        <footer data-testid="care-report-footer-unified" className="shrink-0 border-t border-[#d7e4f2] bg-white px-5 pt-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}>
          {isPublished ? <button type="button" onClick={onClose} className="flex min-h-12 w-full items-center justify-center rounded-[14px] bg-[#2f6fd6] px-2 text-[16px] font-semibold leading-6 text-white">닫기</button> : <section data-testid="care-report-composer" className="space-y-2">
            {report ? <h2 className="sr-only">수정 요청</h2> : <h2 className="text-[16px] font-semibold leading-6 text-[#101a31]">케어리포트 내용</h2>}
            <div data-testid="care-report-composer-input-surface" className="overflow-hidden rounded-[14px] bg-[#f7f9fc] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#2563eb]">
              <textarea ref={composerTextareaRef} disabled={isPublished} value={composerText} onChange={(event) => { if (report) setRevisionText(event.target.value.slice(0, 1000)); else setSourceText(event.target.value.slice(0, 4000)); setHasEdited(true); }} aria-label={report ? "수정 요청 입력" : "케어리포트 내용 입력"} placeholder={report ? "수정할 부분을 적어 주세요" : "오늘 미용 내용을 적어 주세요"} wrap="soft" className="min-h-[84px] max-h-36 w-full resize-none overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden bg-transparent px-3 pt-3 text-[16px] font-normal leading-6 text-[#263b53] [overflow-wrap:anywhere] outline-none disabled:opacity-50" />
              <div data-testid="care-report-composer-controls" className="flex min-h-11 items-center justify-end gap-0 px-1.5 py-0.5">
                <button type="button" onClick={() => void toggleVoice()} disabled={isPublished || action !== null} aria-label={recording ? "음성 입력 중지" : "음성 입력 시작"} aria-pressed={recording} className="flex h-11 w-11 items-center justify-center rounded-full bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] disabled:opacity-50"><span className={`flex h-[30px] w-[30px] items-center justify-center rounded-full border ${recording ? "border-[#f0b8bf] bg-[#fff7f8] text-[#a04455]" : "border-[#d7e4f2] bg-white text-[#52708c]"}`}>{recording ? <Pause className="h-3.5 w-3.5" aria-hidden="true" /> : <Mic className="h-3.5 w-3.5" aria-hidden="true" />}</span></button>
                <button type="button" onClick={() => void generate()} disabled={isPublished || action !== null || !hasComposerInput} aria-label="케어리포트 만들기" className="flex h-11 w-11 items-center justify-center rounded-full bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] disabled:opacity-40"><span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[#111A30] text-white"><ArrowUp className="h-4 w-4" aria-hidden="true" /></span></button>
              </div>
            </div>
            {voiceMessage ? <p className="text-[13px] leading-5 text-[#64748b]" role="status">{voiceMessage}</p> : null}
            <div data-testid="care-report-keyboard-aware-actions" data-keyboard-hidden={isKeyboardOpen ? "true" : "false"} aria-hidden={isKeyboardOpen} className={`grid grid-cols-2 gap-2 ${isKeyboardOpen ? "hidden" : ""}`}>
              <button type="button" onClick={() => setShowPublishConfirm(true)} disabled={action !== null || !report} className="flex min-h-12 min-w-0 items-center justify-center gap-1.5 rounded-[14px] bg-[#2f6fd6] px-2 text-[16px] font-semibold leading-6 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] disabled:opacity-40"><Send className="h-4 w-4 shrink-0" aria-hidden="true" />이대로 보내기</button>
              <button type="button" onClick={() => void saveDraft()} disabled={action !== null} className="flex min-h-12 min-w-0 items-center justify-center gap-1.5 rounded-[14px] border border-[#cbddec] bg-white px-2 text-[16px] font-medium leading-6 text-[#4d6d89] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] disabled:opacity-50"><Check className="h-4 w-4 shrink-0" aria-hidden="true" />{action === "save" ? "저장 중…" : "임시저장"}</button>
            </div>
          </section>}
        </footer>
      </section>
      {showReminderSheet ? <div className="fixed inset-0 z-[82] flex items-end justify-center bg-[#0b1b2c]/35" onMouseDown={(event) => { if (event.target === event.currentTarget) dismissReminderSettings(); }}><section role="dialog" aria-modal="true" aria-labelledby="care-report-reminder-title" className="w-full max-w-[430px] rounded-t-[18px] border border-[#dce7f2] bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-5">
        <div className="flex min-h-11 items-center gap-2">
          <h2 id="care-report-reminder-title" className="min-w-0 flex-1 text-[20px] font-semibold leading-7 text-[#101a31]">재예약 알림 설정</h2>
          <button type="button" onClick={dismissReminderSettings} aria-label="닫기" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#526b84] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]"><X className="h-5 w-5" aria-hidden="true" /></button>
        </div>
        <div className="mt-3 divide-y divide-[#e8edf3] border-y border-[#e8edf3]" role="radiogroup" aria-label="재예약 알림 기간">
          <button type="button" role="radio" aria-checked={pendingReminderMode === "default"} onClick={() => setPendingReminderMode("default")} className="flex min-h-14 w-full items-center gap-3 py-2.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#2563eb]"><span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${pendingReminderMode === "default" ? "border-[#2f6fd6] bg-[#2f6fd6] text-white" : "border-[#cbd8e5] bg-white text-transparent"}`}><Check className="h-3.5 w-3.5" aria-hidden="true" /></span><span className="block text-[16px] font-medium leading-6 text-[#101a31]">매장 기본값 · {defaultReminderDays}일 후</span></button>
          {reminderOptions.filter((days) => days !== defaultReminderDays).map((days) => <button key={days} type="button" role="radio" aria-checked={pendingReminderMode === "custom" && pendingReminderDays === days} onClick={() => { setPendingReminderMode("custom"); setPendingReminderDays(days); }} className="flex min-h-14 w-full items-center gap-3 py-2.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#2563eb]"><span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${pendingReminderMode === "custom" && pendingReminderDays === days ? "border-[#2f6fd6] bg-[#2f6fd6] text-white" : "border-[#cbd8e5] bg-white text-transparent"}`}><Check className="h-3.5 w-3.5" aria-hidden="true" /></span><span className="block text-[16px] font-medium leading-6 text-[#101a31]">{days}일 후</span></button>)}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={dismissReminderSettings} className="min-h-12 rounded-[10px] border border-[#d7e4f2] bg-white px-3 text-[16px] font-medium leading-6 text-[#526b84]">취소</button><button type="button" onClick={applyReminderSettings} className="min-h-12 rounded-[10px] bg-[#2f6fd6] px-3 text-[16px] font-medium leading-6 text-white">적용</button></div>
      </section></div> : null}
      {showPublishConfirm ? <div className="fixed inset-0 z-[81] flex items-center justify-center bg-[#0b1b2c]/40 px-5"><section className="w-full max-w-[360px] rounded-[18px] border border-[#d4e3f2] bg-white p-5"><h2 className="text-[20px] font-semibold leading-7 text-[#1b3048]">작성한 케어리포트를<br />보호자에게 보낼까요?</h2><div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={() => setShowPublishConfirm(false)} className="h-11 rounded-[11px] border border-[#d4e3f2] text-[16px] font-medium text-[#58708a]">계속 수정</button><button type="button" onClick={() => { setShowPublishConfirm(false); void publish(); }} className="h-11 rounded-[11px] bg-[#2f6fd6] text-[16px] font-semibold text-white">확인하고 보내기</button></div></section></div> : null}
      {showExitConfirm ? <div className="fixed inset-0 z-[81] flex items-center justify-center bg-[#0b1b2c]/40 px-5" onMouseDown={(event) => { if (event.target === event.currentTarget) dismissExitConfirm(); }}><section ref={exitDialogRef} role="dialog" aria-modal="true" aria-labelledby={exitDialogTitleId} className="w-full max-w-[360px] rounded-[18px] border border-[#d4e3f2] bg-white p-6"><h2 id={exitDialogTitleId} className="text-[20px] font-semibold leading-7 text-[#1b3048]">나가기 전에 저장할까요?</h2><div className="mt-5 grid gap-2"><button ref={exitPrimaryActionRef} type="button" onClick={() => void saveAndExit()} disabled={action !== null} className="min-h-12 rounded-[10px] bg-[#2f6fd6] px-3 text-[16px] font-medium leading-6 text-white disabled:opacity-50">임시저장 후 나가기</button><button type="button" onClick={dismissExitConfirm} className="min-h-12 rounded-[10px] border border-[#d4e3f2] bg-white px-3 text-[16px] font-medium leading-6 text-[#58708a]">계속 작성</button><button type="button" onClick={discardAndClose} className="min-h-11 rounded-[10px] bg-transparent px-3 text-[16px] font-medium leading-6 text-[#8a5d63]">저장하지 않고 나가기</button></div></section></div> : null}
    </div>
  );
}
