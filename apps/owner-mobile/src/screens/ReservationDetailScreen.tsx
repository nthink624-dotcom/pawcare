import { StyleSheet, Text, View } from "react-native";

import { InfoRow, OwnerButton, OwnerCard, OwnerScreen, StatusBadge } from "@/components/OwnerUi";
import { ownerColors } from "@/components/ownerTheme";
import type { AppointmentDetailViewModel } from "@/viewModels/ownerViewModels";

type ReservationDetailScreenProps = {
  reservation: AppointmentDetailViewModel | null;
  isReadOnly?: boolean;
  onBack: () => void;
};

export default function ReservationDetailScreen({ reservation, isReadOnly = false, onBack }: ReservationDetailScreenProps) {
  if (!reservation) {
    return (
      <OwnerScreen title="예약 상세" action={<OwnerButton label="목록" onPress={onBack} variant="ghost" />}>
        <OwnerCard title="예약 없음" description="선택한 예약을 찾을 수 없습니다." />
      </OwnerScreen>
    );
  }

  return (
    <OwnerScreen title="예약 상세" action={<OwnerButton label="목록" onPress={onBack} variant="ghost" />}>
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
        <InfoRow label="예약 일시" value={`${reservation.date} ${reservation.time} - ${reservation.endTime}`} />
        <InfoRow label="서비스" value={`${reservation.serviceName} / ${reservation.servicePriceLabel}`} />
        <InfoRow label="메모" value={reservation.memo || "없음"} />
      </OwnerCard>

      <OwnerCard title="빠른 연락">
        <InfoRow label="보호자 연락처" value={reservation.guardianPhone} />
        <View style={styles.actionGrid}>
          <OwnerButton label="전화하기" variant="secondary" />
          <OwnerButton label="문자 보내기" variant="ghost" />
        </View>
      </OwnerCard>

      <OwnerCard title="예약 취소">
        <OwnerButton label="예약 취소" variant="danger" disabled={isReadOnly} />
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
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
