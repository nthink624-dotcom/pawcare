import { Home, Megaphone, Store } from "lucide-react";
import Link from "next/link";

const sections = [
  { id: "home", href: "/admin", label: "홈", icon: Home },
  { id: "owners", href: "/owner/admin", label: "오너 계정", icon: Store },
  { id: "marketing", href: "/admin/marketing", label: "마케팅 워룸", icon: Megaphone },
] as const;

export default function AdminSectionNav({ active }: { active: (typeof sections)[number]["id"] }) {
  return (
    <nav aria-label="관리자 주요 메뉴" className="flex flex-wrap gap-2">
      {sections.map((section) => {
        const Icon = section.icon;
        const selected = section.id === active;
        return (
          <Link
            key={section.id}
            href={section.href as never}
            aria-current={selected ? "page" : undefined}
            className={`inline-flex min-h-11 items-center gap-2 rounded-[8px] border px-4 text-[14px] font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 ${
              selected ? "border-[#2563eb] bg-[#2563eb] text-white" : "border-[#dbe2ea] bg-white text-[#334155] hover:bg-[#f8fafc]"
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
