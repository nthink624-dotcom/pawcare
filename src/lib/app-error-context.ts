export type AppErrorEscapeContext = {
  href: string;
  label: string;
};

export function getAppErrorEscapeContext(pathname: string): AppErrorEscapeContext {
  if (pathname === "/owner" || pathname.startsWith("/owner/")) {
    return { href: "/owner", label: "오너 홈" };
  }
  if (pathname === "/demo/owner-web" || pathname.startsWith("/demo/owner-web/")) {
    return { href: "/demo/owner-web", label: "오너 홈" };
  }
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return { href: "/admin", label: "관리자 메인" };
  }
  return { href: "/", label: "처음으로" };
}
