import { Copy, ExternalLink } from "lucide-react";
import { useState } from "react";
import { OWNER_WEB_SECONDARY_ACTION_BUTTON_CLASS } from "./owner-web-action-button-styles";

type GuideMode = "link" | "directions" | "price";
type GuideStep = { title: string; detail: string; image?: string; width?: number; height?: number };
const actionClass = `${OWNER_WEB_SECONDARY_ACTION_BUTTON_CLASS} !text-[16px]`;
export const NAVER_PRICE_NOTICE_EXAMPLES = [
  "당일 취소 및 노쇼",
  "다음 예약 어렵습니다",
  "신중한 예약 부탁드립니다! 🙏",
  "아래 파란색 예약 URL 꾹!",
] as const;
const priceNote = NAVER_PRICE_NOTICE_EXAMPLES.join("\n");

export function BookingLinkNaverGuide({ bookingUrl, directionsText, smartPlaceUrl, copied, onCopy }: {
  bookingUrl: string;
  directionsText: string;
  smartPlaceUrl: string;
  copied: boolean;
  onCopy: () => void;
}) {
  const [mode, setMode] = useState<GuideMode>("link");
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  const [copyError, setCopyError] = useState(false);
  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedValue(value);
      setCopyError(false);
      window.setTimeout(() => setCopiedValue(null), 1600);
    } catch {
      setCopyError(true);
    }
  }
  const start: GuideStep[] = [
    { title: "스마트플레이스를 여세요.", detail: "이 안내 위의 ‘스마트플레이스 열기’를 누르세요. 네이버 로그인 화면이 나오면 내 업체를 관리하는 아이디로 로그인하세요." },
    { title: "내 매장을 선택하세요.", detail: "‘내 업체’를 누르고, 예약 링크를 등록할 매장 이름을 누르세요. 다른 매장을 선택하지 않았는지 확인하세요." },
    { title: "왼쪽 ‘업체정보’를 누르세요.", detail: "아래 캡처의 파란 테두리로 표시한 메뉴를 누르세요.", image: "live-company-menu", width: 304, height: 546 },
  ];
  const steps: GuideStep[] = [...start, ...(mode === "link" ? [
    { title: "위쪽 ‘부가정보’를 누르세요.", detail: "기본정보 옆에 있는 부가정보를 선택하세요.", image: "live-additional-tab", width: 736, height: 118 },
    { title: "아래로 내려가 ‘URL 추가’를 누르세요.", detail: "‘운영중인 홈페이지, SNS, 커뮤니티 등이 있나요?’라는 항목을 찾으세요. 그 아래의 ‘+ URL 추가’를 누르세요.", image: "live-url-add", width: 549, height: 79 },
    { title: "‘예약’을 선택하고 예약 주소를 붙여넣으세요.", detail: "이 안내 위의 ‘예약 링크 복사’를 누르세요. 네이버 창으로 돌아가 분류에서 ‘예약’을 선택한 뒤, URL 입력칸의 https://를 지우고 복사한 주소 전체를 붙여넣으세요. Windows에서는 Ctrl+V를 누르면 됩니다.", image: "live-url-form", width: 545, height: 560 },
    { title: "‘추가하기’를 누르세요.", detail: "입력한 주소가 내 매장 예약 주소와 같은지 확인하고, 창 아래의 초록색 ‘추가하기’를 누르세요. 아직 페이지 저장이 끝난 것은 아닙니다." },
  ] : mode === "directions" ? [
    { title: "위쪽 ‘기본정보’를 누르세요.", detail: "부가정보 왼쪽에 있는 기본정보를 선택하세요.", image: "live-basic-tab", width: 736, height: 118 },
    { title: "아래로 내려가 ‘찾아오는 길’을 찾으세요.", detail: "아래처럼 길 안내를 쓰는 큰 입력칸을 찾으세요. 기존 길 안내는 지우지 마세요.", image: "live-directions", width: 647, height: 202 },
    { title: "길 안내 마지막에 예약 문구를 붙여넣으세요.", detail: "이 안내 위의 ‘문구 복사’를 누르세요. 네이버 입력칸의 기존 글 마지막을 클릭하고 Enter를 누른 뒤 Ctrl+V로 붙여넣으세요. 홈페이지에 예약 링크를 먼저 등록해야 고객이 찾을 수 있습니다." },
  ] : [
    { title: "위쪽 ‘가격정보’를 누르세요.", detail: "부가정보 옆에 있는 가격정보를 선택하세요. 업종에 따라 메뉴 이름이나 입력칸이 다를 수 있습니다.", image: "live-price-tab", width: 736, height: 118 },
    { title: "‘+ 가격 추가’를 누르세요.", detail: "예약 안내 문구를 넣을 새 항목을 만드세요. 기존 미용 가격은 그대로 두세요.", image: "live-price-add", width: 549, height: 79 },
    { title: "상품명에 안내 문구를 한 줄씩 넣으세요.", detail: "위 예시에서 한 줄을 복사해 상품명에 붙여넣으세요. 예시는 미리보기처럼 ‘무료’로 표시하는 구성입니다. 내 매장의 취소·노쇼 정책에 맞게 문구를 바꾸세요.", image: "live-price-form", width: 545, height: 806 },
    { title: "‘추가하기’를 누르고 나머지 줄도 등록하세요.", detail: "입력한 문구를 확인하고 초록색 ‘추가하기’를 누르세요. 같은 방법으로 안내 문구를 한 줄씩 추가하면 미리보기처럼 위에서부터 차례대로 보입니다." },
  ]),
    { title: "페이지 아래의 ‘저장하기’를 누르세요.", detail: "입력 창을 닫은 뒤 페이지 아래로 내려가 초록색 ‘저장하기’를 누르세요. 저장 완료 안내가 나올 때까지 기다리세요.", image: "live-save", width: 718, height: 89 },
    { title: "네이버에서 내 매장을 검색해 확인하세요.", detail: "고객이 보는 플레이스에서 홈페이지의 예약 링크를 눌러보세요. 내 매장 이름이 표시된 예약 화면이 열리면 됩니다. 안내 문구도 원하는 위치에 보이는지 확인하세요." },
  ];

  return (
    <div className="min-w-0 text-[16px] leading-6">
      <section className="mb-4 border-b border-[#e8edf3] pb-4">
        <h2 className="text-[20px] font-semibold leading-7">네이버에 예약 링크 올리기</h2>
        <p className="mt-2 text-[#64748b]">먼저 예약 링크를 등록하세요. 안내 문구와 가격표 안내는 필요한 경우 추가하면 됩니다.</p>
        <p className="mt-2 text-[#64748b]">실제 네이버 PC 화면을 캡처했습니다. 파란 테두리가 누를 곳입니다. 캡처를 누르면 크게 볼 수 있습니다.</p>
      </section>
      <div className="flex flex-wrap gap-2 border-b border-[#e8edf3] pb-3" role="group" aria-label="네이버 등록 방법 선택">
        {([["link", "1. 예약 링크"], ["directions", "2. 안내 문구"], ["price", "3. 가격표 안내"]] as const).map(([value, label]) => (
          <button key={value} type="button" aria-pressed={mode === value} onClick={() => { setMode(value); setCopyError(false); }} className={`h-10 rounded-[8px] px-4 text-[16px] font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${mode === value ? "bg-[#1875f0] text-white" : "bg-[#f1f3f7] text-[#334155]"}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 py-4">
        <a href={smartPlaceUrl} target="_blank" rel="noreferrer" className={actionClass}><ExternalLink className="h-4 w-4" />스마트플레이스 열기</a>
        {mode === "link" ? <button type="button" onClick={() => void copyText(bookingUrl)} className={actionClass}><Copy className="h-4 w-4" />{copiedValue === bookingUrl ? "복사됨" : "예약 링크 복사"}</button> : mode === "directions" ? <button type="button" onClick={onCopy} className={actionClass}><Copy className="h-4 w-4" />{copied ? "복사됨" : "문구 복사"}</button> : <button type="button" onClick={() => void copyText(priceNote)} className={actionClass}><Copy className="h-4 w-4" />{copiedValue === priceNote ? "복사됨" : "상품명 예시 복사"}</button>}
      </div>
      <p className="mb-4 whitespace-pre-line break-all rounded-[8px] bg-[#f8fafc] p-3">{mode === "link" ? bookingUrl : mode === "directions" ? directionsText : priceNote}</p>
      {mode === "price" && <p className="mb-4 text-[#64748b]">휴대폰 미리보기는 가격표 항목을 예약 안내 문구로 활용한 예시입니다.</p>}
      {copyError && <p role="alert" className="mb-4">복사하지 못했습니다. 위 글을 선택한 뒤 Ctrl+C로 직접 복사해주세요.</p>}
      <p role="status" className="sr-only">{copiedValue ? "복사했습니다." : ""}</p>
      <ol className="space-y-5">
        {steps.map((step, index) => (
          <li key={`${mode}-${index}`} className="min-w-0 border-t border-[#e8edf3] pt-4 first:border-t-0 first:pt-0">
            <div className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f1f3f7] font-medium">{index + 1}</span>
              <div className="min-w-0">
                <h3 className="font-medium">{step.title}</h3>
                <p className="mt-1 text-[#64748b]">{step.detail}</p>
              </div>
            </div>
            {step.image && <a href={`/images/naver-smartplace-guide-${step.image}.png`} target="_blank" rel="noreferrer" aria-label={`${step.title} 캡처 크게 보기 (새 탭)`} className="mt-3 block w-fit max-w-full rounded-[8px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/images/naver-smartplace-guide-${step.image}.png`} alt={`${step.title} 실제 네이버 화면, 파란 테두리가 클릭 위치`} width={step.width} height={step.height} loading="lazy" className="block h-auto max-w-full rounded-[8px] border border-[#e8edf3]" style={{ width: step.width }} />
            </a>}
          </li>
        ))}
      </ol>
    </div>
  );
}
