"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { fetchApiJsonWithAuth } from "@/lib/api";
import type { GroomingCompletionDetails } from "@/components/owner-web/calendar-grooming-completion-fields";
import { getDefaultRevisitReminderDate } from "@/lib/customer-booking-window";

export type GroomingRecordDraftSaveStatus = "loading" | "idle" | "local" | "saving" | "saved" | "offline" | "error";

type DraftSnapshot = {
  value: GroomingCompletionDetails;
  afterMediaAssetId: string | null;
  updatedAt: string;
};

type DraftApiItem = {
  treatmentNotes: string;
  specialNotes: string;
  internalNotes: string;
  nextRecommendedVisitDate: string | null;
  afterMediaAssetId: string | null;
  updatedAt: string;
};

type DraftApiResponse = {
  draft: DraftApiItem | null;
};

function createDefaultDetails(params: { revisitReminderEnabled?: boolean; revisitReminderDefaultDays?: number }): GroomingCompletionDetails {
  return {
    treatmentNotes: "",
    specialNotes: "",
    internalNotes: "",
    nextRecommendedVisitDate: params.revisitReminderEnabled === false
      ? null
      : getDefaultRevisitReminderDate(undefined, params.revisitReminderDefaultDays),
  };
}

const AUTOSAVE_DELAY_MS = 900;
const LOCAL_DRAFT_VERSION = 1;

function getStorageKey(shopId: string, appointmentId: string) {
  return `petmanager:grooming-record-draft:v${LOCAL_DRAFT_VERSION}:${shopId}:${appointmentId}`;
}

function normalizeValue(value: Partial<GroomingCompletionDetails> | null | undefined): GroomingCompletionDetails {
  return {
    treatmentNotes: typeof value?.treatmentNotes === "string" ? value.treatmentNotes.slice(0, 2000) : "",
    specialNotes: typeof value?.specialNotes === "string" ? value.specialNotes.slice(0, 2000) : "",
    internalNotes: typeof value?.internalNotes === "string" ? value.internalNotes.slice(0, 4000) : "",
    nextRecommendedVisitDate:
      typeof value?.nextRecommendedVisitDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.nextRecommendedVisitDate)
        ? value.nextRecommendedVisitDate
        : null,
  };
}

export function chooseNewestGroomingDraft(local: DraftSnapshot | null, server: DraftSnapshot | null) {
  if (!local) return server;
  if (!server) return local;
  return Date.parse(local.updatedAt) >= Date.parse(server.updatedAt) ? local : server;
}

export function readLocalGroomingDraft(shopId: string, appointmentId: string): DraftSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(getStorageKey(shopId, appointmentId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DraftSnapshot>;
    if (!parsed.updatedAt || typeof parsed.updatedAt !== "string") return null;
    return {
      value: normalizeValue(parsed.value),
      afterMediaAssetId: typeof parsed.afterMediaAssetId === "string" ? parsed.afterMediaAssetId : null,
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

function writeLocalGroomingDraft(shopId: string, appointmentId: string, snapshot: DraftSnapshot) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getStorageKey(shopId, appointmentId), JSON.stringify(snapshot));
}

function removeLocalGroomingDraft(shopId: string, appointmentId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(getStorageKey(shopId, appointmentId));
}

function toServerSnapshot(draft: DraftApiItem | null): DraftSnapshot | null {
  if (!draft) return null;
  return {
    value: normalizeValue(draft),
    afterMediaAssetId: draft.afterMediaAssetId,
    updatedAt: draft.updatedAt,
  };
}

export function useGroomingRecordDraft(params: {
  shopId: string;
  appointmentId: string;
  enabled: boolean;
  revisitReminderEnabled?: boolean;
  revisitReminderDefaultDays?: number;
}) {
  const serverEnabled = params.enabled && params.shopId !== "demo-shop" && params.shopId !== "owner-demo";
  const [localDraft] = useState(() => (
    params.enabled ? readLocalGroomingDraft(params.shopId, params.appointmentId) : null
  ));
  const [value, setValueState] = useState<GroomingCompletionDetails>(() => localDraft?.value ?? createDefaultDetails(params));
  const [afterMediaAssetId, setAfterMediaAssetIdState] = useState<string | null>(localDraft?.afterMediaAssetId ?? null);
  const [status, setStatus] = useState<GroomingRecordDraftSaveStatus>(
    serverEnabled ? "loading" : localDraft ? "local" : "idle",
  );
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(localDraft?.updatedAt ?? null);
  const [saveError, setSaveError] = useState("");
  const [hydrated, setHydrated] = useState(!serverEnabled);
  const [onlineRetry, setOnlineRetry] = useState(0);
  const editVersionRef = useRef(0);
  const saveTimerRef = useRef<number | null>(null);
  const valueRef = useRef(value);
  const afterMediaAssetIdRef = useRef(afterMediaAssetId);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    afterMediaAssetIdRef.current = afterMediaAssetId;
  }, [afterMediaAssetId]);

  useEffect(() => {
    if (!serverEnabled) return;
    let active = true;
    const editVersionAtStart = editVersionRef.current;
    const local = readLocalGroomingDraft(params.shopId, params.appointmentId);
    const query = new URLSearchParams({ shopId: params.shopId, appointmentId: params.appointmentId });

    void fetchApiJsonWithAuth<DraftApiResponse>(`/api/owner/grooming-record-drafts?${query.toString()}`, {
      cache: "no-store",
    })
      .then((response) => {
        if (!active || editVersionRef.current !== editVersionAtStart) return;
        const newest = chooseNewestGroomingDraft(local, toServerSnapshot(response.draft));
        if (newest) {
          setValueState(newest.value);
          setAfterMediaAssetIdState(newest.afterMediaAssetId);
          setLastSavedAt(newest.updatedAt);
          writeLocalGroomingDraft(params.shopId, params.appointmentId, newest);
          setStatus("saved");
        } else {
          setStatus("idle");
        }
        setSaveError("");
      })
      .catch((error) => {
        if (!active) return;
        setStatus(local ? "offline" : "error");
        setSaveError(error instanceof Error ? error.message : "서버 임시저장 연결을 확인하지 못했습니다.");
      })
      .finally(() => {
        if (active) setHydrated(true);
      });

    return () => {
      active = false;
    };
  }, [params.appointmentId, params.shopId, serverEnabled]);

  useEffect(() => {
    if (!serverEnabled || !hydrated) return;
    const handleOnline = () => setOnlineRetry((current) => current + 1);
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [hydrated, serverEnabled]);

  const persistServerDraft = useCallback(async () => {
    const updatedAt = new Date().toISOString();
    const snapshot: DraftSnapshot = {
      value: valueRef.current,
      afterMediaAssetId: afterMediaAssetIdRef.current,
      updatedAt,
    };
    writeLocalGroomingDraft(params.shopId, params.appointmentId, snapshot);

    if (!serverEnabled) {
      setStatus("local");
      setSaveError("");
      return true;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setStatus("offline");
      setSaveError("인터넷 연결 후 자동으로 다시 저장합니다.");
      return false;
    }

    setStatus("saving");
    try {
      const response = await fetchApiJsonWithAuth<DraftApiResponse>("/api/owner/grooming-record-drafts", {
        method: "PUT",
        body: JSON.stringify({
          shopId: params.shopId,
          appointmentId: params.appointmentId,
          ...valueRef.current,
          afterMediaAssetId: afterMediaAssetIdRef.current,
        }),
      });
      const savedAt = response.draft?.updatedAt ?? updatedAt;
      setLastSavedAt(savedAt);
      setStatus("saved");
      setSaveError("");
      writeLocalGroomingDraft(params.shopId, params.appointmentId, {
        ...snapshot,
        updatedAt: savedAt,
      });
      return true;
    } catch (error) {
      setStatus("offline");
      setSaveError(error instanceof Error ? error.message : "서버 임시저장에 실패했습니다.");
      return false;
    }
  }, [params.appointmentId, params.shopId, serverEnabled]);

  useEffect(() => {
    if (!params.enabled || !hydrated) return;
    const updatedAt = new Date().toISOString();
    writeLocalGroomingDraft(params.shopId, params.appointmentId, {
      value,
      afterMediaAssetId,
      updatedAt,
    });

    if (!serverEnabled) return;

    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void persistServerDraft();
    }, AUTOSAVE_DELAY_MS);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [afterMediaAssetId, hydrated, onlineRetry, params.appointmentId, params.enabled, params.shopId, persistServerDraft, serverEnabled, value]);

  const setValue = useCallback((nextValue: GroomingCompletionDetails) => {
    editVersionRef.current += 1;
    const normalized = normalizeValue(nextValue);
    valueRef.current = normalized;
    setValueState(normalized);
    setStatus("local");
    setSaveError("");
  }, []);

  const setAfterMediaAssetId = useCallback((mediaAssetId: string | null) => {
    editVersionRef.current += 1;
    afterMediaAssetIdRef.current = mediaAssetId;
    setAfterMediaAssetIdState(mediaAssetId);
    setStatus("local");
    setSaveError("");
  }, []);

  const clearDraft = useCallback(async () => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    removeLocalGroomingDraft(params.shopId, params.appointmentId);
    if (!serverEnabled) return;
    try {
      await fetchApiJsonWithAuth<{ deleted: boolean }>("/api/owner/grooming-record-drafts", {
        method: "DELETE",
        body: JSON.stringify({ shopId: params.shopId, appointmentId: params.appointmentId }),
      });
    } catch {
      // Completion also clears the server draft. Local cleanup must not block completion.
    }
  }, [params.appointmentId, params.shopId, serverEnabled]);

  return {
    value,
    setValue,
    afterMediaAssetId,
    setAfterMediaAssetId,
    status,
    lastSavedAt,
    saveError,
    flushDraft: persistServerDraft,
    clearDraft,
  };
}
