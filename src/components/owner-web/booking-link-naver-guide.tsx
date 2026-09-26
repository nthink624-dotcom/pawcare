import { Copy } from "lucide-react";
import { useState } from "react";
import { OWNER_WEB_SECONDARY_ACTION_BUTTON_CLASS } from "./owner-web-action-button-styles";

type GuideMode = "link" | "directions";

export function BookingLinkNaverGuide({
  bookingUrl,
  directionsText,
  smartPlaceUrl,
  copied,
  onCopy,
}: {
  bookingUrl: string;
  directionsText: string;
  smartPlaceUrl: string;
  copied: boolean;
  onCopy: () => void;
}) {
  const [mode, setMode] = useState<GuideMode>("link");
  const isLink = mode === "link";
  const steps = [
    { title: "스마트플레이스를 엽니다.", detail: "위의 스마트플레이스 열기 버튼을 누르세요. 버튼을 못 찾으면 네이버에서 스마트플레이스를 검색하세요.", image: "search", width: 816, height: 72 },
    { title: "네이버 스마트플레이스를 선택합니다.", detail: "네이버 스마트플레이스에 로그인한 뒤 내 업체를 선택하세요.", image: "result", width: 791, height: 194 },
    { title: "내 업체를 선택합니다.", detail: "예약 링크를 등록할 매장을 선택하세요.", image: "business", width: 1242, height: 263 },
    ...(isLink ? [
      { title: "업체정보 > 부가정보로 이동합니다.", detail: "왼쪽 업체정보 메뉴에서 상단 부가정보 탭을 선택하세요.", image: "info-additional-marked", width: 1003, height: 334 },
      { title: "+ URL 추가를 클릭합니다.", detail: "부가정보 아래의 홈페이지·SNS 영역을 찾으세요.", image: "url-button", width: 671, height: 151 },
      { title: "예약 링크를 입력하고 추가합니다.", detail: "유형에서 홈페이지(웹사이트)를 선택하고, 복사한 예약 링크를 URL 입력칸에 붙여넣은 뒤 추가하기를 누르세요.", image: "url-modal", width: 940, height: 633 },
    ] : [
      { title: "업체정보 > 기본정보로 이동합니다.", detail: "왼쪽 업체정보 메뉴에서 상단 기본정보 탭을 선택하세요.", image: "basic-info-marked", width: 1116, height: 401 },
      { title: "찾아오는 길 설명에 안내 문구를 추가합니다.", detail: "기존 길 안내는 유지하고, 마지막에 복사한 예약 안내 문구를 덧붙이세요.", image: "directions-field", width: 665, height: 274 },
    ]),
    { title: "저장하기를 누릅니다.", detail: "저장 후 플레이스에서 문구와 예약 링크가 표시되는지 확인하세요.", image: "save-button", width: 178, height: 58 },
  ];

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap gap-2 border-b border-[#e8edf3] pb-3" role="group" aria-label="네이버 등록 방법 선택">
        {([ ["link", "예약 링크 등록"], ["directions", "안내 문구 등록"] ] as const).map(([value, label]) => (
          <button key={value} type="button" aria-pressed={mode === value} onClick={() => setMode(value)}
            className={`min-h-11 rounded-[8px] px-4 py-2 text-[16px] font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${mode === value ? "bg-[#111a30] text-white" : "bg-[#f1f3f7] text-[#334155]"}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[20px] font-semibold leading-7">{isLink ? "홈페이지에 예약 링크 연결" : "찾아오는 길에 예약 안내 추가"}</h2>
          {!isLink && <button type="button" onClick={onCopy} className={OWNER_WEB_SECONDARY_ACTION_BUTTON_CLASS}><Copy className="h-4 w-4" />{copied ? "복사됨" : "문구 복사"}</button>}
        </div>
        <p className="mt-2 text-[14px] leading-5 text-[#64748b]">
          {isLink
            ? "예약 링크를 복사한 뒤 스마트플레이스를 열고, 내 업체의 홈페이지·SNS에 붙여넣으면 됩니다."
            : "찾아오는 길 설명에는 고객이 예약 페이지를 찾을 수 있도록 안내 문구를 덧붙일 수 있습니다."}
        </p>
        {isLink && (
          <div className="mt-3 rounded-[10px] border border-[#e8edf3] bg-[#f8fafc] px-3 py-3 text-[14px] leading-5 text-[#334155]">
            <p className="font-medium text-[#111827]">가장 쉬운 등록 순서</p>
            <ol className="mt-2 space-y-1.5">
              <li><span className="mr-1.5 text-[#64748b]">1.</span>위의 <span className="font-medium text-[#111827]">예약 링크 복사</span>를 누릅니다.</li>
              <li><span className="mr-1.5 text-[#64748b]">2.</span><span className="font-medium text-[#111827]">스마트플레이스 열기</span>를 누르고 내 업체를 선택합니다.</li>
              <li><span className="mr-1.5 text-[#64748b]">3.</span><span className="font-medium text-[#111827]">업체정보 → 부가정보 → 홈페이지·SNS</span>에서 URL을 추가하고 저장합니다.</li>
            </ol>
            <a href={smartPlaceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 items-center rounded-[8px] border border-[#cbd5e1] bg-white px-3 text-[14px] font-medium text-[#334155] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
              스마트플레이스 다시 열기 ↗
            </a>
          </div>
        )}
      </div>
      <ol className="space-y-5">
        {steps.map((step, index) => (
          <li key={step.image} className="min-w-0 border-t border-[#e8edf3] pt-4 first:border-t-0 first:pt-0">
            <div className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f1f3f7] text-[14px] font-medium">{index + 1}</span>
              <div className="min-w-0">
                <h3 className="text-[16px] font-medium leading-6">{step.title}</h3>
                <p className="mt-1 text-[14px] leading-5 text-[#64748b]">{step.detail}</p>
              </div>
            </div>
            <div className="mt-3 min-w-0">
              <a
                href={`/images/naver-smartplace-guide-${step.image}.png`}
                target="_blank"
                rel="noreferrer"
                aria-label={`${step.title} 캡처 원본 보기 (새 탭)`}
                className="block w-fit max-w-full rounded-[8px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                {/* Preserve screenshot pixels; never stretch beyond the source dimensions. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/images/naver-smartplace-guide-${step.image}.png`}
                  alt={`${step.title} 네이버 화면 캡처`}
                  width={step.width}
                  height={step.height}
                  loading="lazy"
                  className="block h-auto max-w-full rounded-[8px] border border-[#e8edf3]"
                  style={{ width: step.width }}
                />
              </a>
              <a href={`/images/naver-smartplace-guide-${step.image}.png`} target="_blank" rel="noreferrer"
                className="inline-flex min-h-11 items-center rounded-[6px] px-1 text-[14px] text-[#334155] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-blue-600"
                aria-label={`${step.title} 원본 보기 (새 탭)`}>원본 보기 ↗</a>
              {step.image === "url-modal" && <p className="mt-1 break-all rounded-[8px] bg-[#f8fafc] p-3 text-[16px] leading-6">{bookingUrl}</p>}
              {step.image === "directions-field" && <p className="mt-1 rounded-[8px] bg-[#f8fafc] p-3 text-[16px] leading-6">{directionsText}</p>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
