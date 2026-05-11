import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Chip, EmptyState, OwnerButton, OwnerCard, OwnerScreen, SearchBox, StatusBadge } from "@/components/OwnerUi";
import { ownerColors } from "@/components/ownerTheme";
import type { AppointmentRowViewModel } from "@/viewModels/ownerViewModels";

type ReservationListScreenProps = {
  rows: AppointmentRowViewModel[];
  onOpenReservation: (reservationId: string) => void;
};

export default function ReservationListScreen({ rows, onOpenReservation }: ReservationListScreenProps) {
  const quickDates = buildQuickDates(rows);
  const activeReservations = rows.filter((item) => item.section === "pending" || item.section === "active");
  const completedReservations = rows.filter((item) => item.section === "completed");
  const cancelledReservations = rows.filter((item) => item.section === "cancelChange");

  return (
    <OwnerScreen title="예약조회" subtitle="날짜별 예약을 확인하고 상세 화면으로 이동합니다." action={<OwnerButton label="예약추가" variant="secondary" />}>
      <OwnerCard title="날짜선택">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateRow}>
          {quickDates.length > 0 ? (
            quickDates.map((item, index) => (
              <View key={item.key} style={[styles.datePill, index === 0 && styles.datePillActive]}>
                <Text style={[styles.dateDay, index === 0 && styles.dateActiveText]}>{item.day}</Text>
                <Text style={[styles.dateNumber, index === 0 && styles.dateActiveText]}>{item.date}</Text>
              </View>
            ))
          ) : (
            <View style={styles.emptyDatePill}>
              <Text style={styles.dateDay}>예약 날짜 없음</Text>
            </View>
          )}
        </ScrollView>
        <SearchBox placeholder="보호자명, 반려동물명, 연락처 검색" />
      </OwnerCard>

      <View style={styles.filterRow}>
        {["전체", "승인 대기", "확정", "진행 중", "완료"].map((status, index) => (
          <Chip key={status} label={status} active={index === 0} tone={status === "취소" ? "danger" : "default"} />
        ))}
      </View>

      <OwnerCard title="예약" description="불러온 예약 중 처리할 예약입니다." tone="accent">
        {activeReservations.length > 0 ? (
          activeReservations.map((reservation) => (
            <ReservationCard key={reservation.id} reservation={reservation} onPress={() => onOpenReservation(reservation.id)} />
          ))
        ) : (
          <EmptyState title="표시할 예약이 없어요" />
        )}
      </OwnerCard>

      <OwnerCard title="완료 내역" description="완료된 예약과 미용 기록을 시간순으로 확인합니다." tone="complete">
        {completedReservations.length > 0 ? (
          completedReservations.map((reservation) => (
            <ReservationCard key={reservation.id} reservation={reservation} onPress={() => onOpenReservation(reservation.id)} compact />
          ))
        ) : (
          <EmptyState title="완료 내역이 없어요" />
        )}
      </OwnerCard>

      <OwnerCard title="취소·변경 내역" description="취소 또는 변경된 예약은 이 영역에 모입니다." tone="danger">
        {cancelledReservations.length > 0 ? (
          cancelledReservations.map((reservation) => (
            <ReservationCard key={reservation.id} reservation={reservation} onPress={() => onOpenReservation(reservation.id)} compact />
          ))
        ) : (
          <EmptyState title="취소·변경 내역이 없어요" />
        )}
      </OwnerCard>
    </OwnerScreen>
  );
}

function ReservationCard({ reservation, onPress, compact = false }: { reservation: AppointmentRowViewModel; onPress: () => void; compact?: boolean }) {
  return (
    <Pressable onPress={onPress} style={styles.cardRow}>
      <Text style={styles.time}>{reservation.time}</Text>
      <View style={styles.info}>
        <Text style={styles.petName}>
          {reservation.petName} <Text style={styles.customerName}>{reservation.customerName}</Text>
        </Text>
        <Text style={styles.meta}>
          {reservation.serviceName} · {reservation.serviceDurationMinutes}분
        </Text>
        {!compact ? <Text style={styles.note}>{reservation.memo || reservation.sourceLabel}</Text> : null}
      </View>
      <StatusBadge label={reservation.statusLabel} />
    </Pressable>
  );
}

function buildQuickDates(rows: AppointmentRowViewModel[]) {
  const uniqueDates = Array.from(new Set(rows.map((row) => row.date).filter(Boolean))).sort();

  return uniqueDates.slice(0, 7).map((date) => ({
    key: date,
    day: formatWeekday(date),
    date: formatShortDate(date),
  }));
}

function formatWeekday(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "-";

  return ["일", "월", "화", "수", "목", "금", "토"][parsed.getDay()];
}

function formatShortDate(date: string) {
  const [, month, day] = date.split("-");
  return month && day ? `${Number(month)}/${Number(day)}` : date;
}

const styles = StyleSheet.create({
  dateRow: {
    gap: 8,
    paddingBottom: 2,
  },
  datePill: {
    width: 66,
    alignItems: "center",
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ownerColors.border,
    backgroundColor: ownerColors.surface,
    paddingVertical: 10,
  },
  datePillActive: {
    borderColor: ownerColors.accent,
    backgroundColor: ownerColors.accent,
  },
  emptyDatePill: {
    minWidth: 112,
    alignItems: "center",
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ownerColors.border,
    backgroundColor: ownerColors.surface,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  dateDay: {
    color: ownerColors.faint,
    fontSize: 11,
    fontWeight: "700",
  },
  dateNumber: {
    marginTop: 5,
    color: ownerColors.text,
    fontSize: 19,
    fontWeight: "800",
  },
  dateActiveText: {
    color: "#ffffff",
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ownerColors.border,
    backgroundColor: ownerColors.surface,
    padding: 12,
  },
  time: {
    minWidth: 48,
    color: ownerColors.text,
    fontSize: 17,
    fontWeight: "800",
  },
  info: {
    flex: 1,
    gap: 3,
  },
  petName: {
    color: ownerColors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  customerName: {
    color: ownerColors.faint,
    fontSize: 13,
    fontWeight: "600",
  },
  meta: {
    color: ownerColors.muted,
    fontSize: 12,
  },
  note: {
    color: ownerColors.faint,
    fontSize: 12,
  },
});
