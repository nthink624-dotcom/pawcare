import { decodeUnicodeEscapes } from "@/lib/utils";
import type { Service, Shop } from "@/types/domain";
import LegalLinksFooter from "@/components/legal/legal-links-footer";

export default function LandingPage({ shop, services }: { shop: Shop; services: Service[] }) {
  const shopName = decodeUnicodeEscapes(shop.name);

  return (
    <div className="mx-auto min-h-screen w-full max-w-[430px] bg-[#faf7f2] text-[#1f1a17]">
      <section className="px-5 pb-10 pt-8">
        <div className="rounded-[32px] bg-[#1f1a17] px-5 pb-8 pt-7 text-white">
          <span className="inline-flex rounded-full border border-[#d9896f]/35 bg-[#d9896f]/15 px-3 py-1 text-[11px] font-semibold tracking-[0.08em] text-[#f1b19f]">
            1인 미용실 운영 관리
          </span>
          <h1 className="mt-5 text-[31px] font-extrabold leading-[1.24] tracking-[-0.04em]">
            예약부터 고객 관리까지
            <br />
            사장님용 PawCare
          </h1>
          <p className="mt-4 text-[14px] leading-6 text-white/72">
            전화, 카카오, 네이버 예약을 한 화면에서 정리하고
            <br />
            재방문 관리와 완료 안내까지 한 번에 운영할 수 있어요.
          </p>
          <div className="mt-6 space-y-2.5">
            <a
              href="/owner"
              className="flex h-[52px] items-center justify-center rounded-[16px] bg-[#d9896f] text-[15px] font-semibold text-white"
            >
              오너 화면 보기
            </a>
            <a
              href={`/entry/${shop.id}`}
              className="flex h-[52px] items-center justify-center rounded-[16px] border border-white/18 bg-white/8 text-[15px] font-semibold text-white"
            >
              소비자 예약 화면 보기
            </a>
          </div>
        </div>

        <section className="mt-5 space-y-3">
          <LandingCard
            title="이럴 때 필요해요"
            items={[
              "예약 요청이 여러 채널로 흩어져서 확인이 늦어질 때",
              "재방문 주기와 고객 메모를 따로 챙기기 어려울 때",
              "미용 시작과 완료 안내를 손으로 직접 보내고 있을 때",
            ]}
          />
          <LandingCard
            title="PawCare로 바뀌는 점"
            items={[
              "예약 승인과 일정 확인을 한 화면에서 바로 처리",
              "고객, 반려견, 방문 기록을 함께 관리",
              "휴무일과 상태 변경 흐름을 매장 운영에 맞게 정리",
            ]}
          />
          <LandingCard
            title="지금 바로 볼 수 있는 화면"
            items={[
              "오너 앱에서 오늘 예약과 승인 대기 확인",
              "소비자 예약 페이지에서 첫 방문, 재방문, 예약 조회 제공",
              `데모 매장명은 ${shopName}으로 연결되어 있어요.`,
              `현재 노출 서비스는 ${services.filter((service) => service.is_active).length}개입니다.`,
            ]}
          />
        </section>
      </section>
      <div className="px-5 pb-10">
        <LegalLinksFooter />
      </div>
    </div>
  );
}

function LandingCard({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-[24px] border border-[#e7e0d5] bg-white px-5 py-5 shadow-[0_6px_18px_rgba(31,26,23,0.04)]">
      <h2 className="text-[18px] font-bold tracking-[-0.03em] text-[#1f1a17]">{title}</h2>
      <div className="mt-3 space-y-2.5">
        {items.map((item) => (
          <div key={item} className="rounded-[18px] border border-[#efe9df] bg-[#fcfaf6] px-4 py-3 text-[14px] leading-6 text-[#5f5852]">
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}

