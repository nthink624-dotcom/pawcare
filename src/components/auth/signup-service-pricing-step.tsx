"use client";

import Image from "next/image";
import { ArrowRight, Camera, CheckCircle2, FileImage, ImagePlus, Loader2, PencilLine, Plus, RotateCcw, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { signupPriceGuideReviewCopy, type SignupServicePrice } from "@/lib/auth/signup-service-pricing";

type RecognitionState = "idle" | "loading" | "ready" | "unavailable" | "failed" | "manual";
type AnalysisAccess = { token: string; deviceFingerprint: string };

const fieldClass =
  "mt-1.5 h-11 w-full rounded-xl border border-[#d7e0eb] bg-white px-3 text-[14px] text-[#172033] outline-none focus:border-[#1d3557]";

function emptyService(): SignupServicePrice {
  return {
    id: crypto.randomUUID(),
    name: "",
    detailName: "",
    price: 0,
    durationMinutes: 60,
    species: "dog",
    breedGroup: "",
    weightBand: "",
  };
}

export default function SignupServicePricingStep({
  services,
  onChange,
  onBack,
  onNext,
  fixtureId,
}: {
  services: SignupServicePrice[];
  onChange: (services: SignupServicePrice[]) => void;
  onBack: () => void;
  onNext: () => void;
  fixtureId?: "korean-price-guide-v1";
}) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<RecognitionState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [analysisAccess, setAnalysisAccess] = useState<AnalysisAccess | null>(null);
  const [purging, setPurging] = useState(false);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    if (!analysisAccess) return;
    const abandon = () => {
      void fetch("/api/auth/signup/price-guide-preview?reason=abandoned", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${analysisAccess.token}`,
          "X-PM-Device-Fingerprint": analysisAccess.deviceFingerprint,
          ...(fixtureId ? { "X-PetManager-Fixture": fixtureId } : {}),
        },
        keepalive: true,
      }).catch(() => undefined);
    };
    window.addEventListener("pagehide", abandon);
    return () => window.removeEventListener("pagehide", abandon);
  }, [analysisAccess, fixtureId]);

  const getDeviceFingerprint = () => {
    const key = "pm_signup_price_guide_device";
    const existing = window.sessionStorage.getItem(key);
    if (existing) return existing;
    const created = crypto.randomUUID().replaceAll("-", "");
    window.sessionStorage.setItem(key, created);
    return created;
  };

  const changeServices = (next: SignupServicePrice[]) => {
    setConfirmed(false);
    onChange(next);
  };

  const update = <K extends keyof SignupServicePrice>(id: string, key: K, value: SignupServicePrice[K]) => {
    changeServices(services.map((service) => (service.id === id ? { ...service, [key]: value } : service)));
  };

  const purgeAnalysis = async (reason: "confirmed" | "cancelled" | "retake" | "manual") => {
    if (!analysisAccess) return true;
    setPurging(true);
    try {
      const response = await fetch(`/api/auth/signup/price-guide-preview?reason=${reason}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${analysisAccess.token}`,
          "X-PM-Device-Fingerprint": analysisAccess.deviceFingerprint,
          ...(fixtureId ? { "X-PetManager-Fixture": fixtureId } : {}),
        },
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as { message?: string };
        setMessage(result.message ?? "사진 분석 임시정보를 정리하지 못했습니다. 잠시 후 다시 시도해 주세요.");
        return false;
      }
      setAnalysisAccess(null);
      return true;
    } catch {
      setMessage("사진 분석 임시정보를 정리하지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.");
      return false;
    } finally {
      setPurging(false);
    }
  };

  const startManual = async () => {
    if (!(await purgeAnalysis("manual"))) return;
    setState("manual");
    setMessage("사진 없이 직접 입력하고 있어요.");
    if (services.length === 0) changeServices([emptyService()]);
  };

  const analyze = async (file: File | null) => {
    if (!file) return;
    if (!(await purgeAnalysis("retake"))) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setFileName(file.name);
    setConfirmed(false);
    setState("loading");
    setMessage("사진을 판독하고 있어요. 원본은 서버나 Storage에 저장하지 않습니다.");
    const formData = new FormData();
    formData.set("file", file);
    try {
      const deviceFingerprint = getDeviceFingerprint();
      const tokenResponse = await fetch("/api/auth/signup/price-guide-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceFingerprint }),
      });
      const tokenResult = (await tokenResponse.json().catch(() => ({}))) as { token?: string; message?: string };
      if (!tokenResponse.ok || !tokenResult.token) throw new Error(tokenResult.message ?? "사진 분석 권한을 준비하지 못했습니다.");
      const nextAccess = { token: tokenResult.token, deviceFingerprint };
      setAnalysisAccess(nextAccess);
      const response = await fetch("/api/auth/signup/price-guide-preview", {
        method: "POST",
        body: formData,
        headers: {
          Authorization: `Bearer ${tokenResult.token}`,
          "X-PM-Device-Fingerprint": deviceFingerprint,
          ...(fixtureId ? { "X-PetManager-Fixture": fixtureId } : {}),
        },
      });
      const result = (await response.json().catch(() => ({}))) as {
        services?: SignupServicePrice[];
        message?: string;
        code?: string;
      };
      if (!response.ok || !result.services?.length) {
        if (result.code !== "PURGE_FAILED") setAnalysisAccess(null);
        const unavailable = response.status === 503 || result.code === "VISION_UNAVAILABLE";
        setState(unavailable ? "unavailable" : "failed");
        setMessage(`${result.message ?? "사진을 판독하지 못했습니다."} 촬영한 사진은 이 화면에 남아 있으니 보면서 직접 입력할 수 있어요.`);
        if (services.length === 0) changeServices([emptyService()]);
        return;
      }
      changeServices(result.services);
      setState("ready");
      setMessage("사진에서 읽은 내용을 불러왔습니다.");
    } catch {
      setState("failed");
      setMessage("사진 판독 서버에 연결하지 못했습니다. 촬영한 사진을 보면서 직접 입력할 수 있어요.");
      if (services.length === 0) changeServices([emptyService()]);
    } finally {
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      if (galleryInputRef.current) galleryInputRef.current.value = "";
    }
  };

  const valid =
    services.length > 0 &&
    services.every((service) => service.name.trim() && service.price >= 0 && service.durationMinutes >= 5);

  const confirmServices = async () => {
    if (!(await purgeAnalysis("confirmed"))) return;
    setConfirmed(true);
  };

  const goBack = async () => {
    if (!(await purgeAnalysis("cancelled"))) return;
    onBack();
  };

  return (
    <main className="min-h-screen bg-white px-4 py-4 text-[#172033] sm:px-6 sm:py-6">
      <div className="mx-auto max-w-[980px]">
        <section className="overflow-hidden bg-white">
          <div className="grid lg:grid-cols-[0.72fr_1.28fr]">
            <div className="bg-[#eef3f8] p-5 sm:p-7">
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                className="hidden"
                onChange={(event) => void analyze(event.target.files?.[0] ?? null)}
              />
              <input ref={galleryInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => void analyze(event.target.files?.[0] ?? null)} />
              {previewUrl ? <div className="relative mt-5 h-36 overflow-hidden rounded-2xl border border-[#cbd6e3] bg-white"><Image src={previewUrl} alt="선택한 요금표 사진" fill unoptimized className="object-contain" /></div> : <div className="mt-5 flex h-32 flex-col items-center justify-center rounded-2xl border border-dashed border-[#9fb1c6] bg-white text-[#1d3557]"><ImagePlus className="h-7 w-7" /><span className="mt-2 text-[14px] font-bold">요금표 사진을 준비해 주세요</span><span className="mt-1 text-[11px] text-[#64748b]">JPG · PNG · WEBP, 최대 8MB</span></div>}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => cameraInputRef.current?.click()} disabled={state === "loading"} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#17243c] text-[12px] font-bold text-white disabled:opacity-60">{state === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}촬영</button>
                <button type="button" onClick={() => galleryInputRef.current?.click()} disabled={state === "loading"} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[#cbd6e3] bg-white text-[12px] font-bold text-[#42536a]"><ImagePlus className="h-4 w-4" />이미지 선택</button>
              </div>
              {fileName ? <p className="mt-2 truncate text-center text-[11px] text-[#64748b]"><RotateCcw className="mr-1 inline h-3.5 w-3.5" />{fileName}</p> : null}
              <button type="button" onClick={() => void startManual()} disabled={purging} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#cbd6e3] bg-white text-[13px] font-bold text-[#42536a] disabled:opacity-60">
                <PencilLine className="h-4 w-4" />직접 입력
              </button>
              <div className="mt-4 rounded-xl bg-white/80 p-3 text-[12px] leading-5 text-[#607080]">
                <ShieldCheck className="mr-1 inline h-4 w-4 text-[#1f7a55]" />사진은 판독 요청 메모리에서만 사용 후 폐기하며 서버·Storage에 보관하지 않습니다.
              </div>
            </div>

            <div className="p-5 sm:p-7">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-[20px] font-extrabold">{state === "ready" ? signupPriceGuideReviewCopy.label : "서비스·상세 요금 확인"}</h2>
                  <p className="mt-1 text-[13px] text-[#64748b]">{state === "ready" ? signupPriceGuideReviewCopy.supporting : "서비스명, 가격, 시간, 대상 기준을 확인해 주세요."}</p>
                </div>
                <span className="shrink-0 rounded-full bg-[#edf2f7] px-3 py-1.5 text-[11px] font-bold text-[#526174]">
                  {state === "ready" ? "AI 임시 목록" : state === "unavailable" ? "판독 불가" : "브라우저 임시값"}
                </span>
              </div>
              {message ? (
                <p className={`mt-4 rounded-xl px-4 py-3 text-[12px] font-semibold leading-5 ${state === "unavailable" || state === "failed" ? "bg-[#fff2ef] text-[#a84435]" : "bg-[#f2f6fb] text-[#526174]"}`}>{message}</p>
              ) : null}
              {services.length === 0 ? (
                <div className="mt-5 flex min-h-64 flex-col items-center justify-center rounded-2xl border border-[#e1e7ef] bg-[#fafbfd] text-center">
                  <FileImage className="h-8 w-8 text-[#9aa8b8]" />
                  <p className="mt-3 text-[14px] font-bold text-[#526174]">사진을 올리거나 직접 입력해 주세요</p>
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  {services.map((service, index) => (
                    <div key={service.id} className="rounded-2xl border border-[#dce4ed] p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <strong className="text-[13px]">서비스 {index + 1}</strong>
                        {services.length > 1 ? <button type="button" onClick={() => changeServices(services.filter((item) => item.id !== service.id))} aria-label={`서비스 ${index + 1} 삭제`} className="rounded-lg p-1.5 text-[#8b98a9] hover:bg-[#f2f4f7]"><Trash2 className="h-4 w-4" /></button> : null}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="text-[12px] font-bold text-[#607080]">서비스명<input className={fieldClass} value={service.name} onChange={(event) => update(service.id, "name", event.target.value)} placeholder="예: 전체 미용" /></label>
                        <label className="text-[12px] font-bold text-[#607080]">상세 항목<input className={fieldClass} value={service.detailName} onChange={(event) => update(service.id, "detailName", event.target.value)} placeholder="예: 기본 컷" /></label>
                        <label className="text-[12px] font-bold text-[#607080]">기본 가격<input className={fieldClass} inputMode="numeric" value={service.price || ""} onChange={(event) => update(service.id, "price", Number(event.target.value.replace(/\D/g, "")))} placeholder="예: 80000" /></label>
                        <label className="text-[12px] font-bold text-[#607080]">예상 시간(분)<input className={fieldClass} inputMode="numeric" value={service.durationMinutes || ""} onChange={(event) => update(service.id, "durationMinutes", Number(event.target.value.replace(/\D/g, "")))} /></label>
                        <label className="text-[12px] font-bold text-[#607080]">동물<select className={fieldClass} value={service.species} onChange={(event) => update(service.id, "species", event.target.value as SignupServicePrice["species"])}><option value="dog">강아지</option><option value="cat">고양이</option><option value="all">공통</option></select></label>
                        <label className="text-[12px] font-bold text-[#607080]">품종·그룹<input className={fieldClass} value={service.breedGroup} onChange={(event) => update(service.id, "breedGroup", event.target.value)} placeholder="예: 말티즈·푸들" /></label>
                        <label className="text-[12px] font-bold text-[#607080]">체중 구간<input className={fieldClass} value={service.weightBand} onChange={(event) => update(service.id, "weightBand", event.target.value)} placeholder="예: 5kg 이하" /></label>
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={() => changeServices([...services, emptyService()])} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#aebdce] text-[13px] font-bold text-[#526174]"><Plus className="h-4 w-4" />서비스 추가</button>
                </div>
              )}
              {confirmed ? <p className="mt-5 rounded-xl bg-[#edf7f2] px-4 py-3 text-[12px] font-bold text-[#177856]"><CheckCircle2 className="mr-1 inline h-4 w-4" />수정한 구조화 요금만 가입 요청에 포함됩니다.</p> : null}
              <div className="mt-5 grid grid-cols-[0.42fr_1fr] gap-3">
                <button type="button" onClick={() => void goBack()} disabled={purging} className="h-12 rounded-xl border border-[#ccd6e2] text-[13px] font-bold text-[#526174] disabled:opacity-60">이전</button>
                {confirmed ? <button type="button" onClick={onNext} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#17243c] text-[14px] font-bold text-white">가입 정보 입력 <ArrowRight className="h-4 w-4" /></button> : <button type="button" onClick={() => void confirmServices()} disabled={!valid || state === "loading" || purging} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#17243c] text-[14px] font-bold text-white disabled:bg-[#c2cbd6]">{purging ? "임시정보 정리 중" : "검토 완료하고 저장"} <CheckCircle2 className="h-4 w-4" /></button>}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
