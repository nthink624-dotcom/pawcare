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
        throw new Error("서버 응답을 읽지 못했습니다. 잠시 후 다시 시도해 주세요.");
      }
    } else if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
      throw new Error("요청이 로그인 화면이나 오류 페이지로 이동했습니다. 다시 로그인해 주세요.");
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

export async function fetchApiJsonWithAuth<T>(input: string, init?: RequestInit) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error("Supabase 설정을 확인해 주세요.");
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("로그인이 필요합니다.");
  }

  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("Authorization", `Bearer ${session.access_token}`);

  return fetchApiJson<T>(input, {
    ...init,
    headers,
  });
}
