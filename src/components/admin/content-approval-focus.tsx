"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type ReviewContent = { id: string; channel: string; title: string; status: string; truthStatus: string; customerCopy: string; factStatus: string; facts: string[]; changeReasons: string[]; context: { exposure: string; format: string; size: string; count: number; review: string }; slides: Array<{ title: string; lead: string; url: string }> };

export default function ContentApprovalFocus() {
  const router = useRouter();
  const [contents, setContents] = useState<ReviewContent[]>([]);
  const [activeId, setActiveId] = useState("D6");
  const [slide, setSlide] = useState(0);
  const [decision, setDecision] = useState<"승인" | "수정 요청" | "보류" | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { fetch("/api/admin/marketing/content-review", { cache: "no-store" }).then(async (response) => { if (!response.ok) throw new Error("검수 자료 연결 실패"); return response.json(); }).then((value) => setContents(value.contents)).catch((cause) => setError(cause instanceof Error ? cause.message : "검수 자료 연결 실패")); }, []);
  const active = useMemo(() => contents.find((item) => item.id === activeId) ?? contents[0], [activeId, contents]);
  const reviewable = Boolean(active?.customerCopy && active.slides.length > 0 && active.factStatus === "PASS" && active.truthStatus !== "unverified");
  function selectContent(id: string) {
    setActiveId(id);
    setSlide(0);
    setDecision(null);
    setError(null);
  }
  return <main className="h-[100dvh] overflow-hidden bg-white p-4 text-[#111111]">
    <div className="mx-auto flex h-full max-w-[1320px] flex-col">
      <header className="flex min-h-12 items-center justify-between border-b border-[#e5e7eb]"><div className="min-w-0"><p className="truncate text-[16px] font-medium">성장팀 · D1~D7 마케팅 콘텐츠 재검수 · 승인 대기</p><p className="text-[13px] text-[#6b7280]">외부 공개·게시·자동 실행 없음</p></div><button type="button" onClick={() => router.back()} className="min-h-11 border border-[#e5e7eb] px-3 text-[15px] font-medium">목록으로</button></header>
      <nav className="mt-3 grid grid-cols-7 border border-[#e5e7eb]" aria-label="검수 콘텐츠 선택">{contents.map((item) => <button key={item.id} type="button" onClick={() => selectContent(item.id)} className={`min-h-11 border-r border-[#e5e7eb] text-[15px] font-medium last:border-r-0 ${active?.id === item.id ? "bg-black text-white" : "bg-white"}`}>{item.id}</button>)}</nav>
      {error ? <div className="mt-3 border border-[#111] p-4 text-[16px]">검토 불가 · {error}</div> : active ? <>
        <section className="mt-3 grid grid-cols-2 gap-x-5 border-y border-[#e5e7eb] py-2 text-[14px] lg:grid-cols-6"><Meta label="채널" value={active.channel} /><Meta label="노출 위치" value={active.context.exposure} /><Meta label="자산 형식" value={active.context.format} /><Meta label="크기" value={active.context.size} /><Meta label="장수" value={`${active.context.count}장`} /><Meta label="검토 항목" value={active.context.review} /></section>
        <section className="mt-3 grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(360px,.85fr)_minmax(0,1.15fr)]">
          <div className="flex min-h-0 flex-col border border-[#e5e7eb] p-3"><div className="flex items-center justify-between"><h1 className="text-[20px] font-semibold">{active.id} · {active.title}</h1><span className="text-[14px]">{reviewable ? "검토 가능" : "검토 불가"}</span></div><div className="relative mt-2 min-h-0 flex-1 bg-[#f3f4f6]"><Image src={active.slides[slide]?.url ?? ""} alt={`${active.id} 고객 노출 이미지 ${slide + 1}`} fill unoptimized sizes="(max-width: 1024px) 100vw, 45vw" className="object-contain" onError={() => setError("이미지 로드 실패")} /></div><div className="mt-2 flex items-center justify-between text-[14px]"><button type="button" disabled={slide === 0} onClick={() => setSlide((value) => value - 1)} className="min-h-11 px-3 disabled:text-[#9ca3af]">이전</button><span>{slide + 1} / {active.slides.length}</span><button type="button" disabled={slide >= active.slides.length - 1} onClick={() => setSlide((value) => value + 1)} className="min-h-11 px-3 disabled:text-[#9ca3af]">다음</button></div></div>
          <div className="min-h-0 overflow-auto border border-[#e5e7eb] p-4"><h2 className="text-[18px] font-medium">고객 노출 전체 문구</h2><p className="mt-2 whitespace-pre-wrap text-[15px] leading-6">{active.customerCopy || "캡션 누락 · 검토 불가"}</p><h2 className="mt-5 border-t border-[#e5e7eb] pt-4 text-[18px] font-medium">변경 이유</h2><ul className="mt-2 space-y-2 text-[14px] leading-5">{active.changeReasons.length ? active.changeReasons.map((reason) => <li key={reason}>· {reason}</li>) : <li>· 원본·근거 미확보로 제작하지 않음</li>}</ul><p className="mt-4 border-t border-[#e5e7eb] pt-4 text-[14px]">사실 검수 · {active.truthStatus === "unverified" ? "미검증" : `${active.factStatus} · ${active.facts.join(", ")}`}</p></div>
        </section>
        <footer className="mt-3 flex items-center justify-between border-t border-[#e5e7eb] pt-3"><p className="text-[14px] text-[#6b7280]">{decision ? `${decision} 선택됨 · 저장·게시 없음` : reviewable ? "결정을 선택하세요" : "자산 또는 문구가 없어 결정할 수 없습니다."}</p><div className="flex gap-2">{(["승인", "수정 요청", "보류"] as const).map((value) => <button key={value} type="button" disabled={!reviewable} onClick={() => setDecision(value)} className={`min-h-11 px-4 text-[15px] font-medium disabled:bg-[#e5e7eb] disabled:text-[#9ca3af] ${decision === value ? "bg-black text-white" : "border border-[#111] bg-white"}`}>{value}</button>)}</div></footer>
      </> : <p className="mt-4 text-[16px]">검수 자료를 불러오는 중입니다.</p>}
    </div>
  </main>;
}

function Meta({ label, value }: { label: string; value: string }) { return <div className="min-w-0 py-1"><span className="block text-[13px] text-[#6b7280]">{label}</span><span className="block truncate text-[14px]">{value}</span></div>; }
