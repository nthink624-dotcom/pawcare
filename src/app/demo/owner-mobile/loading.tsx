export default function OwnerMobileEmbedLoading() {
  return (
    <main className="owner-font min-h-screen w-full max-w-[430px] overflow-x-hidden bg-[#f7f8fa] px-4 pt-4" data-petmanager-embed="owner-mobile" data-petmanager-embed-state="loading" aria-busy="true" aria-label="모바일 운영 화면을 불러오는 중">
      <div className="animate-pulse rounded-[12px] border border-[#edf1f5] bg-white px-4 py-4">
        <div className="h-4 w-28 rounded bg-[#e8edf4]" />
        <div className="mt-4 h-12 rounded-[10px] bg-[#eef2f7]" />
      </div>
      <div className="mt-3 space-y-3">
        {[0, 1, 2].map((item) => <div key={item} className="h-[72px] animate-pulse rounded-[12px] border border-[#edf1f5] bg-white" />)}
      </div>
    </main>
  );
}
