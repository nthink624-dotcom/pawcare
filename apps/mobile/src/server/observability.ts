import { after } from "next/server";

import { getReleaseId, logOperationalEvent as logConsoleOperationalEvent } from "@/lib/observability";
import { getSupabaseAdmin } from "@/lib/supabase/server";

type OperationalContext = Record<string, string | number | boolean | null | undefined>;

export function logOperationalEvent(event: string, context?: OperationalContext) {
  logConsoleOperationalEvent(event, context);
  if (!/(?:\.failed|\.error)$/.test(event)) return;

  const eventName = event.trim().slice(0, 120);
  const status = typeof context?.status === "number" && Number.isInteger(context.status) && context.status >= 400 && context.status <= 599
    ? context.status
    : null;
  const configuredRelease = getReleaseId();
  const releaseId = /^(?:[a-f0-9]{7,64}|local|unknown)$/i.test(configuredRelease)
    ? configuredRelease.toLowerCase()
    : "unknown";

  try {
    after(async () => {
      try {
        const admin = getSupabaseAdmin();
        if (!admin || !/^[a-z][a-z0-9_.-]{0,119}$/.test(eventName)) return;
        const { error } = await admin.from("operational_error_events").insert({
          project_name: "mobile",
          event_name: eventName,
          http_status: status,
          release_id: releaseId,
        });
        if (error) throw new Error("Operational error event insert failed.");
      } catch {
        // Keep sink failures visible without recursively persisting or logging DB details.
        console.error(JSON.stringify({
          source: "petmanager-mobile-observability",
          event: "operational_error_sink_failed",
        }));
      }
    });
  } catch {
    // Persisting this event is best-effort and must not affect the original request.
  }
}
