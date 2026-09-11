"use client";

import { Gift, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import AdminSectionNav from "@/components/admin/admin-section-nav";
import { ADMIN_TYPOGRAPHY } from "@/components/admin/admin-typography";
import { formatDateLabel, type AdminOwnerItem } from "@/components/admin/owner-admin-model";
import { fetchApiJson } from "@/lib/api";
import {
  OWNER_PILOT_INITIAL_FREE_DAYS,
  OWNER_PILOT_MIN_EXTENSION_DAYS,
  resolveOwnerPilotBenefitGrantAttempt,
  type OwnerPilotBenefitGrantAttempt,
  type OwnerPilotBenefitGrantIntent,
  type OwnerPilotBenefitStatus,
} from "@/lib/billing/owner-pilot-benefit";

const EMPTY_STATUS: OwnerPilotBenefitStatus = {
  schemaReady: true,
  enrolled: false,
  paid: false,
  freeStartedAt: null,
  freeEndsAt: null,
  totalFreeDays: 0,
  remainingGrantableDays: 60,
  grants: [],
};

export type AdminPilotBenefitFixture = {
  owners: AdminOwnerItem[];
  benefit: OwnerPilotBenefitStatus;
  viewState?: "ready" | "loading" | "error";
  errorMessage?: string;
};

function ownerSelectionKey(owner: Pick<AdminOwnerItem, "userId" | "shopId">) {
  return `${owner.userId}:${owner.shopId}`;
}

export default function AdminPilotBenefitScreen({ fixture }: { fixture?: AdminPilotBenefitFixture }) {
  const [owners, setOwners] = useState<AdminOwnerItem[]>(() => fixture?.owners ?? []);
  const [selectedOwnerKey, setSelectedOwnerKey] = useState(() => fixture?.owners[0] ? ownerSelectionKey(fixture.owners[0]) : "");
  const [benefit, setBenefit] = useState<OwnerPilotBenefitStatus>(() => fixture?.benefit ?? EMPTY_STATUS);
  const [search, setSearch] = useState("");
  const [days, setDays] = useState(String(OWNER_PILOT_MIN_EXTENSION_DAYS));
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(() => fixture?.viewState === "loading" || !fixture);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(() => fixture?.viewState === "error" ? fixture.errorMessage ?? "파일럿 혜택 상태를 불러오지 못했습니다." : "");
  const grantAttemptRef = useRef<OwnerPilotBenefitGrantAttempt | null>(null);

  const selectedOwner = owners.find((owner) => ownerSelectionKey(owner) === selectedOwnerKey) ?? null;
  const filteredOwners = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return owners;
    return owners.filter((owner) =>
      [owner.ownerName, owner.shopName, owner.shopAddress]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [owners, search]);

  const loadBenefit = useCallback(async (owner: AdminOwnerItem) => {
    const query = new URLSearchParams({ userId: owner.userId, shopId: owner.shopId });
    const response = await fetchApiJson<{ ok: true; benefit: OwnerPilotBenefitStatus }>(
      `/api/admin/pilot-benefits?${query.toString()}`,
      { cache: "no-store" },
    );
    setBenefit(response.benefit);
  }, []);

  useEffect(() => {
    if (fixture) return;
    let active = true;
    void fetchApiJson<AdminOwnerItem[]>("/api/admin/owners", { cache: "no-store" })
      .then((items) => {
        if (!active) return;
        setOwners(items);
        setSelectedOwnerKey(items[0] ? ownerSelectionKey(items[0]) : "");
      })
      .catch(() => active && setError("오너 계정 목록을 불러오지 못했습니다."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [fixture]);

  useEffect(() => {
    if (fixture || !selectedOwner) return;
    setLoading(true);
    setError("");
    setMessage("");
    setReason("");
    setConfirmed(false);
    void loadBenefit(selectedOwner)
      .catch(() => setError("파일럿 혜택 상태를 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [fixture, loadBenefit, selectedOwner]);

  async function grantBenefit() {
    if (fixture) {
      setError("개발용 화면에서는 조회하거나 지급하지 않습니다.");
      return;
    }
    if (!selectedOwner || !confirmed || !reason.trim()) {
      setError("대상과 지급 사유를 확인해 주세요.");
      return;
    }
    const extensionDays = Number(days);
    if (benefit.enrolled && (!Number.isInteger(extensionDays) || extensionDays < OWNER_PILOT_MIN_EXTENSION_DAYS)) {
      setError("피드백·문제 보상은 3일 이상 입력해 주세요.");
      return;
    }

    const intent: OwnerPilotBenefitGrantIntent = {
      userId: selectedOwner.userId,
      shopId: selectedOwner.shopId,
      kind: benefit.enrolled ? "feedback_issue" : "initial",
      days: benefit.enrolled ? extensionDays : OWNER_PILOT_INITIAL_FREE_DAYS,
      reason: reason.trim(),
    };
    const attempt = resolveOwnerPilotBenefitGrantAttempt(grantAttemptRef.current, intent, () => crypto.randomUUID());
    grantAttemptRef.current = attempt;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetchApiJson<{ ok: true; benefit: OwnerPilotBenefitStatus }>("/api/admin/pilot-benefits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...intent,
          idempotencyKey: attempt.idempotencyKey,
        }),
      });
      grantAttemptRef.current = null;
      setBenefit(response.benefit);
      setDays(String(OWNER_PILOT_MIN_EXTENSION_DAYS));
      setReason("");
      setConfirmed(false);
      setMessage(benefit.enrolled ? "파일럿 보상 기간을 반영했습니다." : "파일럿 기본 30일을 반영했습니다.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "파일럿 혜택을 적용하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  const grantDisabled =
    Boolean(fixture) || saving || loading || !benefit.schemaReady || benefit.paid || !confirmed || !reason.trim() ||
    (benefit.enrolled && benefit.remainingGrantableDays < OWNER_PILOT_MIN_EXTENSION_DAYS);

  return (
    <main className="min-h-screen bg-[#f4f4f4] p-3 text-[#172033] sm:p-5 lg:p-6">
      <div className="mx-auto w-full max-w-[1180px]">
        <header className="rounded-[14px] border border-[#d9e0e8] bg-white p-5">
          <p className={`${ADMIN_TYPOGRAPHY.meta} text-[#64748b]`}>운영자 모드</p>
          <h1 className={`mt-1 text-[#0f172a] ${ADMIN_TYPOGRAPHY.pageTitle}`}>파일럿 혜택</h1>
          <p className={`mt-2 text-[#64748b] ${ADMIN_TYPOGRAPHY.body}`}>
            파일럿 신규 매장은 일반 14일 대신 총 30일로 시작하며, 첫 결제 전 최대 60일까지 적용할 수 있습니다.
          </p>
          <div className="mt-4 border-t border-[#e8edf3] pt-4">
            <AdminSectionNav active="pilotBenefits" />
          </div>
          {fixture ? (
            <p className={`mt-3 rounded-[10px] border border-[#d9e0e8] bg-[#f8fafc] px-3 py-2 text-[#64748b] ${ADMIN_TYPOGRAPHY.helper}`} role="status">
              개발용 예시 화면입니다. 실제 조회나 지급은 실행되지 않습니다.
            </p>
          ) : null}
        </header>

        <div className="mt-3 grid min-w-0 gap-3 lg:grid-cols-[minmax(260px,0.72fr)_minmax(0,1.28fr)]">
          <section className="min-w-0 rounded-[14px] border border-[#d9e0e8] bg-white p-4">
            <label className="relative block">
              <span className="sr-only">매장 검색</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748b]" aria-hidden />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="오너 또는 매장 검색"
                className={`h-11 w-full rounded-[10px] border border-[#d7e0ea] bg-white pl-10 pr-3 outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] ${ADMIN_TYPOGRAPHY.body}`}
              />
            </label>
            <div className="mt-3 max-h-[520px] space-y-1 overflow-y-auto">
              {filteredOwners.map((owner) => (
                <button
                  key={`${owner.userId}:${owner.shopId}`}
                  type="button"
                  onClick={() => setSelectedOwnerKey(ownerSelectionKey(owner))}
                  className={`min-h-11 w-full rounded-[10px] border px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] ${
                    ownerSelectionKey(owner) === selectedOwnerKey ? "border-[#2563eb] bg-[#eff6ff]" : "border-transparent bg-white hover:bg-[#f8fafc]"
                  }`}
                >
                  <span className={`block text-[#0f172a] ${ADMIN_TYPOGRAPHY.bodyStrong}`}>{owner.shopName}</span>
                  <span className={`block text-[#64748b] ${ADMIN_TYPOGRAPHY.helper}`}>{owner.ownerName}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="min-w-0 rounded-[14px] border border-[#d9e0e8] bg-white p-5">
            {selectedOwner ? (
              <>
                <div className="flex min-w-0 items-center gap-3 border-b border-[#e8edf3] pb-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-[#f8fafc] text-[#2563eb]">
                    <Gift className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h2 className={`truncate text-[#0f172a] ${ADMIN_TYPOGRAPHY.sectionTitle}`}>{selectedOwner.shopName}</h2>
                    <p className={`text-[#64748b] ${ADMIN_TYPOGRAPHY.helper}`}>{selectedOwner.ownerName}</p>
                  </div>
                </div>

                {loading ? (
                  <p className={`mt-4 text-[#64748b] ${ADMIN_TYPOGRAPHY.body}`} role="status">
                    파일럿 혜택 상태를 불러오는 중입니다.
                  </p>
                ) : null}

                {!benefit.schemaReady ? (
                  <p className={`mt-4 rounded-[10px] border border-[#f1dfb7] bg-[#fffaf0] px-4 py-3 text-[#8a6211] ${ADMIN_TYPOGRAPHY.body}`} role="status">
                    파일럿 혜택 DB 적용 승인이 필요합니다. 승인 전에는 조회와 지급이 실행되지 않습니다.
                  </p>
                ) : null}

                <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                  <StatusRow label="파일럿 상태" value={benefit.enrolled ? "적용됨" : "미적용"} />
                  <StatusRow label="결제 상태" value={benefit.paid ? "첫 결제 완료" : "결제 전"} />
                  <StatusRow label="무료 이용" value={benefit.enrolled ? `${benefit.totalFreeDays}일 / 최대 60일` : "일반 14일"} />
                  <StatusRow label="무료 이용 종료" value={formatDateLabel(benefit.freeEndsAt)} />
                </dl>

                <div className="mt-5 border-t border-[#e8edf3] pt-5">
                  <h3 className={`text-[#0f172a] ${ADMIN_TYPOGRAPHY.sectionTitle}`}>
                    {benefit.enrolled ? "피드백·문제 보상" : "파일럿 기본 혜택"}
                  </h3>
                  <p className={`mt-1 text-[#64748b] ${ADMIN_TYPOGRAPHY.helper}`}>
                    {benefit.enrolled
                      ? `한 건당 3일 이상 · 남은 한도 ${benefit.remainingGrantableDays}일`
                      : "일반 14일을 최초 시작일부터 총 30일로 교체합니다."}
                  </p>

                  {benefit.enrolled ? (
                    <label className="mt-4 block">
                      <span className={`mb-2 block text-[#475569] ${ADMIN_TYPOGRAPHY.label}`}>지급 일수</span>
                      <input
                        value={days}
                        onChange={(event) => setDays(event.target.value.replace(/[^\d]/g, ""))}
                        inputMode="numeric"
                        className={`h-11 w-full rounded-[10px] border border-[#d7e0ea] bg-white px-3 outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] ${ADMIN_TYPOGRAPHY.control}`}
                      />
                    </label>
                  ) : null}

                  <label className="mt-4 block">
                    <span className={`mb-2 block text-[#475569] ${ADMIN_TYPOGRAPHY.label}`}>확인된 사유</span>
                    <textarea
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      maxLength={300}
                      className={`min-h-[96px] w-full rounded-[10px] border border-[#d7e0ea] bg-white px-3 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] ${ADMIN_TYPOGRAPHY.body}`}
                      placeholder={benefit.enrolled ? "검증된 피드백·문제와 지급 근거" : "파일럿 모집 대상 확인 근거"}
                    />
                  </label>

                  <label className="mt-3 flex min-h-11 cursor-pointer items-start gap-3 rounded-[10px] border border-[#d7e0ea] px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(event) => setConfirmed(event.target.checked)}
                      className="mt-0.5 h-5 w-5 shrink-0"
                    />
                    <span className={`text-[#334155] ${ADMIN_TYPOGRAPHY.label}`}>첫 결제 전 파일럿 대상과 지급 사유를 확인했습니다.</span>
                  </label>

                  <button
                    type="button"
                    disabled={grantDisabled}
                    onClick={() => void grantBenefit()}
                    className={`mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-[10px] bg-[#15213b] px-5 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 ${ADMIN_TYPOGRAPHY.control}`}
                  >
                    {saving ? "처리 중..." : benefit.enrolled ? "보상 기간 지급" : "파일럿 30일 적용"}
                  </button>
                </div>

                {message ? <p className={`mt-4 text-[#1f6b5b] ${ADMIN_TYPOGRAPHY.bodyStrong}`} role="status">{message}</p> : null}
                {error ? <p className={`mt-4 text-[#a04455] ${ADMIN_TYPOGRAPHY.body}`} role="alert">{error}</p> : null}
              </>
            ) : (
              <p className={`text-[#64748b] ${ADMIN_TYPOGRAPHY.body}`}>{loading ? "매장을 불러오는 중입니다." : "확인할 매장을 선택해 주세요."}</p>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[10px] border border-[#e8edf3] bg-[#f8fafc] px-3 py-3">
      <dt className={`text-[#64748b] ${ADMIN_TYPOGRAPHY.label}`}>{label}</dt>
      <dd className={`mt-1 break-words text-[#0f172a] ${ADMIN_TYPOGRAPHY.bodyStrong}`}>{value}</dd>
    </div>
  );
}
