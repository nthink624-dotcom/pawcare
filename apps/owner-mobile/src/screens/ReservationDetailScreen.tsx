import { StyleSheet, Text, View } from "react-native";

import { InfoRow, OwnerButton, OwnerCard, OwnerScreen, StatusBadge } from "@/components/OwnerUi";
import { ownerColors } from "@/components/ownerTheme";
import type { AppointmentDetailViewModel } from "@/viewModels/ownerViewModels";

type ReservationDetailScreenProps = {
  reservation: AppointmentDetailViewModel | null;
  onBack: () => void;
};

export default function ReservationDetailScreen({ reservation, onBack }: ReservationDetailScreenProps) {
  if (!reservation) {
    return (
      <OwnerScreen title="예약 상세" subtitle="예약 정보를 찾을 수 없습니다." action={<OwnerButton label="목록" onPress={onBack} variant="ghost" />}>
        <OwnerCard title="예약 없음" description="선택한 예약이 mock 데이터에 없습니다." />
      </OwnerScreen>
    );
  }

  return (
    <OwnerScreen title="예약 상세" subtitle={`${reservation.customerName} · ${reservation.petName}`} action={<OwnerButton label="목록" onPress={onBack} variant="ghost" />}>
      <OwnerCard tone="accent">
        <View style={styles.heroRow}>
          <View>
            <Text style={styles.time}>{reservation.time}</Text>
            <Text style={styles.title}>
              {reservation.petName} <Text style={styles.customer}>{reservation.customerName}</Text>
            </Text>
          </View>
          <StatusBadge label={reservation.statusLabel} />
        </View>
        <Text style={styles.meta}>
          {reservation.serviceName} · {reservation.serviceDurationMinutes}분 · {reservation.sourceLabel}
        </Text>
      </OwnerCard>

      <OwnerCard title="예약 정보">
        <InfoRow label="예약 상태" value={reservation.statusLabel} />
        <InfoRow label="예약 일시" value={`${reservation.date} ${reservation.time} - ${reservation.endTime}`} />
        <InfoRow label="서비스" value={`${reservation.serviceName} / ${reservation.servicePriceLabel}`} />
        <InfoRow label="담당" value={reservation.staffLabel} />
        <InfoRow label="접수 채널" value={reservation.sourceLabel} />
      </OwnerCard>

      <OwnerCard title="연락처" description="예약 변경, 픽업 준비, 완료 알림을 바로 보낼 수 있어요.">
        <InfoRow label="보호자 연락처" value={reservation.guardianPhone} />
        <View style={styles.actionGrid}>
          <OwnerButton label="전화하기" variant="secondary" />
          <OwnerButton label="문자 보내기" variant="ghost" />
        </View>
      </OwnerCard>

      <OwnerCard title="메모">
        <Text style={styles.memo}>{reservation.memo || "없음"}</Text>
      </OwnerCard>

      <OwnerCard title="반려동물 정보">
        <InfoRow label="품종" value={reservation.petBreed} />
        <InfoRow label="주의 메모" value={reservation.petNotes} />
      </OwnerCard>

      <OwnerCard title="빠른 상태 변경">
        <View style={styles.actionGrid}>
          <OwnerButton label="시작" variant="secondary" />
          <OwnerButton label="픽업 준비" variant="ghost" />
          <OwnerButton label="미용 완료" variant="secondary" />
          <OwnerButton label="예약 취소" variant="danger" />
        </View>
      </OwnerCard>
    </OwnerScreen>
  );
}

const styles = StyleSheet.create({
  heroRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  time: {
    color: ownerColors.text,
    fontSize: 26,
    fontWeight: "900",
  },
  title: {
    marginTop: 6,
    color: ownerColors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  customer: {
    color: ownerColors.faint,
    fontSize: 15,
    fontWeight: "600",
  },
  meta: {
    color: ownerColors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  memo: {
    color: ownerColors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
