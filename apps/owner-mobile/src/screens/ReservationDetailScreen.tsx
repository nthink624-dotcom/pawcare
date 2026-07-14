import { StyleSheet, Text, View } from "react-native";

import { OwnerButton, OwnerCard, OwnerScreen } from "@/components/OwnerUi";
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
      <View style={styles.detailCard}>
        <View style={styles.detailHeader}>
          <Text style={styles.detailTitle}>
            {reservation.petName} · {reservation.customerName}
          </Text>
          {!isReadOnly ? <Text style={styles.editScheduleText}>예약 일정 수정</Text> : null}
        </View>

        <View style={styles.infoList}>
          <AppointmentInfoRow label="예약 일시" value={`${reservation.date} ${reservation.time}`} />
          <AppointmentInfoRow label="서비스" value={`${reservation.serviceName} · ${reservation.servicePriceLabel}`} />
          <AppointmentInfoRow label="메모" value={reservation.memo || "메모 없음"} muted={!reservation.memo} />
        </View>

        {reservation.rejectionReason ? (
          <View style={styles.rejectionBox}>
            <Text style={styles.rejectionText}>취소 사유: {reservation.rejectionReason}</Text>
          </View>
        ) : null}
      </View>

      <OwnerCard title="빠른 연락">
        <View style={styles.quickContactGrid}>
          <View style={styles.quickContactButton}>
            <Text style={styles.quickContactText}>전화하기</Text>
          </View>
          <View style={styles.quickContactButton}>
            <Text style={styles.quickContactText}>문자 보내기</Text>
          </View>
        </View>
      </OwnerCard>

      <View style={styles.cancelCard}>
        <View style={styles.cancelTextBlock}>
          <Text style={styles.cancelTitle}>예약 취소</Text>
          <Text style={styles.cancelDescription}>취소 전에 취소·변경 내역에서 확인할 수 있어요.</Text>
        </View>
        <OwnerButton label="예약 취소" variant="ghost" disabled={isReadOnly} />
      </View>
    </OwnerScreen>
  );
}

function AppointmentInfoRow({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, muted && styles.infoValueMuted]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  detailCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e1e7ef",
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  detailTitle: {
    flex: 1,
    color: ownerColors.text,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "500",
  },
  editScheduleText: {
    color: ownerColors.accent,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "500",
  },
  infoList: {
    gap: 10,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  infoLabel: {
    width: 72,
    color: ownerColors.muted,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "500",
  },
  infoValue: {
    flex: 1,
    color: ownerColors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  infoValueMuted: {
    color: ownerColors.faint,
  },
  rejectionBox: {
    borderRadius: 14,
    backgroundColor: "#fff6f4",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  rejectionText: {
    color: "#b25d52",
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "500",
  },
  quickContactGrid: {
    flexDirection: "row",
    gap: 8,
  },
  quickContactButton: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e1e7ef",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  quickContactText: {
    color: ownerColors.text,
    fontSize: 14,
    fontWeight: "500",
  },
  cancelCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e1e7ef",
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cancelTextBlock: {
    flex: 1,
    gap: 4,
  },
  cancelTitle: {
    color: ownerColors.text,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "500",
  },
  cancelDescription: {
    color: ownerColors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
});
