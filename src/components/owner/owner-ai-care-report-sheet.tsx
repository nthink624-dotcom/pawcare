"use client";

import { ArrowUp, Camera, Check, ImagePlus, Mic, Pause, Send, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { fetchApiJsonWithAuth } from "@/lib/api";
import { clearOwnerCareReportLocalDraft, readOwnerCareReportLocalDraft, writeOwnerCareReportLocalDraft } from "@/lib/care-report/owner-care-report-local-draft";
import { startOwnerCareReportSpeechInput, type OwnerSpeechInputErrorCode, type OwnerSpeechInputController } from "@/lib/care-report/owner-speech-input";
import { createOwnerMediaAssetFromFile, type MediaAssetListItem } from "@/lib/media/owner-media-client";
import { fetchOwnerAppointmentVisitWeight } from "@/lib/owner-appointment-visit-weight";
import type { Appointment, MediaKind, Pet, Service } from "@/types/domain";

export type CareReport = {
  oneLineSummary: string;
  treatmentSummary: string;
  conditionSummary: string;
  groomingResponse: string;
  homeCareTips: string[];
  nextVisitGuide: string;
};

type DraftResponse = {
  draft: {
    afterMediaAssetId?: string | null;
    nextRecommendedVisitDate?: string | null;
    careReportAiDraft?: CareReport | null;
    careReportPhotoConsent?: boolean;
  } | null;
};

export type OwnerCareReportDevelopmentFixture = {
  items?: MediaAssetListItem[];
  draft?: DraftResponse["draft"];
  visitWeightKg?: number | null;
};

function createObservations(source: string, nextDate: string | null) {
  return {
    coat: [],
    skin: [],
    ears: [],
    pawsAndNails: [],
    groomingResponse: [],
    customNote: [source.trim(), nextDate ? `다음 권장 방문일: ${nextDate}` : ""].filter(Boolean).join("\n").slice(0, 1000),
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
  onClose: () => void;
  onReturnToDetail: () => void;
  onPublished: () => void;
}) {
  const cameraInputId = useId();
  const albumInputId = useId();
  const voiceControllerRef = useRef<OwnerSpeechInputController | null>(null);
  const voiceSessionRef = useRef(0);
  const lastVoiceTranscriptRef = useRef("");
  const generationInFlightRef = useRef(false);
  const activeKind: Extract<MediaKind, "grooming_before" | "grooming_after"> = "grooming_after";
  const [items, setItems] = useState<MediaAssetListItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Partial<Record<"grooming_before" | "grooming_after", string>>>({});
  const [signedUrl, setSignedUrl] = useState("");
  // Care-report photos are included when a suitable grooming-after asset exists.
  // Missing photos never block drafting, generation, saving, or publishing.
  const photoConsent = true;
  const [visitWeightKg, setVisitWeightKg] = useState<number | null>(null);
  const [nextDate, setNextDate] = useState<string | null>(null);
  const [sourceText, setSourceText] = useState("");
  const [revisionText, setRevisionText] = useState("");
  const [report, setReport] = useState<CareReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<"upload" | "generate" | "save" | "publish" | null>(null);
  const [recording, setRecording] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState("");
  const [error, setError] = useState("");
  const [hasEdited, setHasEdited] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);

  const selectedService = useMemo(() => services.find((service) => service.id === appointment.service_id), [appointment.service_id, services]);
  const isPublished = Boolean(publishedCareReport);
  const selectedId = selectedIds[activeKind] ?? "";
  const selectedItem = items.find((item) => item.mediaAsset.id === selectedId) ?? null;
  const kindItems = items.filter((item) => item.mediaAsset.media_kind === activeKind && item.mediaAsset.status === "ready");
  const composerText = report ? revisionText : sourceText;
  const hasComposerInput = Boolean(composerText.trim());

  async function load() {
    setLoading(true);
    setError("");
    const recoveredDraft = isPublished ? null : readOwnerCareReportLocalDraft(shopId, appointment.id);
    try {
      if (developmentFixture) {
        const draft = developmentFixture.draft ?? null;
        const items = developmentFixture.items ?? [];
        setItems(items);
        const firstBefore = items.find((item) => item.mediaAsset.media_kind === "grooming_before")?.mediaAsset.id;
        const firstAfter = draft?.afterMediaAssetId ?? items.find((item) => item.mediaAsset.media_kind === "grooming_after")?.mediaAsset.id;
        setSelectedIds(recoveredDraft?.selectedIds ?? { grooming_before: firstBefore, grooming_after: firstAfter });
        setNextDate(recoveredDraft?.nextDate ?? draft?.nextRecommendedVisitDate ?? null);
        setSourceText(recoveredDraft?.sourceText ?? "");
        setRevisionText(recoveredDraft?.revisionText ?? "");
        setReport((recoveredDraft?.report as CareReport | null | undefined) ?? draft?.careReportAiDraft ?? publishedCareReport ?? null);
        setVisitWeightKg(developmentFixture.visitWeightKg ?? null);
        setHasEdited(Boolean(recoveredDraft));
        return;
      }
      const query = new URLSearchParams({ shopId, appointmentId: appointment.id, includeVariants: "true", limit: "40" });
      const [media, draft, visitWeight] = await Promise.all([
        fetchApiJsonWithAuth<{ items: MediaAssetListItem[] }>(`/api/owner/media/assets?${query.toString()}`, { cache: "no-store" }),
        fetchApiJsonWithAuth<DraftResponse>(`/api/owner/grooming-record-drafts?${new URLSearchParams({ shopId, appointmentId: appointment.id }).toString()}`, { cache: "no-store" }),
        fetchOwnerAppointmentVisitWeight(shopId, appointment.id),
      ]);
      const available = media.items.filter((item) => item.mediaAsset.media_kind === "grooming_before" || item.mediaAsset.media_kind === "grooming_after");
      setItems(available);
      const firstBefore = available.find((item) => item.mediaAsset.media_kind === "grooming_before")?.mediaAsset.id;
      const firstAfter = draft.draft?.afterMediaAssetId ?? available.find((item) => item.mediaAsset.media_kind === "grooming_after")?.mediaAsset.id;
      setSelectedIds(recoveredDraft?.selectedIds ?? { grooming_before: firstBefore, grooming_after: firstAfter });
      setNextDate(recoveredDraft?.nextDate ?? draft.draft?.nextRecommendedVisitDate ?? null);
      setSourceText(recoveredDraft?.sourceText ?? "");
      setRevisionText(recoveredDraft?.revisionText ?? "");
      setReport((recoveredDraft?.report as CareReport | null | undefined) ?? draft.draft?.careReportAiDraft ?? publishedCareReport ?? null);
      setVisitWeightKg(visitWeight.current?.weightKg ?? null);
      setHasEdited(Boolean(recoveredDraft));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "케어리포트를 불러오지 못했습니다.");
      if (recoveredDraft) {
        setSelectedIds(recoveredDraft.selectedIds);
        setNextDate(recoveredDraft.nextDate);
        setSourceText(recoveredDraft.sourceText);
        setRevisionText(recoveredDraft.revisionText);
        setReport(recoveredDraft.report as CareReport | null);
        setVisitWeightKg(null);
        setHasEdited(true);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [appointment.id, developmentFixture, publishedCareReport, shopId]);

  useEffect(() => {
    if (isPublished) {
      clearOwnerCareReportLocalDraft(shopId, appointment.id);
      return;
    }
    if (!hasEdited || loading) return;
    writeOwnerCareReportLocalDraft(shopId, appointment.id, {
      sourceText,
      revisionText,
      report: report as Record<string, unknown> | null,
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
    const query = new URLSearchParams({ shopId, mediaAssetId: selectedItem.mediaAsset.id, variant: "provider_ready" });
    void fetchApiJsonWithAuth<{ signedUrl: string }>(`/api/owner/media/signed-url?${query.toString()}`)
      .then((result) => { if (active) setSignedUrl(result.signedUrl); })
      .catch(() => { if (active) setSignedUrl(""); });
    return () => { active = false; };
  }, [developmentFixture, selectedItem, shopId]);

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
        body: JSON.stringify({ shopId, appointmentId: appointment.id, treatmentNotes: "", specialNotes: "", internalNotes: "", nextRecommendedVisitDate: nextDate, afterMediaAssetId: selectedIds.grooming_after ?? null, careReportPhotoConsent: photoConsent }),
      });
      if (report) {
        await fetchApiJsonWithAuth("/api/owner/care-reports", { method: "PATCH", body: JSON.stringify({ shopId, appointmentId: appointment.id, careReport: report, photoConsent, action: "save_draft" }) });
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
      const result = await fetchApiJsonWithAuth<{ careReport: CareReport }>("/api/owner/care-reports", {
        method: "POST",
        body: JSON.stringify({ shopId, appointmentId: appointment.id, observations: createObservations(input, nextDate), voiceTranscript: input, currentDraft: report ?? undefined, photoConsent, currentWeightKg: visitWeightKg ?? undefined }),
      });
      setReport(result.careReport);
      setRevisionText("");
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
      await fetchApiJsonWithAuth("/api/owner/care-reports", { method: "PATCH", body: JSON.stringify({ shopId, appointmentId: appointment.id, careReport: report, photoConsent, action: "publish" }) });
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
          report: report as Record<string, unknown> | null,
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
      setShowExitConfirm(true);
      return;
    }
    onClose();
  }

  function discardAndClose() {
    clearOwnerCareReportLocalDraft(shopId, appointment.id);
    onClose();
  }

  async function saveAndExit() {
    setAction("save");
    setError("");
    try {
      if (await persistDraft()) {
        setHasEdited(false);
        onClose();
      }
    } finally {
      setAction(null);
    }
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

  const inputClass = "h-11 w-full rounded-[12px] border border-[#d7e4f2] bg-white px-3 text-[16px] text-[#20344c] outline-none focus:border-[#76a8df]";
  const updateReport = (key: keyof CareReport, value: string) => {
    if (!report) return;
    setReport({ ...report, [key]: key === "homeCareTips" ? value.split("\n").map((item) => item.trim()).filter(Boolean).slice(0, 4) : value });
    setHasEdited(true);
  };

  return (
    <div className="fixed inset-0 z-[80] flex justify-center bg-[#0b1b2c]/35" role="dialog" aria-modal="true" aria-label="AI 케어리포트 작성">
      <section className="flex min-h-0 w-full max-w-[430px] flex-col bg-white">
        <header className="flex shrink-0 items-start justify-between border-b border-[#dce7f2] bg-white px-4 pb-3 pt-[calc(env(safe-area-inset-top)+12px)]">
          <div className="min-w-0"><h1 className="text-[20px] font-semibold tracking-[-0.04em] text-[#14213a]">AI 케어리포트 작성</h1><p className="mt-1 truncate text-[14px] text-[#637890]">{pet.name} · {staffName || "담당 디자이너"}</p></div>
          <button type="button" onClick={requestClose} className="ml-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#eef4fa] text-[#58708a]" aria-label="닫기"><X className="h-5 w-5" /></button>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + env(keyboard-inset-height, 0px) + 80px)" }}>
          <section className="border-b border-[#dce7f2] py-2" aria-label="미용 사진">
            <input id={cameraInputId} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(file); }} />
            <input id={albumInputId} type="file" accept="image/*" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(file); }} />
            <div className="flex min-h-11 items-center gap-2">
              {selectedItem && signedUrl ? <img src={signedUrl} alt="포함할 미용 사진" className="h-11 w-11 rounded-[10px] border border-[#d7e4f2] object-cover" /> : <span className="flex h-11 w-11 items-center justify-center rounded-[10px] border border-dashed border-[#cbd8e5] text-[#71859a]" aria-label="포함할 미용 사진 없음"><ImagePlus className="h-4 w-4" aria-hidden="true" /></span>}
              <p className="min-w-0 flex-1 truncate text-[14px] text-[#64748b]">{selectedItem ? "미용 사진 포함" : "사진 없음"}</p>
              <label htmlFor={cameraInputId} aria-label="미용 사진 촬영" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#d7e4f2] text-[#52708c] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#2563eb]"><Camera className="h-4 w-4" aria-hidden="true" /></label>
              <label htmlFor={albumInputId} aria-label="미용 사진 선택" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#d7e4f2] text-[#52708c] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#2563eb]"><ImagePlus className="h-4 w-4" aria-hidden="true" /></label>
            </div>
            {kindItems.length > 1 ? <select aria-label="포함할 미용 사진 선택" value={selectedId} onChange={(event) => { setSelectedIds((current) => ({ ...current, [activeKind]: event.target.value })); setHasEdited(true); }} className="mt-2 h-11 w-full rounded-[10px] border border-[#d7e4f2] px-3 text-[14px] text-[#526b84]">{kindItems.map((item, index) => <option key={item.mediaAsset.id} value={item.mediaAsset.id}>미용 후 사진 {kindItems.length - index}</option>)}</select> : null}
          </section>

          <section className="flex min-w-0 flex-wrap items-end justify-between gap-3 border-b border-[#dce7f2] py-3" aria-label="예약 정보">
            <div className="min-w-0"><p className="text-[13px] leading-5 text-[#64748b]">예약 서비스</p><p className="truncate text-[16px] font-medium leading-6 text-[#20344c]">{selectedService?.name ?? "서비스 확인 필요"}</p></div>
            <div><p className="text-[13px] leading-5 text-[#64748b]">오늘 몸무게</p><p className="text-[16px] font-medium leading-6 tabular-nums text-[#20344c]">{visitWeightKg === null ? "미입력" : `${visitWeightKg}kg`}</p></div>
            <button type="button" onClick={onReturnToDetail} className="min-h-11 rounded-[10px] border border-[#d7e4f2] px-3 text-[14px] font-medium leading-5 text-[#4d6d89] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]">예약 정보 수정</button>
          </section>
          <details className="border-b border-[#dce7f2] py-2"><summary className="flex min-h-11 cursor-pointer list-none items-center text-[14px] font-medium leading-5 text-[#526b84]">재예약 알림 설정</summary><div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 pb-2"><input aria-label="재예약 알림 날짜" type="date" value={nextDate ?? ""} onChange={(event) => { setNextDate(event.target.value || null); setHasEdited(true); }} className={inputClass} /><button type="button" onClick={() => { setNextDate(null); setHasEdited(true); }} className="min-h-11 rounded-[10px] border border-[#d7e4f2] px-3 text-[14px] font-medium text-[#587a9f]">알림 안 함</button></div></details>

          <section className="py-3">{report ? <><div className="flex items-center justify-between"><h2 className="text-[16px] font-semibold text-[#20344c]">AI가 정리한 결과</h2><span className="text-[14px] text-[#587a9f]">{isPublished ? "발송 완료" : "직접 편집 가능"}</span></div>{([['oneLineSummary','디자이너 한마디'],['treatmentSummary','오늘 진행한 미용'],['conditionSummary','오늘 확인한 상태'],['groomingResponse','미용 중 반응'],['homeCareTips','홈케어 안내'],['nextVisitGuide','다음 방문 안내']] as Array<[keyof CareReport,string]>).map(([key,label]) => <label key={key} className="mt-2 block text-[14px] text-[#637890]">{label}<textarea disabled={isPublished} value={key === 'homeCareTips' ? report.homeCareTips.join('\n') : report[key] as string} onChange={(event) => updateReport(key, event.target.value)} className="mt-1 min-h-16 w-full resize-y rounded-[11px] border border-[#d7e4f2] px-3 py-2 text-[16px] leading-6 text-[#263b53] disabled:bg-[#f8fbfe] disabled:opacity-70" /></label>)}</> : null}<div className={report ? "mt-3" : ""}><textarea disabled={isPublished} value={composerText} onChange={(event) => { if (report) setRevisionText(event.target.value.slice(0, 1000)); else setSourceText(event.target.value.slice(0, 4000)); setHasEdited(true); }} aria-label={report ? "수정 요청 입력" : "케어리포트 내용 입력"} placeholder={report ? "수정할 부분을 적어 주세요" : "오늘 미용 내용을 적어 주세요"} className="min-h-24 w-full resize-y rounded-[12px] border border-[#d7e4f2] bg-white px-3 py-3 text-[16px] leading-6 text-[#263b53] outline-none focus:border-[#76a8df] disabled:opacity-50" /><div className="mt-2 flex items-center justify-end gap-2"><button type="button" onClick={() => void toggleVoice()} disabled={isPublished || action !== null} aria-label={recording ? "음성 입력 중지" : "음성 입력 시작"} aria-pressed={recording} className={`flex h-11 w-11 items-center justify-center rounded-full border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] disabled:opacity-50 ${recording ? "border-[#f0b8bf] bg-[#fff7f8] text-[#a04455]" : "border-[#d7e4f2] bg-white text-[#52708c]"}`}>{recording ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Mic className="h-4 w-4" aria-hidden="true" />}</button><button type="button" onClick={() => void generate()} disabled={isPublished || action !== null || !hasComposerInput} aria-label="케어리포트 만들기" className="flex h-11 w-11 items-center justify-center rounded-full bg-[#111A30] text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] disabled:opacity-40"><ArrowUp className="h-5 w-5" aria-hidden="true" /></button></div>{voiceMessage ? <p className="mt-2 text-[13px] leading-5 text-[#64748b]" role="status">{voiceMessage}</p> : null}</div></section>
          {error ? <p className="mt-2 rounded-[12px] border border-[#f0c4c8] bg-[#fff8f8] px-3 py-2 text-[14px] leading-5 text-[#a04455]">{error}</p> : null}
          {loading ? <p className="py-3 text-center text-[14px] text-[#71859a]">기존 초안과 사진을 불러오는 중이에요.</p> : null}
        </main>
        <footer className={`grid shrink-0 gap-2 border-t border-[#d7e4f2] bg-white px-4 pt-3 ${isPublished ? "grid-cols-1" : "grid-cols-2"}`} style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + env(keyboard-inset-height, 0px) + 12px)" }}>{isPublished ? <button type="button" onClick={onClose} className="flex h-12 items-center justify-center rounded-[12px] bg-[#3f7fc6] text-[16px] font-semibold text-white">닫기</button> : <><button type="button" onClick={() => setShowPublishConfirm(true)} disabled={!report || action !== null} className="flex h-12 items-center justify-center gap-1.5 rounded-[12px] bg-[#3f7fc6] text-[16px] font-semibold text-white disabled:opacity-40"><Send className="h-4 w-4" />리포트 보내기</button><button type="button" onClick={() => void saveDraft()} disabled={action !== null} className="flex h-12 items-center justify-center gap-1.5 rounded-[12px] border border-[#cbddec] text-[16px] font-semibold text-[#4d6d89] disabled:opacity-50"><Check className="h-4 w-4" />{action === 'save' ? '저장 중…' : '임시저장'}</button></>}</footer>
      </section>
      {showPublishConfirm ? <div className="fixed inset-0 z-[81] flex items-center justify-center bg-[#0b1b2c]/40 px-5"><section className="w-full max-w-[360px] rounded-[18px] border border-[#d4e3f2] bg-white p-5"><h2 className="text-[20px] font-semibold text-[#1b3048]">작성한 케어리포트를 보호자에게 보낼까요?</h2><p className="mt-2 text-[14px] leading-5 text-[#667b91]">보내기 전에는 내용을 다시 수정할 수 있어요.</p><div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={() => setShowPublishConfirm(false)} className="h-11 rounded-[11px] border border-[#d4e3f2] text-[16px] font-medium text-[#58708a]">계속 수정</button><button type="button" onClick={() => { setShowPublishConfirm(false); void publish(); }} className="h-11 rounded-[11px] bg-[#3f7fc6] text-[16px] font-semibold text-white">확인하고 보내기</button></div></section></div> : null}
      {showExitConfirm ? <div className="fixed inset-0 z-[81] flex items-center justify-center bg-[#0b1b2c]/40 px-5"><section className="w-full max-w-[360px] rounded-[18px] border border-[#d4e3f2] bg-white p-5"><h2 className="text-[20px] font-semibold text-[#1b3048]">작성 중인 내용이 있어요</h2><p className="mt-2 text-[14px] leading-5 text-[#667b91]">저장하지 않으면 이번에 입력한 내용은 사라집니다.</p><div className="mt-5 grid gap-2"><button type="button" onClick={() => setShowExitConfirm(false)} className="h-11 rounded-[11px] border border-[#d4e3f2] text-[16px] font-medium text-[#58708a]">계속 작성</button><button type="button" onClick={() => void saveAndExit()} disabled={action !== null} className="h-11 rounded-[11px] bg-[#3f7fc6] text-[16px] font-semibold text-white">임시저장하고 나가기</button><button type="button" onClick={discardAndClose} className="h-11 rounded-[11px] text-[16px] font-medium text-[#8a5d63]">저장하지 않고 나가기</button></div></section></div> : null}
    </div>
  );
}
