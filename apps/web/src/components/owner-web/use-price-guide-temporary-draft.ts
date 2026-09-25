"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { priceGuideDraftKey, readPriceGuideTemporaryDraft, savePriceGuideTemporaryDraft } from "@/lib/price-guide-temporary-draft";
import type { PriceGuideV2 } from "@/types/price-guide-photo-import";

export type PriceGuideEditingMode = "direct" | "photo-review";

export function usePriceGuideTemporaryDraft(shopId: string, fixtureMode: boolean) {
  const [available, setAvailable] = useState(false);
  const [notice, setNotice] = useState("");
  const [resumeDocument, setResumeDocument] = useState<PriceGuideV2 | null>(null);
  const [resumeEditorMode, setResumeEditorMode] = useState<PriceGuideEditingMode | null>(null);
  const operation = useRef(0);
  const sessionOperation = useRef(0);
  const key = useCallback(async () => {
    if (!shopId) throw new Error("매장 정보를 확인해 주세요.");
    if (fixtureMode) return priceGuideDraftKey("fixture", shopId);
    const client = getSupabaseBrowserClient();
    if (!client) throw new Error("로그인 연결을 확인해 주세요.");
    const result = await client.auth.getSession();
    const ownerId = result.data.session?.user.id;
    if (!ownerId) throw new Error("로그인 상태를 확인해 주세요.");
    return priceGuideDraftKey(ownerId, shopId);
  }, [shopId, fixtureMode]);
  useEffect(() => {
    let active = true;
    void key().then(value => {
      const draft = readPriceGuideTemporaryDraft(localStorage, value);
      const editingKey = `${value}:editing`;
      const persistedResume = readPriceGuideTemporaryDraft(localStorage, editingKey);
      const sessionResume = readPriceGuideTemporaryDraft(sessionStorage, editingKey);
      const resume = persistedResume ?? sessionResume;
      const savedMode = localStorage.getItem(`${editingKey}:mode`) ?? sessionStorage.getItem(`${editingKey}:mode`);
      const mode: PriceGuideEditingMode = savedMode === "direct" || savedMode === "photo-review"
        ? savedMode
        : resume?.source === "manual" ? "direct" : "photo-review";
      if (!persistedResume && sessionResume) {
        savePriceGuideTemporaryDraft(localStorage, editingKey, sessionResume);
        localStorage.setItem(`${editingKey}:mode`, mode);
      }
      if (active) { setAvailable(Boolean(draft)); if (sessionOperation.current === 0) { setResumeDocument(resume); setResumeEditorMode(resume ? mode : null); } }
    }).catch(() => { if (active) setAvailable(false); });
    return () => { active = false; };
  }, [key]);
  async function rememberEditing(document: PriceGuideV2, editorMode: PriceGuideEditingMode) {
    const current = ++sessionOperation.current;
    try {
      const storageKey = await key();
      if (current !== sessionOperation.current) return;
      const editingKey = `${storageKey}:editing`;
      savePriceGuideTemporaryDraft(localStorage, editingKey, document);
      localStorage.setItem(`${editingKey}:mode`, editorMode);
      sessionStorage.removeItem(editingKey);
      sessionStorage.removeItem(`${editingKey}:mode`);
      setResumeDocument(document);
      setResumeEditorMode(editorMode);
      setNotice("작성 내용이 자동 저장됐어요.");
    } catch { setNotice("작성 내용을 자동 저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요."); }
  }
  async function clearEditing() {
    const current = ++sessionOperation.current;
    const storageKey = await key();
    if (current === sessionOperation.current) {
      const editingKey = `${storageKey}:editing`;
      localStorage.removeItem(editingKey);
      localStorage.removeItem(`${editingKey}:mode`);
      sessionStorage.removeItem(editingKey);
      sessionStorage.removeItem(`${editingKey}:mode`);
      setResumeDocument(null);
      setResumeEditorMode(null);
    }
  }
  async function save(document: PriceGuideV2) {
    const current = ++operation.current;
    try { const storageKey = await key(); if (current !== operation.current) return; savePriceGuideTemporaryDraft(localStorage, storageKey, document); setAvailable(true); setNotice("이 브라우저에 24시간 임시 저장했어요."); }
    catch { setNotice("임시 저장하지 못했어요. 로그인 상태와 브라우저 저장 공간을 확인해 주세요."); }
  }
  async function restore() {
    try { const draft = readPriceGuideTemporaryDraft(localStorage, await key()); setAvailable(Boolean(draft)); setNotice(draft ? "임시 저장한 요금표를 불러왔어요." : "불러올 임시 저장 내용이 없어요."); return draft; }
    catch { setNotice("임시 저장 내용을 불러오지 못했어요."); return null; }
  }
  async function clear() {
    operation.current++;
    try { await clearEditing(); localStorage.removeItem(await key()); setAvailable(false); setNotice(""); }
    catch { setNotice("요금표는 저장됐지만 브라우저의 임시 저장 내용은 정리하지 못했어요."); }
  }
  return { available, notice, save, restore, clear, resumeDocument, resumeEditorMode, rememberEditing, clearEditing };
}
