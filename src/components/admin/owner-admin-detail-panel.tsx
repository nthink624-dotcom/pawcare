"use client";

import { ChevronDown, Loader2, MessageSquareText, RefreshCcw, RotateCcw, ShieldAlert, Store, Trash2 } from "lucide-react";
import type { Dispatch, ReactNode, SetStateAction } from "react";

import OwnerAdminPasswordPanel from "@/components/admin/owner-admin-password-panel";
import {
  formatDateTimeLabel,
  getEventLabel,
  getRecentPaymentStatusMeta,
  loginMethodLabels,
  loginMethodToneMap,
  paymentStatusOptions,
  planOptions,
  plusDays,
  statusOptions,
  statusToneMap,
  summarizeEvent,
  todayKstDateText,
  usageWarningToneMap,
  type AdminAlimtalkCreditBalance,
  type AdminOwnerItem,
  type OwnerDraft,
  type OwnerLastPaymentStatus,
  type OwnerPlanCode,
  type TemporaryPasswordResult,
} from "@/components/admin/owner-admin-model";

type OwnerAdminDetailPanelProps = {
  selectedOwner: AdminOwnerItem | null;
  selectedDraft: OwnerDraft | null;
  selectedAlimtalkBalance: AdminAlimtalkCreditBalance | null;
  issuingTemporaryPasswordUserId: string | null;
  temporaryPasswords: Record<string, TemporaryPasswordResult>;
  issueOwnerTemporaryPassword: (item: AdminOwnerItem) => Promise<void>;
  loadingAlimtalkCredits: boolean;
  savingAlimtalkCredits: boolean;
  loadAlimtalkBalances: () => Promise<void>;
  alimtalkAction: "grant" | "reset-included";
  setAlimtalkAction: Dispatch<SetStateAction<"grant" | "reset-included">>;
  alimtalkAmount: string;
  setAlimtalkAmount: Dispatch<SetStateAction<string>>;
  alimtalkBucket: "purchased" | "included";
  setAlimtalkBucket: Dispatch<SetStateAction<"purchased" | "included">>;
  saveOwnerAlimtalkCredits: (item: AdminOwnerItem) => Promise<void>;
  setDrafts: Dispatch<SetStateAction<Record<string, OwnerDraft>>>;
  savingUserId: string | null;
  saveOwner: (item: AdminOwnerItem) => Promise<void>;
  withdrawingUserId: string | null;
  withdrawOwner: (item: AdminOwnerItem) => Promise<void>;
  resettingPaymentMethodUserId: string | null;
  resetOwnerPaymentMethod: (item: AdminOwnerItem) => Promise<void>;
  refundReasons: Record<string, string>;
  setRefundReasons: Dispatch<SetStateAction<Record<string, string>>>;
  refundingPaymentId: string | null;
  refundOwner: (item: AdminOwnerItem, paymentId?: string) => Promise<void>;
};

export default function OwnerAdminDetailPanel({
  selectedOwner,
  selectedDraft,
  selectedAlimtalkBalance,
  issuingTemporaryPasswordUserId,
  temporaryPasswords,
  issueOwnerTemporaryPassword,
  loadingAlimtalkCredits,
  savingAlimtalkCredits,
  loadAlimtalkBalances,
  alimtalkAction,
  setAlimtalkAction,
  alimtalkAmount,
  setAlimtalkAmount,
  alimtalkBucket,
  setAlimtalkBucket,
  saveOwnerAlimtalkCredits,
  setDrafts,
  savingUserId,
  saveOwner,
  withdrawingUserId,
  withdrawOwner,
  resettingPaymentMethodUserId,
  resetOwnerPaymentMethod,
  refundReasons,
  setRefundReasons,
  refundingPaymentId,
  refundOwner,
}: OwnerAdminDetailPanelProps) {
  return (
          <section className="sticky top-1.5 flex self-start flex-col overflow-hidden rounded-[10px] border border-[#dfe7e2] bg-white xl:h-[calc(100vh-12px)]">
            {selectedOwner && selectedDraft ? (
              <>
                <div className="shrink-0 border-b border-[#edf2f7] px-2.5 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#eef7f2] text-[#1f6b5b]">
                        <Store className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold leading-4 text-[#0f172a]">{selectedOwner.ownerName}</p>
                        <p className="truncate text-[11px] leading-4 text-[#64748b]">{selectedOwner.shopName}</p>
                      </div>
                    </div>
                    <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] ${statusToneMap[selectedOwner.status]}`}>
                      {statusOptions.find((option) => option.value === selectedOwner.status)?.label ?? selectedOwner.status}
                    </span>
                  </div>

                  <details className="group mt-1.5 rounded-[7px] border border-[#edf2f7] bg-[#fbfcfd]">
                    <summary className="grid h-7 cursor-pointer list-none grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1.5 px-2 text-[11px] text-[#64748b] [&::-webkit-details-marker]:hidden">
                      <div className="flex gap-1">
                        {selectedOwner.loginMethods.map((method) => (
                          <span key={`${selectedOwner.userId}-detail-${method}`} className={`rounded-full border px-1.5 py-0.5 text-[10px] ${loginMethodToneMap[method]}`}>
                            {loginMethodLabels[method]}
                          </span>
                        ))}
                      </div>
                      <span className="truncate text-right text-[11px] text-[#0f172a]">
                        {selectedOwner.loginId ??
                          (selectedOwner.ownerEmail?.endsWith("@owner.petmanager.local") ? "-" : selectedOwner.ownerEmail ?? "-")}
                      </span>
                      <span className="inline-flex items-center gap-0.5 text-[10px]">
                        상세
                        <ChevronDown className="h-3 w-3 transition group-open:rotate-180" />
                      </span>
                    </summary>
                    <div className="space-y-1 border-t border-[#edf2f7] px-2 py-1.5">
                      <DetailRow label="연동 이메일" value={selectedOwner.ownerEmail ?? "-"} />
                      <DetailRow label="전화번호" value={selectedOwner.ownerPhoneNumber ?? "-"} />
                      <DetailRow label="매장 ID" value={selectedOwner.shopId} mono />
                    </div>
                  </details>
                </div>

                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2">
                  {selectedOwner.usageWarnings.length > 0 ? (
                    <section className="rounded-[9px] border border-[#f1dfb7] bg-[#fffaf0] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-[13px] font-semibold text-[#7c5208]">운영 검토 필요</h3>
                        <span className="rounded-full bg-white/70 px-2.5 py-1 text-[13px] font-semibold text-[#8a6211]">
                          {selectedOwner.usageWarnings.length}건
                        </span>
                      </div>
                      <div className="mt-2 space-y-1.5">
                        {selectedOwner.usageWarnings.map((warning) => (
                          <div key={warning.code} className={`rounded-[8px] border bg-white px-2.5 py-2 ${usageWarningToneMap[warning.level]}`}>
                            <p className="text-[13px] font-semibold">{warning.message}</p>
                            {warning.evidence.length > 0 ? (
                              <ul className="mt-2 space-y-1 text-[13px] leading-5">
                                {warning.evidence.map((evidence) => (
                                  <li key={evidence} className="break-words">
                                    {evidence}
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  <OwnerAdminPasswordPanel
                    ownerName={selectedOwner.ownerName}
                    loginId={selectedOwner.loginId}
                    issuing={issuingTemporaryPasswordUserId === selectedOwner.userId}
                    result={temporaryPasswords[selectedOwner.userId] ?? null}
                    onIssue={() => void issueOwnerTemporaryPassword(selectedOwner)}
                  />

                  <div className="rounded-[9px] border border-[#edf2f7] bg-white p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] bg-[#eef7f2] text-[#1f6b5b]">
                          <MessageSquareText className="h-4 w-4" />
                        </div>
                        <h3 className="text-[13px] text-[#0f172a]">알림톡</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => void loadAlimtalkBalances()}
                        disabled={loadingAlimtalkCredits || savingAlimtalkCredits}
                        className="inline-flex h-8 items-center gap-1.5 rounded-[7px] border border-[#dbe2ea] bg-white px-2.5 text-[12px] text-[#475569] disabled:opacity-50"
                      >
                        <RefreshCcw className="h-3.5 w-3.5" />
                        새로고침
                      </button>
                    </div>

                    <div className="mt-2 grid grid-cols-3 gap-1.5">
                      <MiniStat label="총 잔여" value={`${(selectedAlimtalkBalance?.remainingTotal ?? 0).toLocaleString("ko-KR")}건`} />
                      <MiniStat label="포함" value={`${(selectedAlimtalkBalance?.includedRemaining ?? 0).toLocaleString("ko-KR")}건`} />
                      <MiniStat label="추가" value={`${(selectedAlimtalkBalance?.purchasedRemaining ?? 0).toLocaleString("ko-KR")}건`} />
                    </div>

                    <div className="mt-2 grid grid-cols-[1fr_82px] gap-1.5">
                      <select
                        value={alimtalkAction}
                        onChange={(event) => setAlimtalkAction(event.target.value === "reset-included" ? "reset-included" : "grant")}
                        className="h-8 rounded-[7px] border border-[#dbe2ea] bg-white px-2.5 text-[12px] text-[#172033] outline-none focus:border-[#2f7866]"
                      >
                        <option value="grant">건수 추가</option>
                        <option value="reset-included">포함 건수 리셋</option>
                      </select>
                      <input
                        value={alimtalkAmount}
                        onChange={(event) => setAlimtalkAmount(event.target.value.replace(/[^\d]/g, ""))}
                        inputMode="numeric"
                        className="h-8 rounded-[7px] border border-[#dbe2ea] bg-white px-2.5 text-[12px] text-[#172033] outline-none focus:border-[#2f7866]"
                      />
                    </div>

                    {alimtalkAction === "grant" ? (
                      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setAlimtalkBucket("purchased")}
                          className={`h-8 rounded-[7px] border text-[12px] ${alimtalkBucket === "purchased" ? "border-[#1f6b5b] bg-[#f4faf7] text-[#1f6b5b]" : "border-[#dbe2ea] bg-white text-[#475569]"}`}
                        >
                          추가
                        </button>
                        <button
                          type="button"
                          onClick={() => setAlimtalkBucket("included")}
                          className={`h-8 rounded-[7px] border text-[12px] ${alimtalkBucket === "included" ? "border-[#1f6b5b] bg-[#f4faf7] text-[#1f6b5b]" : "border-[#dbe2ea] bg-white text-[#475569]"}`}
                        >
                          포함
                        </button>
                      </div>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => void saveOwnerAlimtalkCredits(selectedOwner)}
                      disabled={savingAlimtalkCredits || loadingAlimtalkCredits}
                      className="mt-2 inline-flex h-8 w-full items-center justify-center rounded-[7px] bg-[#1f6b5b] px-3 text-[13px] text-white disabled:opacity-50"
                    >
                      {savingAlimtalkCredits ? "저장 중..." : "알림톡 저장"}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <SelectField
                      label="현재 플랜"
                      value={selectedDraft.currentPlanCode}
                      onChange={(value) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [selectedOwner.userId]: { ...prev[selectedOwner.userId], currentPlanCode: value as OwnerPlanCode },
                        }))
                      }
                      options={planOptions}
                    />
                    <SelectField
                      label="결제 상태"
                      value={selectedDraft.lastPaymentStatus}
                      onChange={(value) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [selectedOwner.userId]: { ...prev[selectedOwner.userId], lastPaymentStatus: value as OwnerLastPaymentStatus },
                        }))
                      }
                      options={paymentStatusOptions}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <DateField
                      label="서비스 시작일"
                      value={selectedDraft.serviceStartedAt}
                      onChange={(value) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [selectedOwner.userId]: { ...prev[selectedOwner.userId], serviceStartedAt: value },
                        }))
                      }
                    />
                    <DateField
                      label="서비스 종료일"
                      value={selectedDraft.currentPeriodEndsAt}
                      onChange={(value) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [selectedOwner.userId]: { ...prev[selectedOwner.userId], currentPeriodEndsAt: value },
                        }))
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <ActionButton
                      onClick={() =>
                        setDrafts((prev) => ({
                          ...prev,
                          [selectedOwner.userId]: {
                            ...prev[selectedOwner.userId],
                            serviceStartedAt: todayKstDateText(),
                            currentPeriodEndsAt: plusDays(todayKstDateText(), 7),
                          },
                        }))
                      }
                    >
                      서비스 7일 연장
                    </ActionButton>
                    <ActionButton
                      onClick={() =>
                        setDrafts((prev) => ({
                          ...prev,
                          [selectedOwner.userId]: {
                            ...prev[selectedOwner.userId],
                            serviceStartedAt: todayKstDateText(),
                            currentPeriodEndsAt: plusDays(todayKstDateText(), 30),
                          },
                        }))
                      }
                    >
                      서비스 30일 연장
                    </ActionButton>
                  </div>

                  <div className="sticky top-0 z-10 -mx-3 border-y border-[#edf2f7] bg-white/96 px-3 py-2 backdrop-blur">
                    <button
                      type="button"
                      onClick={() => void saveOwner(selectedOwner)}
                      disabled={savingUserId === selectedOwner.userId}
                      className="inline-flex h-9 w-full items-center justify-center rounded-[8px] bg-[#1f6b5b] px-3 text-[13px] text-white disabled:opacity-50"
                    >
                      {savingUserId === selectedOwner.userId ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          저장 중...
                        </span>
                      ) : (
                        "변경사항 저장"
                      )}
                    </button>
                  </div>

                  <div className="rounded-[9px] border border-[#edf2f7] bg-[#fbfcfd] p-3">
                    <div className="flex items-center gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#fff4f1] text-[#b54b4b]">
                        <ShieldAlert className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] text-[#0f172a]">계정 정지 / 정지 해제</p>
                      </div>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setDrafts((prev) => ({
                            ...prev,
                            [selectedOwner.userId]: {
                              ...prev[selectedOwner.userId],
                              suspended: true,
                              suspensionReason: prev[selectedOwner.userId]?.suspensionReason || "운영자에 의해 계정이 일시 정지되었습니다.",
                            },
                          }))
                        }
                        className="inline-flex h-8 items-center justify-center rounded-[8px] border border-[#f0d1d1] bg-[#fff7f7] px-2.5 text-[13px] text-[#b54b4b]"
                      >
                        계정 정지
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDrafts((prev) => ({
                            ...prev,
                            [selectedOwner.userId]: { ...prev[selectedOwner.userId], suspended: false, suspensionReason: "" },
                          }))
                        }
                        className="inline-flex h-8 items-center justify-center rounded-[8px] border border-[#d7e7e1] bg-[#f4faf7] px-2.5 text-[13px] text-[#1f6b5b]"
                      >
                        정지 해제
                      </button>
                    </div>

                    {selectedDraft.suspended ? (
                      <label className="mt-3 block">
                        <span className="mb-1.5 block text-[13px] text-[#64748b]">정지 사유</span>
                        <textarea
                          value={selectedDraft.suspensionReason}
                          onChange={(event) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [selectedOwner.userId]: { ...prev[selectedOwner.userId], suspensionReason: event.target.value },
                            }))
                          }
                          className="min-h-[64px] w-full rounded-[8px] border border-[#dbe2ea] bg-white px-2.5 py-2 text-[13px] text-[#172033] outline-none placeholder:text-[#94a3b8] focus:border-[#2f7866]"
                          placeholder="왜 계정을 정지했는지 운영 메모를 남겨 주세요."
                        />
                      </label>
                    ) : null}

                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#eadede] pt-3">
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-[#8f3f4d]">회원탈퇴</p>
                        <p className="mt-0.5 text-[12px] leading-4 text-[#7d6a6d]">
                          계정과 매장 데이터를 삭제하며 동일 로그인 수단 재가입이 가능합니다.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void withdrawOwner(selectedOwner)}
                        disabled={withdrawingUserId === selectedOwner.userId}
                        className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-[8px] border border-[#e8c6cc] bg-white px-2.5 text-[13px] font-semibold text-[#a04455] disabled:opacity-50"
                      >
                        {withdrawingUserId === selectedOwner.userId ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        {withdrawingUserId === selectedOwner.userId ? "탈퇴 중" : "회원탈퇴"}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-[9px] border border-[#edf2f7] bg-[#fbfcfd] p-3">
                    <div className="flex items-center gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#fff5f1] text-[#b86945]">
                        <RotateCcw className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] text-[#0f172a]">결제 내역 / 취소</p>
                      </div>
                    </div>

                    <div className="mt-2 rounded-[8px] border border-[#edf2f7] bg-white px-3 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[13px] text-[#0f172a]">등록 결제수단 복구</p>
                          <p className="mt-1 text-[13px] leading-5 text-[#6f665f]">
                            {selectedOwner.paymentMethodExists ? selectedOwner.paymentMethodLabel ?? "등록된 카드" : "등록 카드 없음"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void resetOwnerPaymentMethod(selectedOwner)}
                          disabled={!selectedOwner.paymentMethodExists || resettingPaymentMethodUserId === selectedOwner.userId}
                          className="inline-flex h-8 shrink-0 items-center justify-center rounded-[8px] border border-[#dbe2ea] bg-white px-2.5 text-[12px] text-[#475569] disabled:opacity-50"
                        >
                          {resettingPaymentMethodUserId === selectedOwner.userId ? (
                            <span className="inline-flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              초기화 중...
                            </span>
                          ) : (
                            "결제수단 초기화"
                          )}
                        </button>
                      </div>
                    </div>

                    <label className="mt-2 block">
                      <span className="mb-1.5 block text-[13px] text-[#64748b]">취소 사유</span>
                      <textarea
                        value={refundReasons[selectedOwner.userId] ?? ""}
                        onChange={(event) =>
                          setRefundReasons((prev) => ({
                            ...prev,
                            [selectedOwner.userId]: event.target.value,
                          }))
                        }
                        className="min-h-[56px] w-full rounded-[8px] border border-[#dbe2ea] bg-white px-2.5 py-2 text-[13px] text-[#172033] outline-none placeholder:text-[#94a3b8] focus:border-[#2f7866]"
                        placeholder="예: 중복 결제 확인, 고객 요청 환불"
                      />
                    </label>

                    <div className="mt-2 space-y-1.5">
                      {selectedOwner.recentPayments.length === 0 ? (
                        <p className="rounded-[10px] border border-[#edf2f7] bg-white px-3 py-3 text-[13px] leading-5 text-[#64748b]">
                          확인된 결제 내역이 아직 없습니다.
                        </p>
                      ) : (
                        selectedOwner.recentPayments.map((payment) => (
                          <div key={payment.paymentId} className="rounded-[8px] border border-[#edf2f7] bg-white px-3 py-2.5">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-[13px] text-[#0f172a]">
                                  {payment.planCode ? planOptions.find((option) => option.value === payment.planCode)?.label ?? payment.planCode : "플랜 정보 없음"}
                                </p>
                                <p className="mt-1 text-[13px] text-[#475569]">
                                  {payment.amount !== null ? `${payment.amount.toLocaleString("ko-KR")}원` : "금액 확인 필요"}
                                </p>
                                <p className="mt-2 text-[13px] text-[#8a8277]">결제 시각 · {formatDateTimeLabel(payment.createdAt)}</p>
                                <p className="mt-1 break-all rounded-[8px] bg-[#f8fafc] px-2.5 py-2 text-[13px] text-[#64748b]">
                                  결제 번호 · {payment.paymentId}
                                </p>
                              </div>
                              <span
                                className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[13px] ${getRecentPaymentStatusMeta(payment.status).tone}`}
                              >
                                {getRecentPaymentStatusMeta(payment.status).label}
                              </span>
                            </div>
                            {payment.refundable ? (
                              <button
                                type="button"
                                onClick={() => void refundOwner(selectedOwner, payment.paymentId)}
                                disabled={refundingPaymentId === payment.paymentId}
                                className="mt-3 inline-flex h-[38px] w-full items-center justify-center rounded-[10px] border border-[#efcfc2] bg-[#fff8f4] px-3 text-[13px] text-[#b45d3c] disabled:opacity-50"
                              >
                                {refundingPaymentId === payment.paymentId ? (
                                  <span className="inline-flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    취소 처리 중...
                                  </span>
                                ) : (
                                  "이 결제 취소"
                                )}
                              </button>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-[9px] border border-[#edf2f7] bg-[#fbfcfd] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-[13px] text-[#0f172a]">최근 변경 이력</h3>
                      <span className="text-[13px] font-medium text-[#8a8277]">{selectedOwner.recentEvents.length}건</span>
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {selectedOwner.recentEvents.length === 0 ? (
                        <p className="text-[13px] leading-5 text-[#8a8277]">아직 기록된 변경 이력이 없습니다.</p>
                      ) : (
                        selectedOwner.recentEvents.map((event) => (
                          <div key={event.id} className="rounded-[8px] border border-[#edf2f7] bg-white px-2.5 py-2">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-[13px] text-[#0f172a]">{getEventLabel(event)}</p>
                              <span className="text-[13px] font-medium text-[#8a8277]">{formatDateTimeLabel(event.createdAt)}</span>
                            </div>
                            <p className="mt-1.5 text-[13px] leading-5 text-[#6f665f]">{summarizeEvent(event)}</p>
                            <p className="mt-1 text-[13px] font-medium text-[#8a8277]">{event.adminEmail}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="hidden shrink-0 border-t border-[#edf2f7] bg-white px-3 py-2 xl:block">
                  <button
                    type="button"
                    onClick={() => void saveOwner(selectedOwner)}
                    disabled={savingUserId === selectedOwner.userId}
                    className="inline-flex h-9 w-full items-center justify-center rounded-[8px] bg-[#1f6b5b] px-3 text-[13px] text-white disabled:opacity-50"
                  >
                    {savingUserId === selectedOwner.userId ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        저장 중...
                      </span>
                    ) : (
                      "변경사항 저장"
                    )}
                  </button>
                </div>
              </>
            ) : (
              <div className="px-5 py-14 text-center text-[13px] text-[#6f665f]">왼쪽에서 오너 계정을 선택하면 상세 정보와 편집 영역이 열립니다.</div>
            )}
          </section>
  );
}

function DetailRow({ label, value, children, mono = false }: { label: string; value?: string; children?: ReactNode; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[78px_minmax(0,1fr)] items-center gap-2">
      <span className="text-[12px] text-[#64748b]">{label}</span>
      <div className={`min-w-0 truncate text-right text-[12px] text-[#0f172a] ${mono ? "font-mono" : ""}`}>{children ?? value ?? "-"}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[7px] border border-[#edf2f7] bg-[#fbfcfd] px-2 py-1.5">
      <p className="text-[11px] text-[#64748b]">{label}</p>
      <p className="mt-0.5 truncate text-[12px] text-[#0f172a]">{value}</p>
    </div>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] text-[#64748b]">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-2.5 text-[13px] text-[#172033] outline-none focus:border-[#2f7866]">
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] text-[#64748b]">{label}</span>
      <input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-2.5 text-[13px] text-[#172033] outline-none focus:border-[#2f7866]" />
    </label>
  );
}

function ActionButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex h-8 items-center justify-center rounded-[8px] border border-[#dbe2ea] bg-white px-2.5 text-[12px] text-[#172033] transition hover:bg-[#f8fafc]">
      {children}
    </button>
  );
}
