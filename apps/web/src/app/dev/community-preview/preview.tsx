"use client";
import CommunityBoard from "@petmanager/shared/components/community/community-board";
import type { CommunityApi } from "@petmanager/shared/contracts/community";

// Browser QA intercepts this development tab only and exercises the real API
// handlers against a task-owned local PostgreSQL fixture. No auth bypass route.
const api: CommunityApi = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(path, init);
  const result = await response.json();
  if (!response.ok) throw new Error(result.message ?? "요청을 처리하지 못했습니다.");
  return result as T;
};
export default function CommunityPreview() {
  return <main className="min-h-screen bg-[#f1f3f7] py-4"><CommunityBoard shopId="shop-a" api={api} /></main>;
}
