import { Check, Clock3, Eye, ImageIcon, Send, Sparkles } from "lucide-react";
import { notFound } from "next/navigation";

type Tone = "neutral" | "blue";

const rows = [
  { time: "10:30", pet: "두부", guardian: "김다은", status: "확인 필요" },
  { time: "13:00", pet: "초코", guardian: "이서윤", status: "AI 초안" },
  { time: "15:30", pet: "마루", guardian: "박지현", status: "발송 완료" },
];

function CareReportPanel({ tone }: { tone: Tone }) {
  const blue = tone === "blue";
  const shell = blue ? "border-[#cddcf0] bg-[#f3f7fd]" : "border-[#dfe4e9] bg-[#f7f8fa]";
  const title = blue ? "text-[#243d63]" : "text-[#27313d]";
  const muted = blue ? "text-[#6680a3]" : "text-[#6e7884]";
  const selected = blue ? "border-[#b8cdea] bg-[#e7f0fc]" : "border-[#d7dde4] bg-[#eef1f4]";
  const accent = blue ? "bg-[#5f7fae]" : "bg-[#65717f]";

  return (
    <section className={`overflow-hidden rounded-[24px] border shadow-[0_20px_55px_rgba(38,55,77,0.10)] ${shell}`}>
      <div className="flex items-center justify-between border-b border-black/[0.06] px-7 py-5">
        <div>
          <p className={`text-[12px] font-semibold tracking-[0.08em] ${muted}`}>{blue ? "OPTION B · PASTEL BLUE" : "OPTION A · NEUTRAL"}</p>
          <h2 className={`mt-1 text-[24px] font-semibold tracking-[-0.04em] ${title}`}>케어리포트 관리</h2>
        </div>
        <div className="flex gap-2">
          <span className="rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-[#697586] shadow-sm">오늘 3건</span>
          <span className="rounded-full bg-[#fff0ed] px-3 py-1.5 text-[12px] font-semibold text-[#c86264]">확인 필요 1</span>
        </div>
      </div>

      <div className="grid grid-cols-[230px_minmax(0,1fr)] gap-4 p-4">
        <aside className="rounded-[18px] border border-black/[0.06] bg-white p-3">
          <div className="flex items-center justify-between px-2 pb-3 pt-1">
            <p className={`text-[13px] font-semibold ${title}`}>오늘 예약</p>
            <span className={`text-[11px] ${muted}`}>8월 18일</span>
          </div>
          <div className="space-y-2">
            {rows.map((row, index) => (
              <div key={row.pet} className={`rounded-[14px] border p-3 ${index === 0 ? selected : "border-transparent bg-white"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[12px] font-semibold ${muted}`}>{row.time}</span>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                    row.status === "발송 완료"
                      ? "bg-[#eef7f1] text-[#4f8062]"
                      : row.status === "AI 초안"
                        ? blue ? "bg-[#edf3fb] text-[#5876a0]" : "bg-[#f0f2f4] text-[#687482]"
                        : "bg-[#fff0ed] text-[#c86264]"
                  }`}>{row.status}</span>
                </div>
                <p className={`mt-2 text-[15px] font-semibold ${title}`}>{row.pet}</p>
                <p className={`mt-0.5 text-[12px] ${muted}`}>{row.guardian} 보호자</p>
              </div>
            ))}
          </div>
        </aside>

        <div className="rounded-[18px] border border-black/[0.06] bg-white p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className={`text-[20px] font-semibold tracking-[-0.03em] ${title}`}>두부의 케어리포트</h3>
                <span className="rounded-full bg-[#fff0ed] px-2.5 py-1 text-[11px] font-semibold text-[#c86264]">확인 필요</span>
              </div>
              <p className={`mt-1 text-[12px] ${muted}`}>전체미용 · 김서연 디자이너 · 10:30</p>
            </div>
            <button className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-black/10 bg-white px-3 text-[12px] font-semibold text-[#596575]">
              <Eye className="h-3.5 w-3.5" /> 고객 화면 미리보기
            </button>
          </div>

          <div className={`mt-4 rounded-[16px] border px-4 py-3 ${blue ? "border-[#c9daf0] bg-[#f4f8fe]" : "border-[#e0e5ea] bg-[#f8f9fa]"}`}>
            <p className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${blue ? "text-[#5878a6]" : "text-[#687482]"}`}>
              <Sparkles className="h-3.5 w-3.5" /> AI가 정리한 오늘의 한 줄
            </p>
            <p className={`mt-1.5 text-[15px] font-semibold ${title}`}>피부가 조금 건조해 보였지만 편안하게 미용을 마쳤어요.</p>
          </div>

          <div className="mt-4 grid grid-cols-[160px_minmax(0,1fr)] gap-4">
            <div className="grid grid-cols-2 gap-2">
              {["미용 전", "미용 후"].map((label) => (
                <div key={label} className={`flex min-h-[138px] flex-col items-center justify-center rounded-[14px] border ${blue ? "border-[#d4e1f2] bg-[#f5f8fc]" : "border-[#e2e6ea] bg-[#f7f8f9]"}`}>
                  <ImageIcon className={`h-5 w-5 ${muted}`} />
                  <span className={`mt-2 text-[11px] font-semibold ${muted}`}>{label}</span>
                </div>
              ))}
            </div>
            <div className="space-y-2.5">
              <div className="rounded-[13px] border border-black/[0.07] px-3.5 py-3">
                <p className={`text-[11px] font-semibold ${muted}`}>오늘 진행한 미용</p>
                <p className={`mt-1 text-[13px] leading-5 ${title}`}>몸 6mm · 얼굴은 둥글고 자연스럽게 정리</p>
              </div>
              <div className="rounded-[13px] border border-black/[0.07] px-3.5 py-3">
                <p className={`text-[11px] font-semibold ${muted}`}>홈케어 안내</p>
                <p className={`mt-1 text-[13px] leading-5 ${title}`}>귀 뒤쪽은 일주일에 2~3회 빗질해 주세요.</p>
              </div>
              <div className="flex items-center justify-between rounded-[13px] border border-black/[0.07] px-3.5 py-3">
                <span className={`inline-flex items-center gap-1.5 text-[12px] font-semibold ${muted}`}><Clock3 className="h-3.5 w-3.5" /> 다음 권장 방문</span>
                <strong className={`text-[13px] ${title}`}>9월 22일</strong>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-black/[0.07] pt-4">
            <span className={`inline-flex items-center gap-1.5 text-[12px] ${muted}`}><Check className="h-4 w-4" /> AI 초안 자동 저장됨</span>
            <button className="inline-flex h-10 items-center gap-2 rounded-[11px] bg-[#ef7d78] px-4 text-[13px] font-semibold text-white shadow-[0_8px_18px_rgba(220,102,100,0.20)]">
              <Send className="h-3.5 w-3.5" /> 확인 후 고객에게 발송
            </button>
          </div>
        </div>
      </div>
      <div className={`h-1.5 ${accent}`} />
    </section>
  );
}

export default function OwnerCareReportPalettePreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main className="min-h-screen bg-[#edf1f5] px-8 py-8">
      <div className="mx-auto max-w-[1560px]">
        <div className="mb-5">
          <p className="text-[13px] font-semibold text-[#6e7884]">OWNER PC · COLOR DIRECTION</p>
          <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.04em] text-[#27313d]">같은 화면, 다른 톤앤매너</h1>
        </div>
        <div className="grid grid-cols-2 gap-5">
          <CareReportPanel tone="neutral" />
          <CareReportPanel tone="blue" />
        </div>
      </div>
    </main>
  );
}
