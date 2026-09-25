import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

import {
  PETMANAGER_BRAND_LOGO_PATH,
  PETMANAGER_SERVICE_DESCRIPTION,
  PETMANAGER_SERVICE_NAME,
} from "@/lib/brand";

export const metadata: Metadata = {
  title: "반려동물 미용샵 운영을 한곳에서",
  description: PETMANAGER_SERVICE_DESCRIPTION,
};

const featureCards = [
  {
    label: "예약 관리",
    title: "전화·DM으로 받은 예약도 한눈에",
    description: "영업시간과 담당 직원을 기준으로 예약을 정리하고, 겹치는 시간을 줄여요.",
  },
  {
    label: "고객 관리",
    title: "보호자와 반려동물 기록을 이어서",
    description: "방문 기록, 메모, 미용 이력을 매장 운영에 필요한 만큼만 남겨요.",
  },
  {
    label: "요금표",
    title: "사진이나 직접 입력으로 빠르게",
    description: "기본 서비스 하나만 먼저 등록한 뒤 매장 상황에 맞춰 상세 요금표를 보완할 수 있어요.",
  },
  {
    label: "케어 리포트",
    title: "방문 후 안내까지 한 흐름으로",
    description: "미용 내용을 정리해 보호자에게 전달하고 다음 방문으로 연결해요.",
  },
  {
    label: "알림과 링크",
    title: "예약 안내를 매번 다시 쓰지 않도록",
    description: "매장 전용 예약 링크와 안내 흐름을 만들어 보호자가 필요한 정보를 먼저 확인하게 해요.",
  },
  {
    label: "매장 설정",
    title: "우리 매장 방식에 맞춰 시작",
    description: "영업시간, 담당 직원, 서비스와 요금표를 매장 상황에 맞게 차근차근 설정할 수 있어요.",
  },
];

const workflowSteps = [
  ["01", "예약을 받기", "전화나 DM으로 받은 예약도 날짜, 시간, 담당 직원 기준으로 한곳에 기록해요."],
  ["02", "방문을 준비하기", "보호자와 반려동물의 지난 기록을 확인하고 오늘 필요한 메모를 이어서 봐요."],
  ["03", "다음 방문으로 연결하기", "미용 내용을 정리한 케어 리포트를 보내고 다음 예약을 자연스럽게 안내해요."],
];

const faqs = [
  ["처음부터 모든 기능을 설정해야 하나요?", "아니요. 기본 정보와 서비스 하나만 먼저 등록해도 시작할 수 있어요. 필요한 기능은 운영하면서 추가하면 됩니다."],
  ["기존에 관리하던 고객 정보도 옮길 수 있나요?", "현재 사용 중인 고객·반려동물 정보의 형태를 확인한 뒤 이전 방법을 안내해 드려요."],
  ["보호자는 별도 앱을 설치해야 하나요?", "예약 링크와 안내 페이지는 모바일 브라우저에서 열 수 있어 보호자가 앱을 새로 설치하지 않아도 됩니다."],
];

export default function MobileIntroPage() {
  return (
    <main className="min-h-screen bg-[#f4f5f7] text-[#101828]">
      <div className="mx-auto min-h-screen w-full max-w-[430px] overflow-hidden bg-white shadow-[0_0_36px_rgba(15,23,42,0.06)]">
        <header className="flex min-h-16 items-center justify-between border-b border-[#edf0f4] px-5">
          <Link href={"/m/intro" as never} aria-label={`${PETMANAGER_SERVICE_NAME} 소개`} className="inline-flex min-h-11 items-center">
            <Image src={PETMANAGER_BRAND_LOGO_PATH} alt={PETMANAGER_SERVICE_NAME} width={143} height={24} className="h-6 w-auto" priority />
          </Link>
          <Link href="/login?next=%2Fowner%2Fmobile" className="inline-flex min-h-11 items-center rounded-[9px] px-2 text-[14px] font-medium text-[#526b84]">
            로그인
          </Link>
        </header>

        <section className="px-5 pb-8 pt-10">
          <span className="inline-flex min-h-7 items-center rounded-full bg-[#eaf2ff] px-3 text-[12px] font-medium leading-[18px] text-[#2f6fd8]">
            반려동물 미용샵 운영 도구
          </span>
          <h1 className="mt-4 text-[28px] font-semibold leading-[1.35] tracking-[-0.03em] text-[#101828]">
            예약부터 고객 관리까지,
            <br />
            매장 운영을 가볍게
          </h1>
          <p className="mt-4 text-[16px] leading-7 text-[#526b84]">
            {PETMANAGER_SERVICE_NAME}는 반려동물 미용샵의 예약, 고객, 요금표, 방문 기록을 한곳에서 정리하는 서비스예요.
          </p>
          <div className="mt-6 grid gap-2">
            <Link href="/signup?next=%2Fowner%2Fmobile" className="inline-flex min-h-12 items-center justify-center rounded-[10px] bg-[#2f6fd8] px-5 text-[16px] font-medium text-white shadow-[0_8px_18px_rgba(47,111,216,0.2)]">
              무료로 시작하기
            </Link>
            <Link href="#features" className="inline-flex min-h-11 items-center justify-center rounded-[10px] border border-[#dce4ef] bg-white px-5 text-[14px] font-medium text-[#334155]">
              어떤 기능이 있나요?
            </Link>
          </div>
          <div className="mt-7 grid grid-cols-3 divide-x divide-[#e8edf3] rounded-[12px] border border-[#e8edf3] bg-[#fbfcfe] py-3">
            {[["예약", "한눈에"], ["기록", "이어지게"], ["안내", "빠르게"]].map(([value, label]) => (
              <div key={value} className="text-center">
                <p className="text-[15px] font-semibold leading-5 text-[#172033]">{value}</p>
                <p className="mt-1 text-[12px] leading-[18px] text-[#71849b]">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="px-5 pb-10" aria-label="서비스 화면 예시">
          <div className="rounded-[18px] border border-[#dce4ef] bg-[#f8fbff] p-4 shadow-[0_12px_26px_rgba(32,76,128,0.08)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] font-medium leading-[18px] text-[#6a7f98]">오늘의 예약</p>
                <p className="mt-1 text-[20px] font-semibold leading-7 text-[#172033]">화요일, 9월 22일</p>
              </div>
              <span className="inline-flex h-9 items-center rounded-full bg-white px-3 text-[13px] font-medium text-[#2f6fd8]">예약 4건</span>
            </div>
            <div className="mt-4 space-y-2">
              {[
                ["10:00", "초코 · 전체 미용", "담당 이담당"],
                ["13:30", "보리 · 목욕", "담당 박보호"],
                ["16:00", "콩이 · 위생 미용", "담당 이담당"],
              ].map(([time, name, staff]) => (
                <div key={`${time}-${name}`} className="flex min-h-14 items-center gap-3 rounded-[12px] border border-[#e3ebf5] bg-white px-3">
                  <span className="w-12 shrink-0 text-[14px] font-medium tabular-nums text-[#2f6fd8]">{time}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium leading-5 text-[#172033]">{name}</span>
                    <span className="block truncate text-[12px] leading-[18px] text-[#71849b]">{staff}</span>
                  </span>
                  <span className="h-2 w-2 shrink-0 rounded-full bg-[#72a4f2]" aria-hidden="true" />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-[#edf0f4] px-5 py-10" aria-labelledby="screen-title">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[13px] font-medium leading-5 text-[#2f6fd8]">실제 운영 화면</p>
              <h2 id="screen-title" className="mt-2 text-[22px] font-semibold leading-8 tracking-[-0.02em] text-[#172033]">필요한 정보가 한눈에 보여요</h2>
            </div>
            <span className="shrink-0 text-[12px] text-[#71849b]">스크롤해서 확인</span>
          </div>
          <div className="-mx-5 mt-5 flex snap-x gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="w-[218px] shrink-0 snap-start rounded-[16px] border border-[#dce4ef] bg-[#f7faff] p-3">
              <div className="rounded-[10px] bg-white p-3 shadow-[0_4px_12px_rgba(32,76,128,0.06)]">
                <div className="flex items-center justify-between"><span className="text-[11px] font-medium text-[#71849b]">오늘의 예약</span><span className="rounded-full bg-[#eef5ff] px-2 py-1 text-[10px] text-[#2f6fd8]">4건</span></div>
                <div className="mt-3 space-y-2">{[["10:00", "초코", "전체 미용"], ["13:30", "보리", "목욕"], ["16:00", "콩이", "위생 미용"]].map(([time, pet, service]) => <div key={time} className="flex items-center gap-2 rounded-[8px] bg-[#f8fafc] px-2 py-2"><span className="text-[10px] font-medium text-[#2f6fd8]">{time}</span><span className="min-w-0 flex-1 truncate text-[11px] text-[#334155]">{pet} · {service}</span><i className="h-1.5 w-1.5 rounded-full bg-[#72a4f2]" /></div>)}</div>
              </div>
              <p className="mt-3 text-[13px] font-medium text-[#172033]">예약 관리</p>
              <p className="mt-1 text-[12px] leading-5 text-[#71849b]">시간과 담당 직원을 한 번에</p>
            </div>
            <div className="w-[218px] shrink-0 snap-start rounded-[16px] border border-[#e6e3dc] bg-[#fcfaf6] p-3">
              <div className="rounded-[10px] bg-white p-3 shadow-[0_4px_12px_rgba(128,92,32,0.05)]">
                <div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#e9f0e8] text-[11px] font-medium text-[#37705c]">초</span><div><p className="text-[11px] font-medium text-[#334155]">초코 · 말티즈</p><p className="text-[10px] text-[#71849b]">최근 방문 9월 18일</p></div></div>
                <div className="mt-3 rounded-[8px] border border-[#edf0f4] p-2"><p className="text-[10px] text-[#71849b]">지난 메모</p><p className="mt-1 text-[11px] leading-4 text-[#334155]">발바닥 보습 케어 진행</p></div>
                <div className="mt-2 flex gap-1"><span className="h-8 flex-1 rounded-[6px] bg-[#f3f6fa]" /><span className="h-8 flex-1 rounded-[6px] bg-[#f3f6fa]" /></div>
              </div>
              <p className="mt-3 text-[13px] font-medium text-[#172033]">고객 기록</p>
              <p className="mt-1 text-[12px] leading-5 text-[#71849b]">지난 방문 내용을 바로 이어서</p>
            </div>
            <div className="w-[218px] shrink-0 snap-start rounded-[16px] border border-[#e2e5ed] bg-[#f8f8fb] p-3">
              <div className="rounded-[10px] bg-white p-3 shadow-[0_4px_12px_rgba(32,40,80,0.06)]">
                <div className="flex items-center justify-between"><span className="text-[11px] font-medium text-[#334155]">케어 리포트</span><span className="text-[10px] text-[#37705c]">작성 중</span></div>
                <div className="mt-3 h-16 rounded-[8px] bg-[#eef2f6]" />
                <div className="mt-2 space-y-1.5"><span className="block h-2 w-4/5 rounded-full bg-[#e7ebf0]" /><span className="block h-2 w-3/5 rounded-full bg-[#e7ebf0]" /><span className="block h-2 w-2/5 rounded-full bg-[#e7ebf0]" /></div>
              </div>
              <p className="mt-3 text-[13px] font-medium text-[#172033]">케어 리포트</p>
              <p className="mt-1 text-[12px] leading-5 text-[#71849b]">방문 후 안내까지 한 흐름으로</p>
            </div>
          </div>
        </section>

        <section className="bg-[#f8fafc] px-5 py-10" aria-labelledby="why-title">
          <p className="text-[13px] font-medium leading-5 text-[#2f6fd8]">이런 순간에 필요해요</p>
          <h2 id="why-title" className="mt-2 text-[22px] font-semibold leading-8 tracking-[-0.02em] text-[#172033]">바쁜 날에도 중요한 기록을 놓치지 않도록</h2>
          <div className="mt-5 space-y-2">
            {[
              ["예약이 여러 채널로 들어올 때", "전화, DM, 현장 예약을 같은 기준으로 정리해요."],
              ["다음 방문 때 지난 내용을 찾을 때", "보호자와 반려동물 기록을 한 화면에서 이어서 봐요."],
              ["미용 후 설명을 매번 작성할 때", "자주 쓰는 안내와 실제 미용 내용을 함께 전달해요."],
            ].map(([title, description]) => (
              <div key={title} className="rounded-[12px] border border-[#e4eaf2] bg-white px-4 py-3">
                <p className="text-[15px] font-medium leading-6 text-[#172033]">{title}</p>
                <p className="mt-1 text-[13px] leading-5 text-[#66778d]">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="features" className="border-t border-[#edf0f4] px-5 py-10">
          <p className="text-[13px] font-medium leading-5 text-[#2f6fd8]">매장 운영에 필요한 흐름</p>
          <h2 className="mt-2 text-[22px] font-semibold leading-8 tracking-[-0.02em] text-[#172033]">복잡한 일을 한 화면씩 정리해요</h2>
          <div className="mt-5 space-y-3">
            {featureCards.map((feature) => (
              <article key={feature.label} className="rounded-[14px] border border-[#dce4ef] bg-white p-4">
                <p className="text-[12px] font-medium leading-[18px] text-[#2f6fd8]">{feature.label}</p>
                <h3 className="mt-1 text-[17px] font-medium leading-6 text-[#172033]">{feature.title}</h3>
                <p className="mt-2 text-[14px] leading-6 text-[#607080]">{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-t border-[#edf0f4] px-5 py-10" aria-labelledby="workflow-title">
          <p className="text-[13px] font-medium leading-5 text-[#2f6fd8]">하루 운영 흐름</p>
          <h2 id="workflow-title" className="mt-2 text-[22px] font-semibold leading-8 tracking-[-0.02em] text-[#172033]">기록이 쌓일수록 다음 일이 쉬워져요</h2>
          <div className="mt-6 space-y-0">
            {workflowSteps.map(([number, title, description], index) => (
              <div key={number} className="relative flex gap-3 pb-6 last:pb-0">
                {index < workflowSteps.length - 1 ? <span className="absolute left-[15px] top-8 h-[calc(100%-16px)] w-px bg-[#dce4ef]" aria-hidden="true" /> : null}
                <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#172033] text-[11px] font-medium text-white">{number}</span>
                <div className="pt-1">
                  <h3 className="text-[16px] font-medium leading-6 text-[#172033]">{title}</h3>
                  <p className="mt-1 text-[14px] leading-6 text-[#66778d]">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-[#f8fafc] px-5 py-10" aria-labelledby="customer-title">
          <p className="text-[13px] font-medium leading-5 text-[#2f6fd8]">보호자에게 보이는 경험</p>
          <h2 id="customer-title" className="mt-2 text-[22px] font-semibold leading-8 tracking-[-0.02em] text-[#172033]">매장에 연락하기 전, 필요한 정보를 먼저</h2>
          <div className="mt-5 rounded-[14px] border border-[#e1e8f0] bg-white p-4">
            <div className="flex items-center justify-between border-b border-[#edf0f4] pb-3">
              <div>
                <p className="text-[12px] text-[#71849b]">몽샵멍샵 예약 안내</p>
                <p className="mt-1 text-[17px] font-medium text-[#172033]">원하는 시간에 편하게 예약하세요</p>
              </div>
              <span className="rounded-full bg-[#eef5ff] px-2.5 py-1 text-[11px] font-medium text-[#2f6fd8]">모바일</span>
            </div>
            <div className="grid grid-cols-3 gap-2 py-3 text-center text-[12px] text-[#607080]">
              {["서비스 확인", "가능 시간", "예약 완료"].map((item, index) => <div key={item} className="rounded-[8px] bg-[#f8fafc] py-2"><span className="block text-[11px] text-[#2f6fd8]">0{index + 1}</span>{item}</div>)}
            </div>
            <p className="text-[13px] leading-5 text-[#66778d]">서비스와 가능 시간을 확인한 뒤 보호자가 직접 요청할 수 있어 전화로 같은 내용을 반복해서 설명하는 일이 줄어들어요.</p>
          </div>
        </section>

        <section className="border-t border-[#edf0f4] px-5 py-10" aria-labelledby="faq-title">
          <p className="text-[13px] font-medium leading-5 text-[#2f6fd8]">자주 묻는 내용</p>
          <h2 id="faq-title" className="mt-2 text-[22px] font-semibold leading-8 tracking-[-0.02em] text-[#172033]">시작하기 전에 확인해 보세요</h2>
          <div className="mt-4 divide-y divide-[#e8edf3] border-y border-[#e8edf3]">
            {faqs.map(([question, answer]) => (
              <details key={question} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-medium leading-6 text-[#172033] [&::-webkit-details-marker]:hidden">{question}<span className="text-[20px] font-normal text-[#71849b] group-open:rotate-45">+</span></summary>
                <p className="mt-2 pr-5 text-[14px] leading-6 text-[#66778d]">{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="px-5 pb-12 pt-2">
          <div className="rounded-[16px] bg-[#172033] px-5 py-6 text-white">
            <h2 className="text-[20px] font-semibold leading-7">오늘부터 매장 운영을 정리해 보세요</h2>
            <p className="mt-2 text-[14px] leading-6 text-[#c7d2e2]">기본 설정을 마치면 예약 링크를 바로 만들 수 있어요.</p>
            <Link href="/signup?next=%2Fowner%2Fmobile" className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-[9px] bg-white px-4 text-[15px] font-medium text-[#172033]">
              무료로 시작하기
            </Link>
          </div>
        </section>

        <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[#edf0f4] px-5 py-5 text-[12px] leading-5 text-[#71849b]">
          <Link href="/privacy">개인정보처리방침</Link>
          <Link href="/terms">이용약관</Link>
          <span>© 넘친 Day</span>
        </footer>
      </div>
    </main>
  );
}
