import { env } from "@/lib/env";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { BootstrapPayload } from "@/types/domain";

export type PublicBootstrapPayload = Pick<
  BootstrapPayload,
  "shop" | "services" | "appointments" | "groomingRecords"
> & {
  mode: BootstrapPayload["mode"];
};

export function buildApiUrl(path: string) {
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (env.apiBaseUrl) {
    return `${env.apiBaseUrl.replace(/\/$/, "")}${normalizedPath}`;
  }

  if (typeof window === "undefined") {
    return `${env.siteUrl.replace(/\/$/, "")}${normalizedPath}`;
  }

  return normalizedPath;
}

export async function fetchApiJson<T>(input: string, init?: RequestInit) {
  const response = await fetch(buildApiUrl(input), init);
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();
  let json: unknown = null;

  if (text) {
    if (contentType.includes("application/json")) {
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error("서버 응답을 읽는 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.");
      }
    } else if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
      throw new Error("요청한 화면을 찾을 수 없습니다. 경로를 다시 확인해 주세요.");
    }
  }

  if (!response.ok) {
    const message =
      json && typeof json === "object" && "message" in json && typeof json.message === "string"
        ? json.message
        : "요청 처리 중 문제가 발생했습니다.";
    throw new Error(message);
  }

  return json as T;
}

export async function getPublicBootstrap(shopId?: string) {
  const query = new URLSearchParams({ scope: "public" });
  if (shopId) {
    query.set("shopId", shopId);
  }

  return fetchApiJson<PublicBootstrapPayload>(`/api/bootstrap?${query.toString()}`, {
    cache: "no-store",
  });
}

async function getAccessTokenWithRecovery() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error("Supabase 연결을 확인할 수 없습니다.");
  }

  const initialSession = await supabase.auth.getSession();
  if (initialSession.data.session?.access_token) {
    return initialSession.data.session.access_token;
  }

  const refreshedSession = await supabase.auth.refreshSession();
  if (refreshedSession.data.session?.access_token) {
    return refreshedSession.data.session.access_token;
  }

  const userResult = await supabase.auth.getUser();
  if (userResult.data.user) {
    const recoveredSession = await supabase.auth.getSession();
    if (recoveredSession.data.session?.access_token) {
      return recoveredSession.data.session.access_token;
    }
  }

  throw new Error("로그인이 필요합니다.");
}

export async function fetchApiJsonWithAuth<T>(input: string, init?: RequestInit) {
  const accessToken = await getAccessTokenWithRecovery();

  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("Authorization", `Bearer ${accessToken}`);

  return fetchApiJson<T>(input, {
    ...init,
    headers,
  });
}
