import { Home, Megaphone, Store } from "lucide-react";
import Link from "next/link";

import { ADMIN_TYPOGRAPHY } from "@/components/admin/admin-typography";

type AdminSection = "home" | "owners" | "marketing";

const ADMIN_SECTIONS = [
  { id: "home", href: "/admin", label: "홈", icon: Home },
  { id: "owners", href: "/owner/admin", label: "오너 계정", icon: Store },
  { id: "marketing", href: "/admin/marketing", label: "마케팅 워룸", icon: Megaphone },
] as const;

export default function AdminSectionNav({ active }: { active: AdminSection }) {
  return (
    <nav aria-label="관리자 주요 메뉴" className="flex flex-wrap gap-2">
      {ADMIN_SECTIONS.map((section) => {
        const Icon = section.icon;
        const selected = section.id === active;

        return (
          <Link
            key={section.id}
            href={section.href as never}
            aria-current={selected ? "page" : undefined}
            className={`inline-flex h-11 items-center gap-2 rounded-[10px] border px-4 transition ${ADMIN_TYPOGRAPHY.control} ${
              selected
                ? "border-[#2563eb] bg-[#2563eb] text-white shadow-[0_6px_18px_rgba(37,99,235,0.16)]"
                : "border-[#dbe4ef] bg-white text-[#334155] hover:border-[#b9c8db] hover:bg-[#f8fafc]"
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
