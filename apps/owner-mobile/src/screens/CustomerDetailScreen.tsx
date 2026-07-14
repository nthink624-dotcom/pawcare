import { useState } from "react";

import {
  DetailFieldCard,
  DetailHeader,
  DetailInfoRow,
  DetailListCard,
  DetailShell,
  DetailTabBar,
  DetailTabBlock,
  DetailTabPanel,
  GroomingRecordRow,
  NotificationHistoryRow,
  NotificationSettingsCard,
  PetProfileRow,
  type CustomerDetailTab,
} from "@/components/CustomerDetailUi";
import { EmptyState, OwnerButton, OwnerCard, OwnerScreen } from "@/components/OwnerUi";
import type { CustomerDetailViewModel } from "@/viewModels/ownerViewModels";

type CustomerDetailScreenProps = {
  customer: CustomerDetailViewModel | null;
  onBack: () => void;
};

const customerNotificationItems = [
  { label: "예약 확정", description: "예약이 최종 확정되었을 때 보내는 알림이에요." },
  { label: "예약 거절", description: "예약을 받을 수 없을 때 고객에게 사유를 안내해요." },
  { label: "예약 취소", description: "확정된 예약이 취소되면 바로 알려드려요." },
  { label: "예약 변경 확정", description: "변경된 일정이 확정되면 새 방문 시간을 알려드려요." },
  { label: "방문 10분 전", description: "예약 시간이 가까워졌을 때 미리 안내해요." },
  { label: "미용 시작", description: "매장에서 미용을 시작했을 때 바로 알려드려요." },
  { label: "픽업 준비", description: "미용이 거의 끝나 픽업 준비가 되었을 때 안내해요." },
  { label: "미용 완료", description: "미용이 끝나 고객이 데리러 오실 수 있을 때 보내요." },
];

export default function CustomerDetailScreen({ customer, onBack }: CustomerDetailScreenProps) {
  const [activeTab, setActiveTab] = useState<CustomerDetailTab>("records");

  if (!customer) {
    return (
      <OwnerScreen title="고객 상세" hideHeader>
        <DetailHeader onBack={onBack} />
        <OwnerCard title="고객 없음" description="선택한 고객 정보를 찾을 수 없습니다." />
      </OwnerScreen>
    );
  }

  const notificationsActive = !customer.alertLabel.includes("꺼짐");

  return (
    <OwnerScreen title="고객 상세" hideHeader>
      <DetailHeader onBack={onBack} />
      <DetailShell>
        <DetailFieldCard title="기본 정보">
          <DetailInfoRow label="보호자 이름" value={`${customer.name} 보호자`} />
          <DetailInfoRow label="연락처" value={customer.phone} />
          <DetailInfoRow label="반려동물" value={customer.petNames.join(", ") || "등록된 반려동물 없음"} />
          <DetailInfoRow label="고객 메모" value={customer.memo || "메모를 추가해 주세요"} muted={!customer.memo} multiline />
        </DetailFieldCard>

        <NotificationSettingsCard active={notificationsActive} items={customerNotificationItems} />

        <DetailTabBlock>
          <DetailTabBar activeTab={activeTab} onChange={setActiveTab} />
          {activeTab === "records" ? <GroomingRecordsPanel customer={customer} /> : null}
          {activeTab === "pets" ? <PetsPanel customer={customer} /> : null}
          {activeTab === "notifications" ? <NotificationsPanel customer={customer} /> : null}
        </DetailTabBlock>
      </DetailShell>
    </OwnerScreen>
  );
}

function GroomingRecordsPanel({ customer }: { customer: CustomerDetailViewModel }) {
  return (
    <DetailListCard>
      {customer.groomingRecords.length === 0 ? (
        <EmptyState title="미용 기록이 없어요" />
      ) : (
        customer.groomingRecords.map((record) => (
          <GroomingRecordRow
            key={record.id}
            petName={record.petName}
            date={record.groomedAt}
            serviceName={record.serviceName}
            pricePaidLabel={record.pricePaidLabel}
            memo={record.memo || record.styleNotes || "상세 메모 없음"}
          />
        ))
      )}
    </DetailListCard>
  );
}

function PetsPanel({ customer }: { customer: CustomerDetailViewModel }) {
  return (
    <DetailTabPanel>
      {customer.pets.map((pet) => (
        <PetProfileRow
          key={pet.id}
          name={pet.name}
          summary={[pet.breed, pet.birthday ? `생일 ${pet.birthday}` : null].filter(Boolean).join(" · ")}
        />
      ))}
      <OwnerButton label="아기 추가하기" variant="secondary" />
    </DetailTabPanel>
  );
}

function NotificationsPanel({ customer }: { customer: CustomerDetailViewModel }) {
  return (
    <DetailListCard>
      {customer.notifications.length === 0 ? (
        <EmptyState title="발송된 알림톡이 없어요" />
      ) : (
        customer.notifications.map((notification) => (
          <NotificationHistoryRow
            key={notification.id}
            channel={notification.channel}
            createdAt={notification.createdAt}
            message={notification.message}
          />
        ))
      )}
    </DetailListCard>
  );
}
