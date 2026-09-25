"use client";

import { RefreshCcw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import OwnerAdminDetailPanel from "@/components/admin/owner-admin-detail-panel";
import AdminSectionNav from "@/components/admin/admin-section-nav";
import { getAdminErrorMessage } from "@/components/admin/admin-error-message";
import { ADMIN_TYPOGRAPHY } from "@/components/admin/admin-typography";
import { fetchApiJson } from "@/lib/api";
import {
  buildDraft,
  loginMethodLabels,
  loginMethodToneMap,
  statusOptions,
  statusToneMap,
  toKstIsoEndOfDay,
  usageWarningToneMap,
  type AdminOwnerItem,
  type OwnerDraft,
} from "@/components/admin/owner-admin-model";

async function fetchOwners() {
  return fetchApiJson<AdminOwnerItem[]>("/api/admin/owners", { cache: "no-store" });
}

export default function OwnerAdminScreen({ adminId }: { adminId: string }) {
  const router = useRouter();
  const [owners, setOwners] = useState<AdminOwnerItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, OwnerDraft>>({});
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [ownerLoadFailed, setOwnerLoadFailed] = useState(false);
  const [ownerLoadError, setOwnerLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [adminSurface, setAdminSurface] = useState<"local" | "production" | "unknown">("unknown");

  const loadOwners = useCallback(async () => {
    setLoading(true);
    setOwnerLoadFailed(false);
    setOwnerLoadError(null);

    try {
      const nextOwners = await fetchOwners();
      setOwners(nextOwners);
      setDrafts(Object.fromEntries(nextOwners.map((item) => [item.userId, buildDraft(item)])));
      setSelectedUserId((current) =>
        current && nextOwners.some((item) => item.userId === current) ? current : nextOwners[0]?.userId ?? null,
      );
      setError(null);
    } catch (nextError) {
      setOwnerLoadFailed(true);
      setOwnerLoadError(
        getAdminErrorMessage(nextError, "오너 계정 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOwners();
  }, [loadOwners]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hostname = window.location.hostname;
    if (/localhost|127\.0\.0\.1/i.test(hostname) || hostname.endsWith(".local")) {
      setAdminSurface("local");
      return;
    }
    setAdminSurface("production");
  }, []);

  const filteredOwners = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return owners;
    return owners.filter((item) =>
      [item.ownerName, item.shopName, item.shopAddress, item.ownerPhoneNumber, item.loginId, item.ownerEmail, item.shopId]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [owners, search]);

  useEffect(() => {
    if (filteredOwners.length === 0) {
      setSelectedUserId(null);
      return;
    }
    setSelectedUserId((current) =>
      current && filteredOwners.some((item) => item.userId === current) ? current : filteredOwners[0].userId,
    );
  }, [filteredOwners]);

  const selectedOwner = filteredOwners.find((item) => item.userId === selectedUserId) ?? null;
  const selectedDraft = selectedOwner ? drafts[selectedOwner.userId] : null;
  const adminSurfaceLabel =
    adminSurface === "local" ? "로컬 관리자" : adminSurface === "production" ? "운영 관리자" : "관리자";
  const adminSurfaceTone =
    adminSurface === "local"
      ? "border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]"
      : adminSurface === "production"
        ? "border-[#D7E0EA] bg-[#F8FAFC] text-[#475569]"
        : "border-[#D7E0EA] bg-[#F8FAFC] text-[#64748B]";

  async function logoutAdmin() {
    try {
      await fetchApiJson<{ success: true }>("/api/admin/auth/logout", { method: "POST" });
    } finally {
      router.replace("/admin/login" as never);
      router.refresh();
    }
  }

  async function saveOwner(item: AdminOwnerItem) {
    const draft = drafts[item.userId];
    if (!draft) return;
    setSavingUserId(item.userId);
    setError(null);
    setNotice(null);

    const isFreePlan = draft.currentPlanCode === "free";
    const nextServiceEndAt = draft.currentPeriodEndsAt ? toKstIsoEndOfDay(draft.currentPeriodEndsAt) : null;

    try {
      const response = await fetchApiJson<{ success: true; owners: AdminOwnerItem[] }>("/api/admin/owners", {
        method: "PATCH",
        body: JSON.stringify({
          userId: item.userId,
          shopId: item.shopId,
          currentPlanCode: draft.currentPlanCode,
          serviceStartedAt: toKstIsoEndOfDay(draft.serviceStartedAt),
          trialEndsAt: isFreePlan ? nextServiceEndAt ?? toKstIsoEndOfDay(draft.trialEndsAt || draft.serviceStartedAt) : undefined,
          currentPeriodEndsAt: isFreePlan ? null : nextServiceEndAt,
          lastPaymentStatus: draft.lastPaymentStatus,
          suspended: draft.suspended,
          suspensionReason: draft.suspended ? draft.suspensionReason.trim() || "운영자에 의해 계정이 일시 정지되었습니다." : null,
        }),
        headers: { "Content-Type": "application/json" },
      });

      setOwners(response.owners);
      setDrafts(Object.fromEntries(response.owners.map((nextItem) => [nextItem.userId, buildDraft(nextItem)])));
      setSelectedUserId(item.userId);
    } catch (nextError) {
      setError(getAdminErrorMessage(nextError, "오너 계정 정보를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요."));
    } finally {
      setSavingUserId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#F4F4F4] p-3 text-[#172033] sm:p-5 lg:p-6">
      <div className="mx-auto w-full max-w-[1660px]">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_430px]">
          <section className="flex flex-col overflow-hidden rounded-[14px] border border-[#D9E0E8] bg-white shadow-[0_2px_12px_rgba(15,23,42,0.06)] xl:h-[calc(100vh-40px)]">
            <div className="border-b border-[#E8EDF3] px-4 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
            <p className={`${ADMIN_TYPOGRAPHY.meta} text-[#2563EB]`}>운영자 모드</p>
            <span className={`inline-flex rounded-full border px-2.5 py-1 ${ADMIN_TYPOGRAPHY.badge} ${adminSurfaceTone}`}>
                      {adminSurfaceLabel}
                    </span>
                  </div>
          <h1 className={`mt-1 tracking-[-0.03em] text-[#0f172a] ${ADMIN_TYPOGRAPHY.pageTitle}`}>계정 관리</h1>
                </div>
                <div className="flex min-w-0 items-center justify-between gap-1.5 sm:shrink-0 sm:justify-end">
                  <div className="px-1.5 text-right">
            <p className={`${ADMIN_TYPOGRAPHY.helper} text-[#64748b]`}>현재 운영자</p>
            <p className={`${ADMIN_TYPOGRAPHY.meta} text-[#0f172a]`}>{adminId}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void logoutAdmin()}
              className={`inline-flex h-11 items-center rounded-[10px] border border-[#D7E0EA] bg-white px-3 text-[#172033] transition hover:bg-[#F8FAFC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 ${ADMIN_TYPOGRAPHY.control}`}
                  >
                    로그아웃
                  </button>
                </div>
              </div>

              <div className="mt-4 border-t border-[#E8EDF3] pt-4">
                <AdminSectionNav active="owners" />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <label className="relative min-w-0 flex-1 sm:min-w-[320px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9b9084]" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="오너 이름, 상호명, 전화번호, 매장명, 로그인 계정으로 검색"
              className={`h-11 w-full rounded-[10px] border border-[#D7E0EA] bg-white pl-10 pr-3 text-[#172033] outline-none placeholder:text-[#94a3b8] focus-visible:ring-2 focus-visible:ring-[#2563EB] ${ADMIN_TYPOGRAPHY.body}`}
                  />
                </label>
                <div className={`inline-flex h-11 items-center rounded-[10px] border border-[#D7E0EA] bg-white px-3 text-[#475569] ${ADMIN_TYPOGRAPHY.meta}`}>
                  총 {ownerLoadFailed ? "-" : filteredOwners.length}명
                </div>
                <button
                  type="button"
                  onClick={() => void loadOwners()}
                  disabled={loading}
                  className={`inline-flex h-11 items-center gap-2 rounded-[10px] border border-[#D7E0EA] bg-white px-3 text-[#475569] transition hover:bg-[#F8FAFC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 disabled:opacity-60 ${ADMIN_TYPOGRAPHY.control}`}
                >
                  <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                  새로고침
                </button>
              </div>

              {error ? (
          <p className={`mt-3 rounded-[8px] border border-[#f0d1d1] bg-[#fff7f7] px-4 py-3 text-[#b54b4b] ${ADMIN_TYPOGRAPHY.body}`}>
                  {error}
                </p>
              ) : null}
              {notice ? (
          <p className={`mt-3 rounded-[8px] border border-[#d7e7e1] bg-[#f4faf7] px-4 py-3 text-[#1f6b5b] ${ADMIN_TYPOGRAPHY.body}`}>
                  {notice}
                </p>
              ) : null}
            </div>

        <div className={`grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-[#E8EDF3] bg-[#F8FAFC] px-4 py-3 text-[#64748b] sm:grid-cols-[minmax(0,1.25fr)_minmax(160px,0.8fr)_140px_130px] ${ADMIN_TYPOGRAPHY.meta}`}>
              <span>오너 / 매장</span>
              <span className="hidden sm:block">로그인 수단</span>
              <span className="hidden sm:block">전화번호</span>
              <span>이용 상태</span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {loading ? (
          <div className={`px-4 py-12 text-center text-[#6f665f] ${ADMIN_TYPOGRAPHY.body}`}>오너 계정을 불러오는 중이에요.</div>
              ) : ownerLoadFailed ? (
                <div className="px-4 py-12 text-center">
                  <p role="alert" className={`text-[#a04455] ${ADMIN_TYPOGRAPHY.body}`}>{ownerLoadError ?? "오너 계정 정보를 불러오지 못했습니다."}</p>
                  <button type="button" onClick={() => void loadOwners()} className={`mt-4 inline-flex min-h-11 items-center rounded-[8px] border border-[#dbe2ea] bg-white px-4 text-[#334155] ${ADMIN_TYPOGRAPHY.control}`}>다시 시도</button>
                </div>
              ) : owners.length === 0 && !search.trim() ? (
                <div className={`px-4 py-12 text-center text-[#6f665f] ${ADMIN_TYPOGRAPHY.body}`}>등록된 오너 계정이 없습니다.</div>
              ) : filteredOwners.length === 0 ? (
                <div className={`px-4 py-12 text-center text-[#6f665f] ${ADMIN_TYPOGRAPHY.body}`}>검색 결과가 없습니다.</div>
              ) : (
                filteredOwners.map((item) => {
                  const selected = item.userId === selectedUserId;
                  return (
                    <button
                      key={item.userId}
                      type="button"
                      onClick={() => setSelectedUserId(item.userId)}
                      className={`grid min-h-11 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-[#E8EDF3] px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2563EB] sm:grid-cols-[minmax(0,1.25fr)_minmax(140px,0.8fr)_130px_120px] sm:gap-2 ${
                        selected ? "bg-[#EFF6FF]" : "bg-white hover:bg-[#F8FAFC]"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                      <p className={`truncate text-[#171411] ${ADMIN_TYPOGRAPHY.bodyStrong}`}>{item.ownerName}</p>
                          {item.suspended ? (
                        <span className={`rounded-full bg-[#fff2f2] px-2.5 py-1 text-[#b54b4b] ${ADMIN_TYPOGRAPHY.badge}`}>정지</span>
                          ) : null}
                        </div>
                    <p className={`mt-1 truncate text-[#36302b] ${ADMIN_TYPOGRAPHY.bodyStrong}`}>{item.shopName}</p>
                    <p className={`mt-1 truncate text-[#8a8277] ${ADMIN_TYPOGRAPHY.helper}`}>{item.shopAddress}</p>
                        {item.usageWarnings.length > 0 ? (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {item.usageWarnings.slice(0, 2).map((warning) => (
                              <span
                                key={`${item.userId}-${warning.code}`}
                          className={`rounded-full border px-2.5 py-1 ${ADMIN_TYPOGRAPHY.badge} ${usageWarningToneMap[warning.level]}`}
                              >
                                운영 검토 · {warning.message}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <div className="hidden flex-wrap gap-1 sm:flex">
                        {item.loginMethods.map((method) => (
                          <span
                            key={`${item.userId}-${method}`}
                            title={method === "email" ? item.ownerEmail ?? item.loginId ?? loginMethodLabels[method] : loginMethodLabels[method]}
                          className={`max-w-full truncate rounded-full border px-2.5 py-1 ${ADMIN_TYPOGRAPHY.badge} ${loginMethodToneMap[method]}`}
                          >
                            {method === "email" && (item.ownerEmail ?? item.loginId) ? item.ownerEmail ?? item.loginId : loginMethodLabels[method]}
                          </span>
                        ))}
                      </div>

                  <div className={`hidden text-[#5e564f] sm:block ${ADMIN_TYPOGRAPHY.body}`}>{item.ownerPhoneNumber ?? "-"}</div>

                      <div>
                    <span className={`inline-flex rounded-full px-2.5 py-1 ${ADMIN_TYPOGRAPHY.badge} ${statusToneMap[item.status]}`}>
                          {statusOptions.find((option) => option.value === item.status)?.label ?? item.status}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          <OwnerAdminDetailPanel
            selectedOwner={selectedOwner}
            selectedDraft={selectedDraft}
            setDrafts={setDrafts}
            savingUserId={savingUserId}
            saveOwner={saveOwner}
          />
        </div>
      </div>
    </main>
  );
}
