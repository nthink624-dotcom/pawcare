export function OwnerStartupNotice({ capturedAt, retry }: { capturedAt: number; retry?: () => void }) {
  return (
    <div role="status" className="flex min-h-11 items-center justify-between gap-3 border-b border-[#e7dfd2] bg-[#fff9ef] px-4 py-2 text-[13px] leading-5 text-[#645743]">
      <span>최근 일정 · {new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(capturedAt)} 확인<br />최신 예약 확인 중 · 입력은 바로 할 수 있어요</span>
      {retry ? <button type="button" onClick={retry} className="min-h-11 shrink-0 rounded-[8px] px-3 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">다시 확인</button> : null}
    </div>
  );
}
