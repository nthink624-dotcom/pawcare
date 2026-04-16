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
    <div className="mx-auto min-h-screen w-full max-w-[430px] bg-[#faf7f2] px-5 pb-10 pt-6 text-[#1f1a17]">
      <div className="rounded-[28px] border border-[#e7e0d5] bg-white px-5 py-6 shadow-[0_6px_18px_rgba(31,26,23,0.04)]">
        <Link href="/" className="text-[12px] font-semibold text-[#6a625b]">
          ← 펫매니저 메인으로
        </Link>
        <h1 className="mt-4 text-[28px] font-extrabold tracking-[-0.04em]">{title}</h1>
        <p className="mt-2 text-[13px] leading-6 text-[#6a625b]">{subtitle}</p>
        <div className="mt-5 space-y-4">{children}</div>
      </div>
      <LegalLinksFooter />
    </div>
  );
}

export function LegalSection({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-[22px] border border-[#eee6db] bg-[#fcfaf6] px-4 py-4">
      <h2 className="text-[16px] font-bold tracking-[-0.03em]">{title}</h2>
      <pre
        className="mt-3 whitespace-pre-wrap break-words text-[13px] leading-6 text-[#4f4842]"
        style={{ fontFamily: "'Noto Sans KR', system-ui, sans-serif" }}
      >
        {body}
      </pre>
    </section>
  );
}
