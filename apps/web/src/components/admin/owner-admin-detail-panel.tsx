"use client";

import { ChevronDown, Loader2, RotateCcw, ShieldAlert, Store } from "lucide-react";
import type { Dispatch, ReactNode, SetStateAction } from "react";

import OwnerAdminPasswordPanel from "@/components/admin/owner-admin-password-panel";
import { ADMIN_TYPOGRAPHY } from "@/components/admin/admin-typography";
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
  type AdminOwnerItem,
  type OwnerDraft,
  type OwnerLastPaymentStatus,
  type OwnerPlanCode,
} from "@/components/admin/owner-admin-model";

type OwnerAdminDetailPanelProps = {
  selectedOwner: AdminOwnerItem | null;
  selectedDraft: OwnerDraft | null;
  setDrafts: Dispatch<SetStateAction<Record<string, OwnerDraft>>>;
  savingUserId: string | null;
  saveOwner: (item: AdminOwnerItem) => Promise<void>;
};

export default function OwnerAdminDetailPanel({
  selectedOwner,
  selectedDraft,
  setDrafts,
  savingUserId,
  saveOwner,
}: OwnerAdminDetailPanelProps) {
  return (
          <section className="sticky top-3 flex self-start flex-col overflow-hidden rounded-[14px] border border-[#D9E0E8] bg-white shadow-[0_2px_12px_rgba(15,23,42,0.06)] xl:h-[calc(100vh-24px)]">
            {selectedOwner && selectedDraft ? (
              <>
                <div className="shrink-0 border-b border-[#E8EDF3] px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#EFF6FF] text-[#2563EB]">
                        <Store className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
            <p className={`truncate text-[#0f172a] ${ADMIN_TYPOGRAPHY.bodyStrong}`}>{selectedOwner.ownerName}</p>
            <p className={`truncate text-[#64748b] ${ADMIN_TYPOGRAPHY.helper}`}>{selectedOwner.shopName}</p>
                      </div>
                    </div>
            <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 ${ADMIN_TYPOGRAPHY.badge} ${statusToneMap[selectedOwner.status]}`}>
                      {statusOptions.find((option) => option.value === selectedOwner.status)?.label ?? selectedOwner.status}
                    </span>
                  </div>

                  <details className="group mt-3 rounded-[10px] border border-[#E8EDF3] bg-[#F8FAFC]">
            <summary className={`grid min-h-11 cursor-pointer list-none grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 text-[#64748b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-inset [&::-webkit-details-marker]:hidden ${ADMIN_TYPOGRAPHY.meta}`}>
                      <div className="flex gap-1">
                        {selectedOwner.loginMethods.map((method) => (
                  <span key={`${selectedOwner.userId}-detail-${method}`} className={`rounded-full border px-2.5 py-1 ${ADMIN_TYPOGRAPHY.badge} ${loginMethodToneMap[method]}`}>
                            {loginMethodLabels[method]}
                          </span>
                        ))}
                      </div>
              <span className={`truncate text-right text-[#0f172a] ${ADMIN_TYPOGRAPHY.meta}`}>
                        {selectedOwner.ownerEmail ?? selectedOwner.loginId ?? "-"}
                      </span>
              <span className={`inline-flex items-center gap-1 ${ADMIN_TYPOGRAPHY.meta}`}>
                        상세
                        <ChevronDown className="h-3 w-3 transition group-open:rotate-180" />
                      </span>
                    </summary>
                    <div className="space-y-2 border-t border-[#E8EDF3] px-3 py-3">
                      <DetailRow label="로그인 이메일" value={selectedOwner.ownerEmail ?? selectedOwner.loginId ?? "-"} />
                      <DetailRow label="전화번호" value={selectedOwner.ownerPhoneNumber ?? "-"} />
                      <DetailRow label="매장 ID" value={selectedOwner.shopId} mono />
                    </div>
                  </details>
                </div>

                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#F8FAFC] px-4 py-4">
                  {selectedOwner.usageWarnings.length > 0 ? (
                    <section className="rounded-[14px] border border-[#F1DFB7] bg-[#FFF9EF] p-4">
                      <div className="flex items-center justify-between gap-3">
              <h3 className={`${ADMIN_TYPOGRAPHY.sectionTitle} text-[#7c5208]`}>운영 검토 필요</h3>
              <span className={`rounded-full bg-white/70 px-2.5 py-1 text-[#8a6211] ${ADMIN_TYPOGRAPHY.badge}`}>
                          {selectedOwner.usageWarnings.length}건
                        </span>
                      </div>
                      <div className="mt-2 space-y-1.5">
                        {selectedOwner.usageWarnings.map((warning) => (
                          <div key={warning.code} className={`rounded-[10px] border bg-white px-3 py-3 ${usageWarningToneMap[warning.level]}`}>
                    <p className={ADMIN_TYPOGRAPHY.bodyStrong}>{warning.message}</p>
                            {warning.evidence.length > 0 ? (
                      <ul className={`mt-2 space-y-1 ${ADMIN_TYPOGRAPHY.body}`}>
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
                    email={selectedOwner.ownerEmail ?? selectedOwner.loginId}
                  />

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

                  <div className="rounded-[14px] border border-[#E8EDF3] bg-white p-4">
                    <div className="flex items-center gap-3">
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#FFF4F1] text-[#9A5E4E]">
                        <ShieldAlert className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
              <p className={`${ADMIN_TYPOGRAPHY.sectionTitle} text-[#0f172a]`}>계정 정지 / 정지 해제</p>
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
                    className={`inline-flex h-11 items-center justify-center rounded-[10px] border border-[#E8C9C3] bg-[#FFF8F7] px-3 text-[#9A5E4E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 ${ADMIN_TYPOGRAPHY.control}`}
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
                    className={`inline-flex h-11 items-center justify-center rounded-[10px] border border-[#D7E0EA] bg-white px-3 text-[#334155] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 ${ADMIN_TYPOGRAPHY.control}`}
                      >
                        정지 해제
                      </button>
                    </div>

                    {selectedDraft.suspended ? (
                      <label className="mt-3 block">
                <span className={`mb-2 block text-[#64748b] ${ADMIN_TYPOGRAPHY.label}`}>정지 사유</span>
                        <textarea
                          value={selectedDraft.suspensionReason}
                          onChange={(event) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [selectedOwner.userId]: { ...prev[selectedOwner.userId], suspensionReason: event.target.value },
                            }))
                          }
                  className={`min-h-[96px] w-full rounded-[10px] border border-[#D7E0EA] bg-white px-3 py-2.5 text-[#172033] outline-none placeholder:text-[#94a3b8] focus-visible:ring-2 focus-visible:ring-[#2563EB] ${ADMIN_TYPOGRAPHY.body}`}
                          placeholder="왜 계정을 정지했는지 운영 메모를 남겨 주세요."
                        />
                      </label>
                    ) : null}

                    <div className="mt-3 border-t border-[#eadede] pt-3">
                      <div className="min-w-0">
                <p className={`${ADMIN_TYPOGRAPHY.sectionTitle} text-[#8f3f4d]`}>회원탈퇴</p>
                <p className={`mt-1 text-[#7d6a6d] ${ADMIN_TYPOGRAPHY.helper}`}>
                          계정과 매장 데이터를 삭제하며 동일 로그인 수단 재가입이 가능합니다.
                        </p>
                      </div>
                      <p className={`mt-2 rounded-[8px] border border-[#f1dfb7] bg-[#fffaf0] px-3 py-2 text-[#8a6211] ${ADMIN_TYPOGRAPHY.helper}`}>
                        보안 승인 정책 결정 필요 · 현재 회원탈퇴는 실행할 수 없습니다. 운영자가 최근 재인증을 마치고 삭제할 계정·매장 데이터를 직접 확인한 뒤 2인이 승인하며, 실패 시 계정과 매장 데이터를 그대로 보존하거나 복구하는 절차가 준비된 후 제공합니다.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[14px] border border-[#E8EDF3] bg-white p-4">
                    <div className="flex items-center gap-3">
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#EFF6FF] text-[#2563EB]">
                        <RotateCcw className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
              <p className={`${ADMIN_TYPOGRAPHY.sectionTitle} text-[#0f172a]`}>결제 내역 / 취소</p>
                      </div>
                    </div>

                    <div className="mt-2 rounded-[8px] border border-[#edf2f7] bg-white px-3 py-2">
                      <div>
                        <div className="min-w-0">
                    <p className={`${ADMIN_TYPOGRAPHY.bodyStrong} text-[#0f172a]`}>등록 결제수단 복구</p>
                    <p className={`mt-1 text-[#6f665f] ${ADMIN_TYPOGRAPHY.body}`}>
                            {selectedOwner.paymentMethodExists ? selectedOwner.paymentMethodLabel ?? "등록된 카드" : "등록 카드 없음"}
                          </p>
                        </div>
                        <p className={`mt-2 rounded-[8px] border border-[#f1dfb7] bg-[#fffaf0] px-3 py-2 text-[#8a6211] ${ADMIN_TYPOGRAPHY.helper}`}>
                          보안 승인 정책 결정 필요 · 현재 결제수단 초기화는 실행할 수 없습니다. 운영자가 최근 재인증을 마치고 초기화할 계정과 결제수단을 직접 확인한 뒤 2인이 승인하며, 실패 시 원래 결제수단을 보존하거나 복구하는 절차가 준비된 후 제공합니다.
                        </p>
                      </div>
                    </div>

                    <p className={`mt-2 rounded-[8px] border border-[#f1dfb7] bg-[#fffaf0] px-3 py-2 text-[#8a6211] ${ADMIN_TYPOGRAPHY.helper}`}>
                      환불 실행은 최근 재인증과 2인 승인, 중복 방지 원장이 준비된 뒤 제공합니다.
                    </p>

                    <div className="mt-2 space-y-1.5">
                      {selectedOwner.recentPayments.length === 0 ? (
                <p className={`rounded-[10px] border border-[#edf2f7] bg-white px-3 py-3 text-[#64748b] ${ADMIN_TYPOGRAPHY.body}`}>
                          확인된 결제 내역이 아직 없습니다.
                        </p>
                      ) : (
                        selectedOwner.recentPayments.map((payment) => (
                          <div key={payment.paymentId} className="rounded-[8px] border border-[#edf2f7] bg-white px-3 py-2.5">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                          <p className={`${ADMIN_TYPOGRAPHY.bodyStrong} text-[#0f172a]`}>
                                  {payment.planCode ? planOptions.find((option) => option.value === payment.planCode)?.label ?? payment.planCode : "플랜 정보 없음"}
                                </p>
                          <p className={`mt-1 text-[#475569] ${ADMIN_TYPOGRAPHY.body}`}>
                                  {payment.amount !== null ? `${payment.amount.toLocaleString("ko-KR")}원` : "금액 확인 필요"}
                                </p>
                          <p className={`mt-2 text-[#8a8277] ${ADMIN_TYPOGRAPHY.meta}`}>결제 시각 · {formatDateTimeLabel(payment.createdAt)}</p>
                          <p className={`mt-1 break-all rounded-[8px] bg-[#f8fafc] px-2.5 py-2 text-[#64748b] ${ADMIN_TYPOGRAPHY.meta}`}>
                                  결제 번호 · {payment.paymentId}
                                </p>
                              </div>
                              <span
                          className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 ${ADMIN_TYPOGRAPHY.badge} ${getRecentPaymentStatusMeta(payment.status).tone}`}
                              >
                                {getRecentPaymentStatusMeta(payment.status).label}
                              </span>
                            </div>
                            {payment.refundable ? <p className={`mt-2 text-[#64748b] ${ADMIN_TYPOGRAPHY.helper}`}>환불 비활성화</p> : null}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-[14px] border border-[#E8EDF3] bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
              <h3 className={`${ADMIN_TYPOGRAPHY.sectionTitle} text-[#0f172a]`}>최근 변경 이력</h3>
              <span className={`${ADMIN_TYPOGRAPHY.meta} text-[#8a8277]`}>{selectedOwner.recentEvents.length}건</span>
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {selectedOwner.recentEvents.length === 0 ? (
              <p className={`${ADMIN_TYPOGRAPHY.body} text-[#8a8277]`}>아직 기록된 변경 이력이 없습니다.</p>
                      ) : (
                        selectedOwner.recentEvents.map((event) => (
                          <div key={event.id} className="rounded-[8px] border border-[#edf2f7] bg-white px-2.5 py-2">
                            <div className="flex items-center justify-between gap-3">
                    <p className={`${ADMIN_TYPOGRAPHY.bodyStrong} text-[#0f172a]`}>{getEventLabel(event)}</p>
                    <span className={`${ADMIN_TYPOGRAPHY.meta} text-[#8a8277]`}>{formatDateTimeLabel(event.createdAt)}</span>
                            </div>
                  <p className={`mt-1.5 text-[#6f665f] ${ADMIN_TYPOGRAPHY.body}`}>{summarizeEvent(event)}</p>
                  <p className={`mt-1 text-[#8a8277] ${ADMIN_TYPOGRAPHY.meta}`}>{event.adminEmail}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="sticky bottom-0 z-10 shrink-0 border-t border-[#D9E0E8] bg-white/96 px-4 py-3 backdrop-blur">
                  <button
                    type="button"
                    onClick={() => void saveOwner(selectedOwner)}
                    disabled={savingUserId === selectedOwner.userId}
            className={`inline-flex h-11 w-full items-center justify-center rounded-[10px] bg-[#1D4ED8] px-4 text-white transition hover:bg-[#1E40AF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 disabled:opacity-50 ${ADMIN_TYPOGRAPHY.control}`}
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
      <div className={`px-5 py-14 text-center text-[#6f665f] ${ADMIN_TYPOGRAPHY.body}`}>왼쪽에서 오너 계정을 선택하면 상세 정보와 편집 영역이 열립니다.</div>
            )}
          </section>
  );
}

function DetailRow({ label, value, children, mono = false }: { label: string; value?: string; children?: ReactNode; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-3">
      <span className={`${ADMIN_TYPOGRAPHY.meta} text-[#64748b]`}>{label}</span>
      <div className={`min-w-0 truncate text-right text-[#0f172a] ${ADMIN_TYPOGRAPHY.bodyStrong} ${mono ? "font-mono" : ""}`}>{children ?? value ?? "-"}</div>
    </div>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="block">
      <span className={`mb-1.5 block text-[#64748b] ${ADMIN_TYPOGRAPHY.label}`}>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className={`h-11 w-full rounded-[10px] border border-[#D7E0EA] bg-white px-3 text-[#172033] outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] ${ADMIN_TYPOGRAPHY.body}`}>
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
      <span className={`mb-1.5 block text-[#64748b] ${ADMIN_TYPOGRAPHY.label}`}>{label}</span>
      <input type="date" value={value} onChange={(event) => onChange(event.target.value)} className={`h-11 w-full rounded-[10px] border border-[#D7E0EA] bg-white px-3 text-[#172033] outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] ${ADMIN_TYPOGRAPHY.body}`} />
    </label>
  );
}

function ActionButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`inline-flex h-11 items-center justify-center rounded-[10px] border border-[#D7E0EA] bg-white px-3 text-[#172033] transition hover:bg-[#F8FAFC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 ${ADMIN_TYPOGRAPHY.control}`}>
      {children}
    </button>
  );
}
