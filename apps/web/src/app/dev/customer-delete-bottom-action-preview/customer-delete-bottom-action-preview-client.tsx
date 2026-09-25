"use client";

import { useMemo, useState, type MouseEvent } from "react";

import OwnerApp from "@/components/owner/owner-app";

import { buildCustomerDeleteBottomActionPreviewFixture } from "./customer-delete-bottom-action-preview-fixture";

export default function CustomerDeleteBottomActionPreviewClient() {
  const initialData = useMemo(() => buildCustomerDeleteBottomActionPreviewFixture(), []);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [previewNotice, setPreviewNotice] = useState<string | null>(null);

  const blockFixtureDelete = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!target.closest('[data-testid="customer-delete-bottom-action"] button')) return;

    event.preventDefault();
    event.stopPropagation();
    setPreviewNotice(null);
    setDeleteConfirmationOpen(true);
  };

  return (
    <div
      onClickCapture={blockFixtureDelete}
      data-preview-source="fixture"
      data-preview-auth="none"
      data-preview-persistence="disabled"
      data-preview-customer-count={initialData.guardians.length}
    >
      <OwnerApp
        initialData={initialData}
        ownedShops={[
          {
            id: initialData.shop.id,
            name: initialData.shop.name,
            address: initialData.shop.address,
            heroImageUrl: "",
          },
        ]}
        selectedShopId={initialData.shop.id}
        isPreviewDemo
      />

      {deleteConfirmationOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#101a31]/25 px-4" role="presentation">
          <section
            aria-describedby="customer-delete-preview-dialog-description"
            aria-labelledby="customer-delete-preview-dialog-title"
            aria-modal="true"
            className="w-full max-w-[360px] rounded-[14px] border border-[#e8edf3] bg-white p-4 shadow-[0_18px_36px_rgba(16,26,49,0.14)]"
            role="dialog"
          >
            <h2 id="customer-delete-preview-dialog-title" className="text-[20px] font-semibold leading-7 tracking-[-0.02em] text-[#15213b]">
              선택한 고객 삭제
            </h2>
            <p id="customer-delete-preview-dialog-description" className="mt-2 text-[14px] font-normal leading-5 text-[#64748b]">
              이 화면은 배치 검수용입니다. 확인을 눌러도 고객 데이터는 삭제되지 않습니다.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="min-h-11 rounded-[10px] border border-[#e8edf3] bg-white px-4 text-[14px] font-medium text-[#15213b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]"
                onClick={() => setDeleteConfirmationOpen(false)}
              >
                취소
              </button>
              <button
                type="button"
                className="min-h-11 rounded-[10px] border border-[#9a5e4e] bg-[#9a5e4e] px-4 text-[14px] font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]"
                onClick={() => {
                  setDeleteConfirmationOpen(false);
                  setPreviewNotice("검수용 화면에서는 고객을 삭제하지 않았습니다.");
                }}
              >
                확인
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {previewNotice ? (
        <p className="sr-only" role="status" aria-live="polite">
          {previewNotice}
        </p>
      ) : null}
    </div>
  );
}
