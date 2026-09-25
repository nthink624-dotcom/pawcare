import type {
  PriceGuideV2,
  PriceGuideV2AiReview,
  PriceGuideV2Row,
} from "@/types/price-guide-photo-import";

const speciesLabels: Record<PriceGuideV2Row["species"], string> = {
  dog: "강아지",
  cat: "고양이",
  all: "강아지·고양이 공통",
  unknown: "동물 종류 확인 필요",
};

const sizeClassLabels: Record<PriceGuideV2Row["sizeClass"], string> = {
  small: "소형견",
  medium: "중형견",
  large: "대형견",
  "extra-large": "초대형견",
  all: "전체 크기",
  unknown: "크기 확인 필요",
};

const sourceLabels: Record<PriceGuideV2["source"], string> = {
  ai_imported: "AI에서 가져옴",
  owner_corrected: "확인 후 수정",
  vision: "사진에서 읽음",
  fixture: "검수용 예시",
  manual: "직접 입력",
  owner_confirmed: "확인 후 저장",
  legacy: "기존 요금표",
};

const priceKindLabels: Record<PriceGuideV2Row["priceKind"], string> = {
  fixed: "고정가",
  starting: "시작가",
  range: "가격 범위",
  unknown: "가격 방식 확인 필요",
};

const reviewFieldLabels: Record<string, string> = {
  serviceName: "서비스명",
  species: "동물 종류",
  breedNames: "품종",
  breedGroup: "품종 그룹",
  sizeClass: "크기",
  minKg: "최소 몸무게",
  maxKg: "최대 몸무게",
  priceKind: "가격 방식",
  priceMinKrw: "최소 가격",
  priceMaxKrw: "최대 가격",
  durationMinutes: "소요 시간",
  note: "항목 메모",
  overallNote: "전체 안내",
  condition: "추가요금 조건",
  amountKrw: "추가 금액",
  percent: "추가 비율",
};

function formatKrw(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

function formatPrice(row: PriceGuideV2Row) {
  if (row.priceKind === "unknown" || row.priceMinKrw === null) return "가격 확인 필요";
  if (row.priceKind === "starting") return `${formatKrw(row.priceMinKrw)}부터`;
  if (row.priceKind === "range") {
    return row.priceMaxKrw === null
      ? "가격 범위 확인 필요"
      : `${row.priceMinKrw.toLocaleString("ko-KR")}~${formatKrw(row.priceMaxKrw)}`;
  }
  return formatKrw(row.priceMinKrw);
}

function formatWeight(row: PriceGuideV2Row) {
  if (row.minKg !== null && row.maxKg !== null) return `${row.minKg}~${row.maxKg}kg`;
  if (row.maxKg !== null) return `${row.maxKg}kg 이하`;
  if (row.minKg !== null) return `${row.minKg}kg 이상`;
  return "몸무게 정보 없음";
}

function formatReviewStatus(review: PriceGuideV2AiReview) {
  if (review.userCorrected) return "수정 완료";
  if (review.userConfirmed) return "확인 완료";
  return "확인 필요";
}

function reviewStatusClass(review: PriceGuideV2AiReview) {
  if (!review.userConfirmed && !review.userCorrected) {
    return "border-[#ead7b3] bg-[#fffaf0] text-[#8a641f]";
  }
  return "border-[#cfe3d7] bg-[#f5fbf7] text-[#26724b]";
}

function reviewTargetLabel(document: PriceGuideV2, review: PriceGuideV2AiReview) {
  const rowMatch = /^rows:(\d+)$/.exec(review.targetId);
  if (rowMatch) {
    const row = document.rows[Number(rowMatch[1])];
    return row?.serviceName ?? `요금 항목 ${Number(rowMatch[1]) + 1}`;
  }
  const surchargeMatch = /^surcharges:(\d+)$/.exec(review.targetId);
  if (surchargeMatch) {
    const surcharge = document.surcharges[Number(surchargeMatch[1])];
    return surcharge?.condition ?? `추가요금 ${Number(surchargeMatch[1]) + 1}`;
  }
  if (review.targetId === "overallNote") return "전체 안내";
  return "기타 항목";
}

export function ServicePriceGuideV2View({ document }: { document: PriceGuideV2 }) {
  const unresolvedReviewCount = document.aiReview.filter(
    (review) => !review.userConfirmed && !review.userCorrected,
  ).length;

  return (
    <div className="space-y-4" data-price-guide-schema-version="2">
      <header className="flex flex-wrap items-start justify-between gap-3 rounded-[10px] border border-[#dbe2ea] bg-[#f8fafc] px-4 py-3">
        <div>
          <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-[#111827]">
            회원가입 때 저장한 상세 요금표
          </h3>
          <p className="mt-1 text-[13px] leading-5 text-[#64748b]">
            {document.rows.length}개 요금 항목 · 추가요금 {document.surcharges.length}개 · {sourceLabels[document.source]}
          </p>
        </div>
        <span
          className={`inline-flex min-h-8 items-center rounded-[8px] border px-3 text-[13px] font-medium ${
            unresolvedReviewCount > 0
              ? "border-[#ead7b3] bg-[#fffaf0] text-[#8a641f]"
              : "border-[#cfe3d7] bg-white text-[#26724b]"
          }`}
        >
          {document.aiReview.length === 0
            ? "AI 확인 기록 없음"
            : unresolvedReviewCount > 0
              ? `AI 확인 필요 ${unresolvedReviewCount}건`
              : "AI 확인 완료"}
        </span>
      </header>

      <section aria-labelledby="saved-price-guide-rows-title" className="space-y-3">
        <h3 id="saved-price-guide-rows-title" className="text-[16px] font-semibold text-[#111827]">
          요금 항목
        </h3>
        {document.rows.length > 0 ? (
          <div className="grid gap-3 xl:grid-cols-2">
            {document.rows.map((row, index) => {
              const rowReviews = document.aiReview.filter((review) => review.targetId === `rows:${index}`);
              const rowNeedsReview = rowReviews.some((review) => !review.userConfirmed && !review.userCorrected);

              return (
                <article key={`saved-price-guide-row-${index}`} className="min-w-0 rounded-[10px] border border-[#dbe2ea] bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="break-words text-[16px] font-semibold text-[#111827]">
                        {row.serviceName ?? "서비스명 확인 필요"}
                      </h4>
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[12px] text-[#526174]">
                        <span className="rounded-[6px] border border-[#dbe2ea] bg-[#f8fafc] px-2 py-1">{speciesLabels[row.species]}</span>
                        <span className="rounded-[6px] border border-[#dbe2ea] bg-[#f8fafc] px-2 py-1">{sizeClassLabels[row.sizeClass]}</span>
                        <span className="rounded-[6px] border border-[#dbe2ea] bg-[#f8fafc] px-2 py-1">{formatWeight(row)}</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[16px] font-semibold text-[#111827]">{formatPrice(row)}</p>
                      <p className="mt-1 text-[13px] text-[#64748b]">
                        {priceKindLabels[row.priceKind]} · {row.durationMinutes === null ? "시간 확인 필요" : `${row.durationMinutes}분`}
                      </p>
                    </div>
                  </div>

                  <dl className="mt-4 grid gap-3 border-t border-[#edf2f7] pt-3 text-[13px] sm:grid-cols-2">
                    <div>
                      <dt className="text-[#64748b]">품종 그룹</dt>
                      <dd className="mt-1 break-words text-[#334155]">{row.breedGroup ?? "등록된 그룹 없음"}</dd>
                    </div>
                    <div>
                      <dt className="text-[#64748b]">품종</dt>
                      <dd className="mt-1 break-words text-[#334155]">
                        {row.breedNames.length > 0 ? row.breedNames.join(", ") : "등록된 품종 없음"}
                      </dd>
                    </div>
                  </dl>

                  {row.note ? <p className="mt-3 whitespace-pre-wrap text-[13px] leading-5 text-[#526174]">{row.note}</p> : null}
                  {rowReviews.length > 0 ? (
                    <p className={`mt-3 inline-flex rounded-[6px] border px-2 py-1 text-[12px] font-medium ${
                      rowNeedsReview ? "border-[#ead7b3] bg-[#fffaf0] text-[#8a641f]" : "border-[#cfe3d7] bg-[#f5fbf7] text-[#26724b]"
                    }`}>
                      {rowNeedsReview ? `AI 확인 필요 ${rowReviews.length}건` : `AI 확인 완료 ${rowReviews.length}건`}
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="rounded-[10px] border border-[#dbe2ea] bg-white px-4 py-3 text-[13px] text-[#64748b]">저장된 요금 항목이 없습니다.</p>
        )}
      </section>

      <section aria-labelledby="saved-price-guide-surcharges-title" className="rounded-[10px] border border-[#dbe2ea] bg-white p-4">
        <h3 id="saved-price-guide-surcharges-title" className="text-[16px] font-semibold text-[#111827]">추가요금과 전체 안내</h3>
        {document.surcharges.length > 0 ? (
          <ul className="mt-3 divide-y divide-[#edf2f7]">
            {document.surcharges.map((surcharge, index) => {
              const charge = [
                surcharge.amountKrw === null ? "" : formatKrw(surcharge.amountKrw),
                surcharge.percent === null ? "" : `${surcharge.percent}%`,
              ].filter(Boolean).join(" · ");
              return (
                <li key={`saved-price-guide-surcharge-${index}`} className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-4">
                  <div>
                    <p className="text-[14px] font-medium text-[#334155]">{surcharge.condition ?? "조건 확인 필요"}</p>
                    {surcharge.note ? <p className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-5 text-[#64748b]">{surcharge.note}</p> : null}
                  </div>
                  <p className="text-[14px] font-medium text-[#111827]">{charge || "금액 확인 필요"}</p>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-[13px] text-[#64748b]">저장된 추가요금이 없습니다.</p>
        )}
        {document.overallNote ? (
          <div className="mt-4 border-t border-[#edf2f7] pt-4">
            <p className="text-[13px] text-[#64748b]">요금표 전체 안내</p>
            <p className="mt-1 whitespace-pre-wrap break-words text-[14px] leading-6 text-[#334155]">{document.overallNote}</p>
          </div>
        ) : null}
      </section>

      {document.aiReview.length > 0 ? (
        <section aria-labelledby="saved-price-guide-review-title" className="rounded-[10px] border border-[#dbe2ea] bg-white p-4">
          <h3 id="saved-price-guide-review-title" className="text-[16px] font-semibold text-[#111827]">AI 확인 기록</h3>
          <ul className="mt-3 space-y-2">
            {document.aiReview.map((review, index) => (
              <li key={`${review.targetId}-${review.field}-${index}`} className="rounded-[8px] border border-[#edf2f7] bg-[#fbfcfd] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex rounded-[6px] border px-2 py-1 text-[12px] font-medium ${reviewStatusClass(review)}`}>
                    {formatReviewStatus(review)}
                  </span>
                  <span className="text-[13px] font-medium text-[#334155]">
                    {reviewTargetLabel(document, review)} · {reviewFieldLabels[review.field] ?? "기타 항목"}
                  </span>
                  <span className="text-[12px] text-[#64748b]">AI 확신 {review.confidence === "low" ? "낮음" : "보통"}</span>
                </div>
                {review.rawText ? <p className="mt-2 whitespace-pre-wrap break-words text-[13px] leading-5 text-[#64748b]">사진 원문: {review.rawText}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
