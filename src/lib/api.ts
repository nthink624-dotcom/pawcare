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

  return `${env.apiBaseUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function fetchApiJson<T>(input: string, init?: RequestInit) {
  const response = await fetch(buildApiUrl(input), init);
  const json = await response.json();

  if (!response.ok) {
    throw new Error(json.message || "요청을 처리하지 못했습니다.");
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
    throw new Error("Supabase 환경 변수가 설정되지 않았습니다.");
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
