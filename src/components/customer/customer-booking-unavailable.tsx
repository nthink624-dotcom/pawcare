import { OWNER_INITIAL_SETUP_REQUIRED_MESSAGE } from "@/server/owner-initial-setup-guard";

export default function CustomerBookingUnavailable() {
  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-[430px] items-center bg-white px-6 py-10 text-[#15213b]">
      <p className="w-full rounded-[14px] border border-[#e8edf3] bg-white px-5 py-6 text-center text-[16px] font-medium leading-6">
        {OWNER_INITIAL_SETUP_REQUIRED_MESSAGE}
      </p>
    </main>
  );
}
