import { CalendarDays, Check, ChevronLeft, Clock3, PawPrint, Sparkles } from "lucide-react";

type LandingBookingExperience = "first" | "ai" | "revisit";

function DemoHeader({ label }: { label: string }) {
  return (
    <header className="border-b border-[#e7ebf2] bg-white px-5 pb-4 pt-5">
      <div className="flex items-center justify-between">
        <ChevronLeft className="h-5 w-5 text-[#475569]" aria-hidden="true" />
        <p className="text-[15px] font-bold text-[#172033]">멍샵몽샵</p>
        <span className="w-5" aria-hidden="true" />
      </div>
      <p className="mt-4 text-[12px] font-semibold text-[#2563eb]">{label}</p>
    </header>
  );
}

function FirstVisitPreview() {
  return (
    <>
      <DemoHeader label="첫 방문 예약" />
      <main className="px-5 py-6">
        <h1 className="text-[24px] font-bold leading-[1.35] text-[#111827]">
          처음 방문하시나요?
          <br />필요한 정보만 알려주세요
        </h1>
        <p className="mt-2 text-[13px] leading-5 text-[#64748b]">한 번 등록하면 다음 예약부터 더 빠르게 진행할 수 있어요.</p>

        <div className="mt-7 space-y-4">
          {[
            ["보호자 이름", "김보리"],
            ["휴대폰 번호", "010-1234-5678"],
            ["반려동물 이름", "보리"],
          ].map(([label, value]) => (
            <label key={label} className="block">
              <span className="text-[12px] font-semibold text-[#475569]">{label}</span>
              <span className="mt-1.5 flex h-12 items-center rounded-[8px] border border-[#dbe2ea] bg-white px-4 text-[14px] text-[#172033]">
                {value}
              </span>
            </label>
          ))}
        </div>

        <button type="button" className="mt-7 h-12 w-full rounded-[8px] bg-[#2563eb] text-[15px] font-bold text-white">
          예약 가능한 시간 보기
        </button>
      </main>
    </>
  );
}

function AiRecommendationPreview() {
  const slots = [
    { time: "오전 10:30", note: "앞 예약과 자연스럽게 연결", recommended: true },
    { time: "오후 1:00", note: "여유 있게 방문 가능", recommended: false },
    { time: "오후 3:30", note: "오늘 마지막 예약", recommended: false },
  ];

  return (
    <>
      <DemoHeader label="AI 추천 시간" />
      <main className="px-5 py-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-[#eaf2ff] text-[#2563eb]">
          <Sparkles className="h-5 w-5" aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-[24px] font-bold leading-[1.35] text-[#111827]">가능한 시간 중<br />가장 좋은 시간을 찾았어요</h1>
        <div className="mt-6 flex items-center gap-2 rounded-[8px] bg-[#f6f8fb] px-4 py-3 text-[13px] font-semibold text-[#475569]">
          <CalendarDays className="h-4 w-4 text-[#2563eb]" aria-hidden="true" />
          8월 25일 화요일 · 목욕 + 부분정리
        </div>

        <div className="mt-4 space-y-3">
          {slots.map((slot) => (
            <div key={slot.time} className={`relative rounded-[8px] border p-4 ${slot.recommended ? "border-[#2563eb] bg-[#f6f9ff]" : "border-[#dbe2ea] bg-white"}`}>
              {slot.recommended ? <span className="absolute right-3 top-3 rounded-full bg-[#2563eb] px-2 py-1 text-[10px] font-bold text-white">AI 추천</span> : null}
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-[#2563eb]" aria-hidden="true" />
                <p className="text-[15px] font-bold text-[#172033]">{slot.time}</p>
              </div>
              <p className="mt-1 pl-6 text-[12px] text-[#64748b]">{slot.note}</p>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}

function RevisitPreview() {
  return (
    <>
      <DemoHeader label="재방문 예약" />
      <main className="px-5 py-6">
        <h1 className="text-[24px] font-bold leading-[1.35] text-[#111827]">보리의 지난 정보를<br />불러왔어요</h1>
        <p className="mt-2 text-[13px] leading-5 text-[#64748b]">달라진 내용만 확인하면 바로 다음 예약을 잡을 수 있어요.</p>

        <section className="mt-6 rounded-[12px] border border-[#dbe2ea] bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#eaf2ff] text-[#2563eb]">
              <PawPrint className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[17px] font-bold text-[#172033]">보리</p>
              <p className="mt-0.5 text-[12px] text-[#64748b]">말티푸 · 4.5kg</p>
            </div>
            <Check className="ml-auto h-5 w-5 text-[#2563eb]" aria-hidden="true" />
          </div>

          <dl className="mt-4 divide-y divide-[#edf0f4] border-t border-[#edf0f4] text-[13px]">
            <div className="flex justify-between py-3"><dt className="text-[#64748b]">지난 미용</dt><dd className="font-semibold text-[#172033]">목욕 + 부분정리</dd></div>
            <div className="flex justify-between py-3"><dt className="text-[#64748b]">담당 디자이너</dt><dd className="font-semibold text-[#172033]">서연</dd></div>
            <div className="flex justify-between py-3"><dt className="text-[#64748b]">최근 방문</dt><dd className="font-semibold text-[#172033]">6주 전</dd></div>
          </dl>
        </section>

        <button type="button" className="mt-6 h-12 w-full rounded-[8px] bg-[#2563eb] text-[15px] font-bold text-white">
          같은 내용으로 예약하기
        </button>
      </main>
    </>
  );
}

export default async function LandingBookingDemoPage({
  searchParams,
}: {
  searchParams: Promise<{ experience?: string }>;
}) {
  const { experience: requestedExperience } = await searchParams;
  const experience: LandingBookingExperience =
    requestedExperience === "ai" || requestedExperience === "revisit" ? requestedExperience : "first";

  return (
    <div className="min-h-screen bg-[#f6f8fb] font-sans">
      <div className="mx-auto min-h-screen w-full max-w-[430px] bg-white">
        {experience === "ai" ? <AiRecommendationPreview /> : experience === "revisit" ? <RevisitPreview /> : <FirstVisitPreview />}
      </div>
    </div>
  );
}
