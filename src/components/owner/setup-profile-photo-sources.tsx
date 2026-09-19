"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus } from "lucide-react";
import { captureWithAndroidCameraApp, resolveExternalCameraAppsAvailability } from "@/lib/media/external-camera";

export default function SetupProfilePhotoSources({ onFile, onBusyChange }: {
  onFile: (file: File) => void; onBusyChange: (busy: boolean) => void;
}) {
  const [mode, setMode] = useState<"checking" | "native" | "browser" | "unavailable">("checking");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const camera = useRef<HTMLInputElement>(null);
  const album = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    void resolveExternalCameraAppsAvailability().then((availability) => {
      if (!active) return;
      // Mobile browsers decide how to fulfill the capture hint; it is not
      // proof that a physical camera exists or that permission was granted.
      const mobileBrowser = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
        || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      const captureHint = "capture" in document.createElement("input");
      setMode(availability === "available" ? "native" : availability === "web" && mobileBrowser && captureHint ? "browser" : "unavailable");
    }).catch(() => { if (active) setMode("unavailable"); });
    return () => { active = false; };
  }, []);

  async function capture() {
    if (lock.current) return;
    setNotice("");
    if (mode === "browser") { camera.current?.click(); return; }
    if (mode !== "native") return;
    lock.current = true; setBusy(true); onBusyChange(true);
    let file: File | undefined;
    try { file = await captureWithAndroidCameraApp("default"); }
    catch (cause) {
      const message = cause instanceof Error ? cause.message : "";
      if (!message.includes("CAMERA_CANCELLED")) setNotice("촬영하지 못했어요. 카메라 권한을 확인하거나 앨범에서 사진을 선택해 주세요.");
    } finally { lock.current = false; setBusy(false); onBusyChange(false); }
    if (file) onFile(file);
  }

  const button = "flex min-h-12 items-center justify-center gap-2 rounded-[10px] border border-[#d9e1ec] px-3 text-[14px] font-medium disabled:opacity-50";
  return <div className="space-y-3">
    <div className="grid grid-cols-2 gap-3">
      <button type="button" className={button} disabled={busy || mode === "checking" || mode === "unavailable"} onClick={() => void capture()}><Camera size={18} aria-hidden />촬영하기</button>
      <button type="button" className={button} disabled={busy} onClick={() => { setNotice(""); album.current?.click(); }}><ImagePlus size={18} aria-hidden />앨범에서 선택</button>
    </div>
    {mode === "checking" && <p role="status" className="text-[13px] leading-5 text-[#64748b]">촬영 가능 여부를 확인하고 있어요.</p>}
    {busy && <p role="status" className="text-[13px] leading-5 text-[#64748b]">촬영한 사진을 기다리고 있어요.</p>}
    {notice && <p role="alert" className="text-[13px] leading-5 text-red-600">{notice}</p>}
    {[true, false].map((isCamera) => <input key={String(isCamera)} ref={isCamera ? camera : album} type="file" className="hidden" accept="image/*" capture={isCamera ? "user" : undefined} aria-label={isCamera ? "촬영 사진" : "앨범 사진"} disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) onFile(file); }} />)}
  </div>;
}
