import { OWNER_PUBLIC_SHELL_WORKER } from "@petmanager/shared/lib/owner-public-shell";

export function GET() {
  return new Response(OWNER_PUBLIC_SHELL_WORKER, { headers: {
    "Content-Type": "application/javascript; charset=utf-8",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Service-Worker-Allowed": "/owner",
    "X-Content-Type-Options": "nosniff",
  } });
}
