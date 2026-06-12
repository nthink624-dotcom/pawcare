"use client";

const pendingItems = [
  { pet: "우유", guardian: "정우진", service: "스포팅 + 얼굴컷", staff: "미배정", duration: "90분" },
  { pet: "만세", guardian: "박수현", service: "전체 미용", staff: "정우진", duration: "120분" },
  { pet: "콩이", guardian: "김하늘", service: "목욕", staff: "박수현", duration: "60분" },
];

const confirmedItems = [
  { pet: "루이", guardian: "한지민", service: "전체 미용", staff: "정우진", duration: "120분" },
  { pet: "모카", guardian: "이도윤", service: "목욕 + 부분컷", staff: "박수현", duration: "80분" },
];

function DemoAppointmentCard({
  item,
  mode,
  sequenceLabel,
  time,
}: {
  item: { pet: string; guardian: string; service: string; staff: string; duration: string };
  mode: "pending" | "confirmed";
  sequenceLabel?: string;
  time?: string;
}) {
  const monogram = sequenceLabel ? sequenceLabel.replace("요청 ", "") : item.pet.slice(0, 1);

  return (
    <div className="rounded-[12px] border border-[#e7edf4] bg-white px-3 py-2">
      <div className="flex items-center gap-2">
        {time ? (
          <>
            <span className="w-[52px] shrink-0 text-[16px] leading-6 tracking-[-0.02em] text-[#0f172a]">{time}</span>
            <span className="h-8 w-px shrink-0 bg-[#e1e7ef]" />
          </>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#edf4f3] text-[16px] font-medium text-[#475569]">{monogram}</span>
            <div className="min-w-0">
              <p className="truncate text-[16px] font-medium leading-[22px] text-[#0f172a]">{item.pet} <span className="font-normal text-[#6b7280]">({item.guardian})</span></p>
              <p className="truncate text-[16px] leading-[22px] text-[#6b7280]">{item.service} · {item.staff} · {item.duration}</p>
            </div>
          </div>
        </div>
        {mode === "pending" ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <button className="h-8 rounded-full border border-[#111827] bg-[#111827] px-3 text-[16px] text-white">승인</button>
            <button className="h-8 rounded-full border border-[#e1e7ef] bg-white px-3 text-[16px] text-[#334155]">미승인</button>
          </div>
        ) : (
          <span className="shrink-0 rounded-full border border-[#e1e7ef] bg-[#f8fafc] px-3 py-1 text-[16px] leading-[20px] text-[#334155]">
            확정
          </span>
        )}
      </div>
    </div>
  );
}

function TimeGroup({
  time,
  subtitle,
  items,
  mode,
}: {
  time: string;
  subtitle: string;
  items: Array<{ pet: string; guardian: string; service: string; staff: string; duration: string }>;
  mode: "pending" | "confirmed";
}) {
  const groupLabel = mode === "pending" ? "동시간 요청" : "동시간 확정";

  return (
    <section className="rounded-[18px] border border-[#e1e7ef] bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[16px] leading-[22px] text-[#6b7280]">{subtitle}</p>
          <h2 className="mt-1 text-[20px] font-medium leading-[26px] tracking-[-0.03em] text-[#0f172a]">
            {mode === "pending" ? "승인대기" : "예약현황"}
          </h2>
        </div>
      </div>
      {items.length > 1 ? (
        <div className="mb-2 flex items-center gap-2">
          <div className="flex items-baseline gap-2 rounded-full bg-[#f8fafc] px-3 py-1.5">
            <span className="text-[18px] font-medium leading-6 tracking-[-0.03em] text-[#0f172a]">{time}</span>
            <span className="text-[16px] leading-[22px] text-[#6b7280]">{groupLabel} {items.length}건</span>
          </div>
          <div className="h-px min-w-0 flex-1 bg-[#e1e7ef]" />
        </div>
      ) : null}
      <div className="space-y-3">
        {items.map((item, index) => (
          <DemoAppointmentCard key={`${item.pet}-${item.guardian}`} item={item} mode={mode} sequenceLabel={items.length > 1 ? `요청 ${index + 1}` : undefined} time={items.length === 1 ? time : undefined} />
        ))}
      </div>
    </section>
  );
}

export default function OwnerMobileTimeGroupsDemoPage() {
  return (
    <main className="min-h-screen bg-[#f8fafc] px-4 py-5">
      <div className="mx-auto w-full max-w-[430px] space-y-4">
        <header className="rounded-[18px] border border-[#e1e7ef] bg-white p-4">
          <p className="text-[16px] leading-[22px] text-[#6b7280]">동시간 예약 표시 데모</p>
          <h1 className="mt-1 text-[24px] font-medium leading-[30px] tracking-[-0.03em] text-[#0f172a]">
            승인 방식에 따라 이렇게 보여요
          </h1>
        </header>

        <TimeGroup
          mode="pending"
          time="10:00"
          subtitle="수동 승인 모드"
          items={pendingItems}
        />

        <TimeGroup
          mode="confirmed"
          time="14:00"
          subtitle="바로 승인 모드"
          items={confirmedItems}
        />

        <section className="rounded-[18px] border border-[#e1e7ef] bg-white p-4">
          <p className="text-[16px] leading-[24px] text-[#334155]">
            수용 가능 인원을 넘는 경우에는 자동 확정하지 않고, 별도 확인이 필요한 예약으로 분리하는 흐름을 권장합니다.
          </p>
        </section>
      </div>
    </main>
  );
}
