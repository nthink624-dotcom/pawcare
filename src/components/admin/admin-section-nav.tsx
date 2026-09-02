import { Home, MessageCircle, PanelsTopLeft, Store } from "lucide-react";
import Link from "next/link";

import { ADMIN_TYPOGRAPHY } from "@/components/admin/admin-typography";

type AdminSection = "home" | "owners" | "marketing" | "support";

const ADMIN_SECTIONS = [
  { id: "home", href: "/admin", label: "홈", icon: Home },
  { id: "owners", href: "/owner/admin", label: "계정 관리", icon: Store },
  { id: "marketing", href: "/admin/marketing", label: "워크룸", icon: PanelsTopLeft },
  { id: "support", href: "/admin/support", label: "고객 문의", icon: MessageCircle },
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
            className={`inline-flex min-h-11 items-center gap-2 rounded-[10px] border px-4 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 ${ADMIN_TYPOGRAPHY.control} ${
              selected
                ? "border-[#2563eb] bg-[#2563eb] text-white"
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
