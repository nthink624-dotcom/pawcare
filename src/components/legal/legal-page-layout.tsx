import Link from "next/link";

import LegalLinksFooter from "@/components/legal/legal-links-footer";

export default function LegalPageLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f6f7f9] text-[#17191c]">
      <header className="border-b border-[#dde2e7] bg-white">
        <div className="mx-auto w-full max-w-[1180px] px-5 py-8 md:px-8 lg:px-10 lg:py-10">
          <Link href="/" className="text-[13px] font-semibold text-[#52606d] hover:text-[#17191c]">
          ← 넘친Day 펫매니저 메인으로
          </Link>
          <h1 className="mt-6 text-[30px] font-extrabold md:text-[34px]">{title}</h1>
          <p className="mt-3 max-w-[820px] text-[14px] leading-6 text-[#66717c] md:text-[15px]">{subtitle}</p>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1180px] px-5 py-7 md:px-8 md:py-9 lg:px-10 lg:py-10">
        <div className="space-y-6">{children}</div>
        <LegalLinksFooter />
      </main>
    </div>
  );
}

export function LegalSection({ title, body }: { title: string; body: string }) {
  return (
    <section className="overflow-hidden rounded-lg border border-[#dde2e7] bg-white">
      <h2 className="border-b border-[#e5e9ed] bg-[#f8f9fa] px-5 py-4 text-[16px] font-bold md:px-7 md:text-[17px]">{title}</h2>
      <pre
        className="whitespace-pre-wrap break-words px-5 py-5 text-[14px] leading-7 text-[#3f4851] md:px-7 md:py-6"
        style={{ fontFamily: "'Noto Sans KR', system-ui, sans-serif" }}
      >
        {body}
      </pre>
    </section>
  );
}
