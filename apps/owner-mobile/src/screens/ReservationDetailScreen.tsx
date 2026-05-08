import { StyleSheet, Text, View } from "react-native";

import { InfoRow, OwnerButton, OwnerCard, OwnerScreen, StatusBadge } from "@/components/OwnerUi";
import { ownerColors } from "@/components/ownerTheme";
import type { OwnerReservation } from "@/screens/ownerPlaceholderData";

type ReservationDetailScreenProps = {
  reservation: OwnerReservation;
  onBack: () => void;
};

export default function ReservationDetailScreen({ reservation, onBack }: ReservationDetailScreenProps) {
  return (
    <OwnerScreen title="예약 상세" subtitle={`${reservation.customer} · ${reservation.pet}`} action={<OwnerButton label="목록" onPress={onBack} variant="ghost" />}>
      <OwnerCard tone="accent">
        <View style={styles.heroRow}>
          <View>
            <Text style={styles.time}>{reservation.time}</Text>
            <Text style={styles.title}>
              {reservation.pet} <Text style={styles.customer}>{reservation.customer}</Text>
            </Text>
          </View>
          <StatusBadge label={reservation.status} />
        </View>
        <Text style={styles.meta}>
          {reservation.service} · {reservation.staff} 담당 · {reservation.channel}
        </Text>
      </OwnerCard>

      <OwnerCard title="예약 정보">
        <InfoRow label="예약 상태" value={reservation.status} />
        <InfoRow label="서비스" value={reservation.service} />
        <InfoRow label="담당" value={reservation.staff} />
        <InfoRow label="접수 채널" value={reservation.channel} />
      </OwnerCard>

      <OwnerCard title="연락처" description="예약 변경, 픽업 준비, 완료 알림을 바로 보낼 수 있어요.">
        <InfoRow label="보호자 연락처" value={reservation.phone} />
        <View style={styles.actionGrid}>
          <OwnerButton label="전화하기" variant="secondary" />
          <OwnerButton label="문자 보내기" variant="ghost" />
        </View>
      </OwnerCard>

      <OwnerCard title="메모">
        <Text style={styles.memo}>{reservation.note || "없음"}</Text>
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
