import { notFound } from "next/navigation";

const bookings = [
  { id: "one", top: 76, name: "두부 · 김다은", time: "10:00–11:30", service: "전체미용" },
  { id: "two", top: 224, name: "초코 · 이서윤", time: "13:00–14:00", service: "목욕 + 부분정리" },
  { id: "three", top: 350, name: "마루 · 박지현", time: "15:30–16:30", service: "위생 미용" },
];

function BookingCard({
  booking,
  variant,
}: {
  booking: (typeof bookings)[number];
  variant: "badge" | "dot";
}) {
  return (
    <button
      type="button"
      data-preview-variant={variant}
      className="group absolute left-3 right-3 h-[72px] rounded-[7px] border border-[#e5e7eb] bg-white px-3 py-2.5 text-left outline-none transition-colors hover:border-[#111111] hover:bg-[#fafafa] focus-visible:border-[#111111] focus-visible:bg-[#fafafa]"
      style={{ top: booking.top }}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0 truncate text-[15px] font-medium leading-5 text-[#111111]">{booking.name}</span>
        <span className="shrink-0 text-[13px] font-normal tabular-nums leading-5 text-[#6b7280]">{booking.time}</span>
      </span>
      <span className="mt-1.5 flex min-w-0 items-center gap-2">
        {variant === "badge" ? (
          <span className="shrink-0 rounded-[4px] bg-[#111111] px-1.5 py-0.5 text-[11px] font-medium leading-4 text-white">확정</span>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium leading-4 text-[#4b5563]">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#64748b]" />
            확정
          </span>
        )}
        <span className="min-w-0 truncate text-[13px] font-normal leading-4 text-[#6b7280]">{booking.service}</span>
      </span>
    </button>
  );
}

function ScheduleOption({
  label,
  title,
  description,
  variant,
}: {
  label: string;
  title: string;
  description: string;
  variant: "badge" | "dot";
}) {
  return (
    <section aria-labelledby={`${variant}-title`} className="min-w-0">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <p className="text-[12px] font-medium tracking-[0.08em] text-[#6b7280]">{label}</p>
          <h2 id={`${variant}-title`} className="mt-1 text-[18px] font-semibold tracking-[-0.02em] text-[#111111]">{title}</h2>
        </div>
        <p className="text-right text-[13px] text-[#6b7280]">{description}</p>
      </div>

      <div className="overflow-hidden rounded-[8px] border border-[#e5e7eb] bg-white">
        <div className="grid h-12 grid-cols-[58px_1fr] border-b border-[#e5e7eb]">
          <div className="border-r border-[#e5e7eb]" />
          <div className="flex items-center justify-center text-[14px] font-medium text-[#111111]">도윤 디자이너</div>
        </div>
        <div className="grid grid-cols-[58px_1fr]">
          <div className="relative h-[458px] border-r border-[#e5e7eb] bg-white">
            {["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"].map((time, index) => (
              <span key={time} className="absolute right-2 text-[12px] tabular-nums text-[#9ca3af]" style={{ top: 22 + index * 54 }}>
                {time}
              </span>
            ))}
          </div>
          <div className="relative h-[458px] bg-white [background-image:repeating-linear-gradient(to_bottom,transparent_0,transparent_53px,#f3f4f6_53px,#f3f4f6_54px)]">
            {bookings.map((booking) => <BookingCard key={booking.id} booking={booking} variant={variant} />)}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function AppointmentCardMonotonePreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main className="min-h-screen bg-white px-6 py-6 text-[#111111] lg:px-8">
      <div className="mx-auto max-w-[1320px]">
        <header className="mb-5 flex items-end justify-between border-b border-[#e5e7eb] pb-4">
          <div>
            <p className="text-[13px] font-medium text-[#6b7280]">개발 Preview · 운영 데이터 미사용</p>
            <h1 className="mt-1 text-[26px] font-bold tracking-[-0.03em]">예약 카드 모노톤 A/B</h1>
          </div>
          <p className="text-[13px] text-[#6b7280]">동일 데이터 · 일정표 실제 크기</p>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ScheduleOption
            label="OPTION A"
            title="완전 모노톤"
            description="검정 확정 배지"
            variant="badge"
          />
          <ScheduleOption
            label="OPTION B"
            title="모노톤 + 상태 점"
            description="저채도 상태 점 1개"
            variant="dot"
          />
        </div>
      </div>
    </main>
  );
}
