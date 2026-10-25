import OwnerPage from "@/app/owner/page";

function OwnerMobileFailureScreen({
  failure,
  onRetry,
}: {
  failure: OwnerMobileLoadFailure;
  onRetry: () => void;
}) {
  return (
    <main className="owner-font mx-auto flex min-h-screen w-full max-w-[430px] items-center bg-[#f7f8fa] px-5 py-8 text-[#15213b]">
      <section
        className="w-full rounded-[14px] border border-[#e8edf3] bg-white px-5 py-5"
        role="alert"
        aria-labelledby="owner-mobile-load-failure-title"
      >
        <p className="text-[14px] font-medium leading-5 tracking-[-0.005em] text-[#9a5e4e]">확인 필요</p>
        <h1
          id="owner-mobile-load-failure-title"
          className="mt-2 text-[20px] font-semibold leading-7 tracking-[-0.015em] text-[#15213b]"
        >
          {failure.title}
        </h1>
        <p className="mt-2 text-[16px] font-normal leading-6 text-[#64748b]">{failure.message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 flex min-h-[44px] w-full items-center justify-center rounded-[10px] bg-[#111a30] px-4 py-2.5 text-[16px] font-medium leading-6 tracking-[-0.005em] text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]"
        >
          {failure.actionLabel}
        </button>
      </section>
    </main>
  );
}

export default function OwnerMobilePage() {
  return <OwnerPage mobileRoute />;
}
