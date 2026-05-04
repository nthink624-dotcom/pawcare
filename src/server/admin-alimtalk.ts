import { serverEnv } from "@/lib/server-env";

export type RelayAdminConfig = {
  relaySecret: string;
  ssodaaApiUrl: string;
  ssodaaSentListUrl: string;
  ssodaaApiKey: string;
  ssodaaTokenKey: string;
  ssodaaSenderKey: string;
  templateBookingReceived: string;
  templateBookingConfirmed: string;
  templateBookingRejected: string;
  templateBookingCancelled: string;
  templateBookingRescheduledConfirmed: string;
  templateAppointmentReminder10m: string;
  templateGroomingStarted: string;
  templateGroomingAlmostDone: string;
  templateGroomingCompleted: string;
  templateRevisitNotice: string;
  templateBirthdayGreeting: string;
};

export type RelayTemplateDebugMap = Record<
  | "booking_received"
  | "booking_confirmed"
  | "booking_rejected"
  | "booking_cancelled"
  | "booking_rescheduled_confirmed"
  | "appointment_reminder_10m"
  | "grooming_started"
  | "grooming_almost_done"
  | "grooming_completed"
  | "revisit_notice"
  | "birthday_greeting",
  { configured: boolean; length: number }
>;

export type TemplateAlias =
  | "booking_received"
  | "booking_confirmed"
  | "booking_rejected"
  | "booking_cancelled"
  | "booking_rescheduled_confirmed"
  | "appointment_reminder_10m"
  | "grooming_started"
  | "grooming_almost_done"
  | "grooming_completed"
  | "revisit_notice"
  | "birthday_greeting";

export type RelaySsodaaTemplateDetail = {
  templateCode: string;
  templateName: string | null;
  templateContent: string | null;
  inspectionStatus: string | null;
  serviceStatus: string | null;
};

export type RelaySsodaaTemplateItem = {
  alias: TemplateAlias;
  configuredCode: string;
  detail: RelaySsodaaTemplateDetail | null;
  error: string | null;
};

export type RelayTemplateCatalogResponse = {
  ok: true;
  items: RelaySsodaaTemplateItem[];
};

export type RelayAdminConfigResponse = {
  ok: true;
  config: RelayAdminConfig;
  templates: RelayTemplateDebugMap;
};

export type AppAlimtalkConfig = {
  provider: string;
  relayUrl: string;
  relaySecret: string;
  apiUrl: string;
  apiKey: string;
  tokenKey: string;
  senderKey: string;
  templateBookingReceived: string;
  templateBookingConfirmed: string;
  templateBookingRejected: string;
  templateBookingCancelled: string;
  templateBookingRescheduledConfirmed: string;
  templateAppointmentReminder10m: string;
  templateGroomingStarted: string;
  templateGroomingAlmostDone: string;
  templateGroomingCompleted: string;
  templateRevisitNotice: string;
  templateBirthdayGreeting: string;
};

export type AppTemplateDraft = {
  alias: TemplateAlias;
  title: string;
  body: string;
};

function getRelayAdminUrl() {
  if (!serverEnv.alimtalkRelayUrl || !serverEnv.alimtalkRelaySecret) {
    throw new Error("알림톡 relay 연결값이 아직 설정되지 않았습니다.");
  }

  const parsed = new URL(serverEnv.alimtalkRelayAdminUrl || serverEnv.alimtalkRelayUrl);
  parsed.pathname = "/admin/config";
  parsed.search = "";
  return parsed.toString();
}

async function parseRelayResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();
  if (!text) return null;
  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new Error("relay 서버 응답을 읽는 중 문제가 발생했습니다.");
    }
  }
  return text;
}

function getRelayAdminTemplatesUrl() {
  if (!serverEnv.alimtalkRelayUrl || !serverEnv.alimtalkRelaySecret) {
    throw new Error("알림톡 relay 연결값이 아직 설정되지 않았습니다.");
  }

  const parsed = new URL(serverEnv.alimtalkRelayAdminUrl || serverEnv.alimtalkRelayUrl);
  parsed.pathname = "/admin/templates";
  parsed.search = "";
  return parsed.toString();
}

export async function getRelayAdminConfig() {
  const response = await fetch(getRelayAdminUrl(), {
    method: "GET",
    headers: {
      "x-relay-secret": serverEnv.alimtalkRelaySecret ?? "",
    },
    cache: "no-store",
  });

  const body = await parseRelayResponse(response);
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "message" in body && typeof body.message === "string"
        ? body.message
        : "relay 서버 설정을 불러오지 못했습니다.";
    throw new Error(message);
  }

  return body as RelayAdminConfigResponse;
}

export async function updateRelayAdminConfig(input: RelayAdminConfig) {
  const response = await fetch(getRelayAdminUrl(), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-relay-secret": serverEnv.alimtalkRelaySecret ?? "",
    },
    body: JSON.stringify(input),
    cache: "no-store",
  });

  const body = await parseRelayResponse(response);
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "message" in body && typeof body.message === "string"
        ? body.message
        : "relay 서버 설정 저장에 실패했습니다.";
    throw new Error(message);
  }

  return body as RelayAdminConfigResponse;
}

export async function getRelayTemplateCatalog() {
  const response = await fetch(getRelayAdminTemplatesUrl(), {
    method: "GET",
    headers: {
      "x-relay-secret": serverEnv.alimtalkRelaySecret ?? "",
    },
    cache: "no-store",
  });

  const body = await parseRelayResponse(response);
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "message" in body && typeof body.message === "string"
        ? body.message
        : "알림톡 relay 템플릿 정보를 불러오지 못했습니다.";
    throw new Error(message);
  }

  return body as RelayTemplateCatalogResponse;
}

export function getAppAlimtalkConfig(): AppAlimtalkConfig {
  return {
    provider: serverEnv.alimtalkProvider || "",
    relayUrl: serverEnv.alimtalkRelayUrl || "",
    relaySecret: serverEnv.alimtalkRelaySecret || "",
    apiUrl: serverEnv.alimtalkApiUrl || "",
    apiKey: serverEnv.alimtalkApiKey || "",
    tokenKey: serverEnv.alimtalkTokenKey || "",
    senderKey: serverEnv.alimtalkSenderKey || "",
    templateBookingReceived: serverEnv.alimtalkTemplateBookingReceived || "",
    templateBookingConfirmed: serverEnv.alimtalkTemplateBookingConfirmed || "",
    templateBookingRejected: serverEnv.alimtalkTemplateBookingRejected || "",
    templateBookingCancelled: serverEnv.alimtalkTemplateBookingCancelled || "",
    templateBookingRescheduledConfirmed: serverEnv.alimtalkTemplateBookingRescheduledConfirmed || "",
    templateAppointmentReminder10m: serverEnv.alimtalkTemplateAppointmentReminder10m || "",
    templateGroomingStarted: serverEnv.alimtalkTemplateGroomingStarted || "",
    templateGroomingAlmostDone: serverEnv.alimtalkTemplateGroomingAlmostDone || "",
    templateGroomingCompleted: serverEnv.alimtalkTemplateGroomingCompleted || "",
    templateRevisitNotice: serverEnv.alimtalkTemplateRevisitNotice || "",
    templateBirthdayGreeting: serverEnv.alimtalkTemplateBirthdayGreeting || "",
  };
}

export function getAppTemplateDrafts(): AppTemplateDraft[] {
  return [
    {
      alias: "booking_received",
      title: "예약 접수",
      body: `[#{매장명}] #{반려동물명} 예약이 접수되었어요.\n방문 일정: #{예약일시}\n\n매장에서 예약을 확인한 뒤 확정 알림을 보내드릴게요.\n\n예약 정보는 아래 링크에서 확인하실 수 있어요.\n#{예약관리링크}`,
    },
    {
      alias: "booking_confirmed",
      title: "예약 확정",
      body: `[#{매장명}]\n#{반려동물명} 보호자님, 예약이 확정되었어요. (방긋)\n\n방문 일시: #{예약일시}\n예약 서비스: #{서비스명}\n\n방문 당일 편하게 와 주세요. 기다리고 있겠습니다.\n\n#{예약관리링크}`,
    },
    {
      alias: "booking_rejected",
      title: "예약 거절",
      body: `[#{매장명}] 예약 거절 안내\n\n#{반려동물명} 보호자님께서 신청하신 예약은 매장 사정으로 인해 확정이 어려운 점 양해 부탁드립니다.\n\n불편을 드려 죄송합니다.\n\n해당 시간 외 다른 일정으로 예약이 가능하오니,  아래 링크에서 다시 확인 부탁드립니다.\n\n#{예약관리링크}`,
    },
    {
      alias: "booking_cancelled",
      title: "예약 취소",
      body: `[#{매장명}]\n#{반려동물명} 보호자님, 예약 취소가 처리되었어요.\n\n취소된 예약: #{예약일시}\n\n아쉽지만 다음에 또 뵐 수 있길 바라요.\n언제든 다시 예약하고 싶으실 때 아래 링크를 이용해 주세요.\n\n#{예약관리링크}`,
    },
    {
      alias: "booking_rescheduled_confirmed",
      title: "예약 변경 확정",
      body: `[#{매장명}]\n#{반려동물명} 보호자님, 예약 변경이 확정되었어요\n\n기존 예약은 취소되고, 아래 일정으로 새로 잡혔어요.\n\n 새로운 일정: #{예약일시}\n 예약 서비스: #{서비스명}\n\n새 일정에 맞춰 뵐게요!\n추가 변경이 필요하시면 아래 링크에서 편하게 해주세요.\n\n#{예약관리링크}`,
    },
    {
      alias: "appointment_reminder_10m",
      title: "방문 10분 전",
      body: `[#{매장명}]\n#{반려동물명} 보호자님, 이제 곧 만나요! (방긋)\n\n 방문 일시: #{예약일시}\n 예약 서비스: #{서비스명}\n\n준비 마치고 기다리고 있을게요.\n오시는 길 조심히 오세요 \n\n#{예약관리링크}`,
    },
    {
      alias: "grooming_started",
      title: "미용 시작",
      body: `[#{매장명}]\n#{반려동물명} 보호자님, 미용을 시작했어요 \n\n#{반려동물명}은 저희가 잘 돌보고 있으니 안심하세요 \n예쁘게 단장해서 보내드릴게요!`,
    },
    {
      alias: "grooming_almost_done",
      title: "픽업 준비",
      body: `[#{매장명}]\n#{반려동물명} 미용이 곧 끝나요\n\n마무리 단계라 곧 픽업 가능하세요.\n\n잠시 후 픽업하실 수 있어요.\n\n예약 정보는 아래 링크에서 확인하실 수 있어요.\n#{예약관리링크}`,
    },
    {
      alias: "grooming_completed",
      title: "미용 완료",
      body: `[#{매장명}]\n #{반려동물명} 미용이 모두 완료되었어요.\n\n오늘도 믿고 맡겨주셔서 감사해요.\n#{반려동물명}이 기다리고 있으니 편하신 시간에 와주세요.\n\n#{예약관리링크}`,
    },
    {
      alias: "revisit_notice",
      title: "재방문 안내",
      body: `[#{매장명}] #{반려동물명} 재방문 시기가 가까워졌어요.`,
    },
    {
      alias: "birthday_greeting",
      title: "생일 축하",
      body: `[#{매장명}] #{반려동물명}의 생일을 축하드려요.`,
    },
  ];
}
