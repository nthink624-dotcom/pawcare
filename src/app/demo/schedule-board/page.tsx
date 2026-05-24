const staffColumns = [
  {
    name: "정우진",
    role: "디자이너",
    card: {
      pet: "우유",
      guardian: "정우진",
      service: "스포팅",
      time: "11:10-13:00",
      top: "76px",
      height: "118px",
      tone: "emerald",
    },
  },
  {
    name: "서하늘",
    role: "실장",
    card: {
      pet: "몽이",
      guardian: "김민지",
      service: "전체 미용",
      time: "12:20-14:10",
      top: "144px",
      height: "118px",
      tone: "amber",
    },
  },
  {
    name: "민서윤",
    role: "디자이너",
    card: {
      pet: "토리",
      guardian: "문채원",
      service: "목욕",
      time: "12:40-13:50",
      top: "164px",
      height: "108px",
      tone: "sky",
    },
  },
];

const timeRows = ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00"];

const toneClasses = {
  emerald: "border-[#4b8c79] bg-[#eaf5f1] text-[#173f36]",
  amber: "border-[#c58f4b] bg-[#fff4df] text-[#5b3d16]",
  sky: "border-[#5f8eb6] bg-[#ecf5ff] text-[#243f58]",
};

export default function ScheduleBoardDiagramPage() {
  return (
    <main className="min-h-screen bg-[#f3f0ea] px-6 py-8 text-[#25231f]">
      <section className="mx-auto w-fit">
        <div className="mb-4 flex items-end justify-between gap-6">
          <div>
            <p className="text-sm font-semibold text-[#7b7569]">Notion capture diagram</p>
            <h1 className="mt-1 text-2xl font-black">[1] 예약 보드</h1>
          </div>
          <p className="text-sm font-semibold text-[#7b7569]">430px 앱 IA를 설명하는 웹 캡처용 그림</p>
        </div>

        <div className="overflow-hidden rounded-[8px] border-2 border-[#2d2a25] bg-white shadow-[0_24px_60px_rgba(37,35,31,0.14)]">
          <div className="flex h-[76px] items-center justify-between border-b-2 border-[#2d2a25] bg-[#fbfaf7] px-6">
            <div>
              <p className="text-[13px] font-black text-[#5f6d63]">날짜 / 오늘 / 직원 수 / 담당 필터</p>
              <p className="mt-1 text-xl font-black">2026.05.12 화요일 · 오늘 · 직원 3명</p>
            </div>
            <div className="flex items-center gap-2 text-sm font-bold">
              <span className="rounded-full border border-[#cfc7b9] bg-white px-3 py-2">오늘</span>
              <span className="rounded-full border border-[#cfc7b9] bg-white px-3 py-2">전체 담당</span>
            </div>
          </div>

          <div className="grid w-[1040px] grid-cols-[124px_repeat(3,1fr)]">
            <aside className="border-r-2 border-[#2d2a25] bg-[#f7f4ed]">
              <div className="flex h-[92px] flex-col justify-center border-b-2 border-[#2d2a25] px-4">
                <p className="text-lg font-black">[3]</p>
                <p className="text-base font-black">시간 레일</p>
              </div>
              <div className="relative h-[360px]">
                {timeRows.map((time, index) => (
                  <div
                    className="flex h-[60px] items-start border-b border-[#d7d0c4] px-4 pt-3 text-[15px] font-black text-[#544f47]"
                    key={time}
                  >
                    {index === 0 ? <span className="mr-2 text-[#827b70]">시간</span> : null}
                    {time}
                  </div>
                ))}
              </div>
            </aside>

            {staffColumns.map((staff, columnIndex) => (
              <section
                className={columnIndex === staffColumns.length - 1 ? "" : "border-r-2 border-[#2d2a25]"}
                key={staff.name}
              >
                <div className="flex h-[92px] flex-col justify-center border-b-2 border-[#2d2a25] bg-[#fcfbf8] px-5">
                  <p className="text-[15px] font-black text-[#7b7569]">[2] 직원 컬럼</p>
                  <div className="mt-1 flex items-center justify-between">
                    <div>
                      <p className="text-xl font-black">{staff.name}</p>
                      <p className="mt-0.5 text-[13px] font-bold text-[#7b7569]">{staff.role}</p>
                    </div>
                    <span className="rounded-full border border-[#d2cabc] bg-white px-3 py-1 text-xs font-black">
                      가능
                    </span>
                  </div>
                </div>

                <div className="relative h-[360px] bg-white">
                  <div className="absolute inset-x-0 top-0 z-0">
                    {timeRows.map((time) => (
                      <div className="h-[60px] border-b border-[#e3ddd3]" key={`${staff.name}-${time}`} />
                    ))}
                  </div>

                  <div className="absolute left-5 top-4 z-10 rounded-full border border-[#d2cabc] bg-[#fbfaf7] px-3 py-1 text-[13px] font-black text-[#6a6258]">
                    [4] 예약 레인
                  </div>

                  <article
                    className={`absolute left-5 right-5 z-20 rounded-[8px] border-2 p-4 shadow-[0_12px_28px_rgba(37,35,31,0.12)] ${
                      toneClasses[staff.card.tone as keyof typeof toneClasses]
                    }`}
                    style={{ top: staff.card.top, height: staff.card.height }}
                  >
                    <p className="text-[13px] font-black">예약카드</p>
                    <p className="mt-2 text-xl font-black">
                      {staff.card.pet} · {staff.card.guardian}
                    </p>
                    <p className="mt-2 text-[13px] font-bold opacity-80">
                      {staff.card.service} · {staff.card.time}
                    </p>
                  </article>
                </div>
              </section>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
