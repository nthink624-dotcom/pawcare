import { randomUUID } from "crypto";

import { env } from "@/lib/env";
import { nowIso } from "@/lib/utils";
import type { Notification } from "@/types/domain";

type NotificationDraft = Omit<Notification, "id" | "created_at" | "channel" | "status" | "sent_at"> & {
  channel?: Notification["channel"];
  status?: Notification["status"];
  sent_at?: string | null;
};

export async function sendNotification(draft: NotificationDraft): Promise<Notification> {
  const channel = env.solapiApiKey && env.solapiApiSecret ? "alimtalk" : draft.channel ?? "mock";
  return {
    ...draft,
    id: randomUUID(),
    channel,
    status: draft.status ?? (channel === "mock" ? "mocked" : "queued"),
    sent_at: draft.sent_at ?? nowIso(),
    created_at: nowIso(),
  };
}
