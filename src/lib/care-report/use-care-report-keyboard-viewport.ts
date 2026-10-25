"use client";

import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";

function keepFocusedSectionVisible(element: HTMLTextAreaElement) {
  requestAnimationFrame(() => {
    const scrollRegion = element.closest<HTMLElement>("[data-testid='care-report-scroll-region']");
    const focusedSection = element.closest<HTMLElement>("[data-testid='care-report-draft'], [data-testid='care-report-composer']");
    if (!scrollRegion || !focusedSection) return;
    const scrollBounds = scrollRegion.getBoundingClientRect();
    const sectionBounds = focusedSection.getBoundingClientRect();
    const bottomOverflow = sectionBounds.bottom - scrollBounds.bottom + 12;
    const topOverflow = scrollBounds.top + 12 - sectionBounds.top;
    if (bottomOverflow > 0) scrollRegion.scrollTop += bottomOverflow;
    else if (topOverflow > 0) scrollRegion.scrollTop -= topOverflow;
  });
}

export function useCareReportKeyboardViewport(
  reportTextareaRef: RefObject<HTMLTextAreaElement | null>,
  composerTextareaRef: RefObject<HTMLTextAreaElement | null>,
) {
  const textInputFocusedRef = useRef(false);
  const activeTextInputRef = useRef<HTMLTextAreaElement | null>(null);
  const keyboardViewportReducedRef = useRef(false);
  const fullViewportHeightRef = useRef(0);
  const keyboardDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isTextInputFocused, setIsTextInputFocused] = useState(false);
  const [keyboardViewportReduced, setKeyboardViewportReduced] = useState(false);
  const [keyboardDismissPending, setKeyboardDismissPending] = useState(false);
  const [visualViewportFrame, setVisualViewportFrame] = useState<{ height: number | null; offsetTop: number }>({
    height: null,
    offsetTop: 0,
  });

  useEffect(() => {
    const viewport = window.visualViewport;
    const syncViewport = () => {
      const height = Math.max(1, Math.round(viewport?.height ?? window.innerHeight));
      const offsetTop = Math.max(0, Math.round(viewport?.offsetTop ?? 0));
      const availableHeight = height + offsetTop;
      if (!textInputFocusedRef.current && !keyboardViewportReducedRef.current) {
        fullViewportHeightRef.current = Math.max(fullViewportHeightRef.current, availableHeight);
      } else if (fullViewportHeightRef.current === 0) {
        fullViewportHeightRef.current = Math.round(window.innerHeight);
      }
      const reduced = fullViewportHeightRef.current - availableHeight > 80;
      keyboardViewportReducedRef.current = reduced;
      setKeyboardViewportReduced(reduced);
      setVisualViewportFrame({ height, offsetTop });
      if (!textInputFocusedRef.current && !reduced) setKeyboardDismissPending(false);

      const focusedTextarea = textInputFocusedRef.current ? activeTextInputRef.current : null;
      if (focusedTextarea) keepFocusedSectionVisible(focusedTextarea);
    };

    syncViewport();
    window.addEventListener("resize", syncViewport);
    viewport?.addEventListener("resize", syncViewport);
    viewport?.addEventListener("scroll", syncViewport);
    return () => {
      window.removeEventListener("resize", syncViewport);
      viewport?.removeEventListener("resize", syncViewport);
      viewport?.removeEventListener("scroll", syncViewport);
      if (keyboardDismissTimerRef.current) clearTimeout(keyboardDismissTimerRef.current);
    };
  }, [composerTextareaRef, reportTextareaRef]);

  useEffect(() => {
    const focusedTextarea = textInputFocusedRef.current ? activeTextInputRef.current : null;
    if (focusedTextarea) keepFocusedSectionVisible(focusedTextarea);
  }, [isTextInputFocused, visualViewportFrame.height, visualViewportFrame.offsetTop]);

  function focusTextInput(element: HTMLTextAreaElement) {
    textInputFocusedRef.current = true;
    activeTextInputRef.current = element;
    if (keyboardDismissTimerRef.current) clearTimeout(keyboardDismissTimerRef.current);
    keyboardDismissTimerRef.current = null;
    setKeyboardDismissPending(false);
    setIsTextInputFocused(true);
    keepFocusedSectionVisible(element);
  }

  function releaseTextInput() {
    requestAnimationFrame(() => {
      const activeElement = document.activeElement;
      const remainsFocused = activeElement === reportTextareaRef.current || activeElement === composerTextareaRef.current;
      textInputFocusedRef.current = remainsFocused;
      activeTextInputRef.current = remainsFocused ? activeElement as HTMLTextAreaElement : null;
      setIsTextInputFocused(remainsFocused);
      if (remainsFocused) return;

      setKeyboardDismissPending(true);
      if (keyboardDismissTimerRef.current) clearTimeout(keyboardDismissTimerRef.current);
      keyboardDismissTimerRef.current = setTimeout(() => {
        if (!textInputFocusedRef.current && !keyboardViewportReducedRef.current) setKeyboardDismissPending(false);
      }, 350);
    });
  }

  const viewportStyle: CSSProperties = visualViewportFrame.height
    ? { height: `${visualViewportFrame.height}px`, top: `${visualViewportFrame.offsetTop}px` }
    : { height: "100dvh", top: 0 };

  return {
    focusTextInput,
    releaseTextInput,
    shouldHideFixedActions: isTextInputFocused || keyboardViewportReduced || keyboardDismissPending,
    viewportStyle,
  };
}
