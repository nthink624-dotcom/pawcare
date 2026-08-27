import { projectControlPlaneEvents } from "@/lib/agent-control-plane";
import { readDemoControlPlaneLedger } from "@/lib/demo-control-plane-ledger";
import type { NextRequest } from "next/server";
import { AdminApiError, requireAdminSession } from "@/server/admin-api-auth";

const encoder = new TextEncoder();

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") return new Response("Not found", { status: 404 });
  try { await requireAdminSession(request); }
  catch (error) { return new Response("Unauthorized", { status: error instanceof AdminApiError ? error.status : 500 }); }

  let timer: ReturnType<typeof setInterval> | undefined;
  let previousPayload = "";
  const stream = new ReadableStream({
    async start(controller) {
      const push = async () => {
        const events = await readDemoControlPlaneLedger();
        const signature = JSON.stringify(events.map(({ eventId, sourceEventAt, receivedAt }) => [eventId, sourceEventAt, receivedAt]));
        if (signature === previousPayload) return;
        previousPayload = signature;
        const payload = JSON.stringify(projectControlPlaneEvents({ events, now: new Date().toISOString() }));
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      };
      await push();
      timer = setInterval(() => void push(), 1_000);
      request.signal.addEventListener("abort", () => {
        if (timer) clearInterval(timer);
        controller.close();
      }, { once: true });
    },
    cancel() { if (timer) clearInterval(timer); },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-store, no-transform",
      "Connection": "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
    },
  });
}
