import { Pressable, StyleSheet, Text, View } from "react-native";

import { EmptyState, OwnerButton, OwnerCard, OwnerScreen, StatusBadge } from "@/components/OwnerUi";
import { ownerColors } from "@/components/ownerTheme";
import type { AppointmentRowViewModel, TodayHomeViewModel } from "@/viewModels/ownerViewModels";

type TodayHomeScreenProps = {
  viewModel: TodayHomeViewModel;
  onOpenReservations: () => void;
};

export default function TodayHomeScreen({ viewModel, onOpenReservations }: TodayHomeScreenProps) {
  return (
    <OwnerScreen
      title={viewModel.shop.name}
      subtitle="홈"
      action={<OwnerButton label="예약 링크 복사" onPress={onOpenReservations} variant="ghost" />}
    >
      <View style={styles.statsGrid}>
        <StatCard label="승인 대기" value={`${viewModel.stats.pending}건`} tone="warning" />
        <StatCard label="예약 현황" value={`${viewModel.stats.active}건`} tone="accent" />
        <StatCard label="완료 내역" value={`${viewModel.stats.completed}건`} tone="complete" />
        <StatCard label="취소·변경" value={`${viewModel.stats.cancelChange}건`} tone="danger" />
      </View>

      <OwnerCard title="예약관리" description="오늘 처리할 예약을 상태별로 빠르게 확인합니다." tone="accent">
        <SectionHeader title="승인 대기" count={viewModel.pendingReservations.length} />
        {viewModel.pendingReservations.length > 0 ? (
          viewModel.pendingReservations.map((reservation) => <HomeReservationRow key={reservation.id} reservation={reservation} />)
        ) : (
          <EmptyState title="승인 대기 예약이 없어요" />
        )}

        <SectionHeader title="예약 현황" count={viewModel.activeReservations.length} />
        {viewModel.activeReservations.length > 0 ? (
          viewModel.activeReservations.map((reservation) => <HomeReservationRow key={reservation.id} reservation={reservation} />)
        ) : (
          <EmptyState title="진행 중인 예약이 없어요" />
        )}

        <SectionHeader title="완료 내역" count={viewModel.completedReservations.length} />
        {viewModel.completedReservations.length > 0 ? (
          viewModel.completedReservations.map((reservation) => <HomeReservationRow key={reservation.id} reservation={reservation} />)
        ) : (
          <EmptyState title="오늘 완료 내역이 없어요" />
        )}
      </OwnerCard>

      <Pressable onPress={onOpenReservations}>
        <OwnerCard title="예약조회로 이동" description="날짜선택, 완료 내역, 취소·변경 내역은 예약조회 탭에서 이어서 확인합니다." />
      </Pressable>
    </OwnerScreen>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone: "accent" | "warning" | "danger" | "complete" }) {
  return (
    <View style={[styles.statCard, tone === "accent" && styles.statAccent, tone === "warning" && styles.statWarning, tone === "danger" && styles.statDanger, tone === "complete" && styles.statComplete]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionCount}>{count}건</Text>
    </View>
  );
}

function HomeReservationRow({ reservation }: { reservation: AppointmentRowViewModel }) {
  return (
    <View style={styles.reservationRow}>
      <View style={styles.reservationSchedule}>
        <Text style={styles.reservationDate}>{formatReservationDate(reservation.date)}</Text>
        <Text style={styles.reservationTime}>{reservation.time}</Text>
      </View>
      <View style={styles.reservationBody}>
        <Text style={styles.reservationTitle}>
          {reservation.petName} <Text style={styles.reservationCustomer}>{reservation.customerName}</Text>
        </Text>
        <Text style={styles.reservationMeta}>
          {reservation.serviceName} · {reservation.serviceDurationMinutes}분
        </Text>
      </View>
      <StatusBadge label={reservation.statusLabel} />
    </View>
  );
}

function formatReservationDate(date: string) {
  const [, month, day] = date.split("-");
  return `${Number(month)}월 ${Number(day)}일`;
}

const styles = StyleSheet.create({
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statCard: {
    width: "48.5%",
    minHeight: 82,
    justifyContent: "space-between",
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
  },
  statAccent: {
    borderColor: "#d8e7e0",
    backgroundColor: "#f6fbf8",
  },
  statWarning: {
    borderColor: "#ead9cf",
    backgroundColor: "#fff3ea",
  },
  statDanger: {
    borderColor: "#ead6cc",
    backgroundColor: "#fbefea",
  },
  statComplete: {
    borderColor: "#e9ddd3",
    backgroundColor: "#fbf8f4",
  },
  statLabel: {
    color: ownerColors.muted,
    fontSize: 13,
    fontWeight: "700",
  },
  statValue: {
    color: ownerColors.text,
    fontSize: 22,
    fontWeight: "900",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 2,
  },
  sectionTitle: {
    color: ownerColors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  sectionCount: {
    color: ownerColors.faint,
    fontSize: 12,
    fontWeight: "700",
  },
  reservationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ownerColors.border,
    backgroundColor: ownerColors.surface,
    padding: 12,
  },
  reservationSchedule: {
    minWidth: 62,
    gap: 3,
  },
  reservationDate: {
    color: ownerColors.faint,
    fontSize: 11,
    fontWeight: "700",
  },
  reservationTime: {
    color: ownerColors.text,
    fontSize: 17,
    fontWeight: "800",
  },
  reservationBody: {
    flex: 1,
    gap: 3,
  },
  reservationTitle: {
    color: ownerColors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  reservationCustomer: {
    color: ownerColors.faint,
    fontSize: 13,
    fontWeight: "600",
  },
  reservationMeta: {
    color: ownerColors.faint,
    fontSize: 12,
  },
});
