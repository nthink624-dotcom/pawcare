import "server-only";
import { after } from "next/server";
import { getReleaseId, logOperationalEvent as logConsoleOperationalEvent, type OperationalContext } from "@/lib/observability";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export { getReleaseId, getRequestId } from "@/lib/observability";
export type { OperationalContext } from "@/lib/observability";

export function logOperationalEvent(event: string, context?: OperationalContext) {
  logConsoleOperationalEvent(event, context);
  const name = event.trim();
  if (!/^[a-z][a-z0-9_.-]{0,119}$/.test(name) || !/(?:failed|error)(?:_|\.|$)/.test(name)) return;
  const release = getReleaseId();
  const status = context?.status;
  try {
    after(async () => {
      try {
        const admin = getSupabaseAdmin();
        if (!admin) return;
        const { error } = await admin.from("operational_error_events").insert({
          project_name: "web", event_name: name,
          http_status: typeof status === "number" && Number.isInteger(status) && status >= 400 && status <= 599 ? status : null,
          release_id: /^(?:[a-f0-9]{7,64}|local|unknown)$/i.test(release) ? release.toLowerCase() : "unknown",
        }).abortSignal(AbortSignal.timeout(3_000));
        if (error) throw new Error("Sink failed");
      } catch {
        console.error(JSON.stringify({ source: "petmanager-observability", event: "operational_error_sink_failed" }));
      }
    });
  } catch { /* Best-effort persistence must not break the original request. */ }
}
