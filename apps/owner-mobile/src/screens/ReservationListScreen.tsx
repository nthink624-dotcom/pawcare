import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { ownerColors } from "@/components/ownerTheme";
import type { AppointmentRowViewModel } from "@/viewModels/ownerViewModels";

type ReservationListScreenProps = {
  rows: AppointmentRowViewModel[];
  onOpenReservation: (reservationId: string) => void;
};

type QuickDate = {
  key: string;
  weekday: string;
  day: string;
};

export default function ReservationListScreen({ rows, onOpenReservation }: ReservationListScreenProps) {
  const dates = useMemo(() => buildQuickDates(rows), [rows]);
  const [selectedDate, setSelectedDate] = useState(dates[0]?.key ?? getLocalDateKey());
  const selectedRows = rows.filter((row) => row.date === selectedDate);
  const activeReservations = selectedRows.filter((item) => item.section === "pending" || item.section === "active");
  const cancelChangeReservations = selectedRows.filter((item) => item.section === "cancelChange");
  const completedReservations = selectedRows.filter((item) => item.section === "completed");

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>예약조회</Text>
        <Pressable style={styles.addButton}>
          <Text style={styles.addButtonText}>예약추가</Text>
        </Pressable>
      </View>

      <View style={styles.dateCard}>
        <View style={styles.dateCardHeader}>
          <Text style={styles.cardTitle}>날짜선택</Text>
          <View style={styles.calendarButton}>
            <Ionicons name="calendar-outline" size={22} color="#111111" />
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateRow}>
          {dates.map((item) => {
            const active = selectedDate === item.key;

            return (
              <Pressable key={item.key} style={[styles.datePill, active && styles.datePillActive]} onPress={() => setSelectedDate(item.key)}>
                <Text style={[styles.weekday, active && styles.dateActiveText]}>{item.weekday}</Text>
                <Text style={[styles.dayNumber, active && styles.dateActiveText]}>{item.day}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ReservationBlock
        title="예약"
        count={activeReservations.length}
        emptyText="선택한 날짜에 처리할 예약이 없어요"
        rows={activeReservations}
        onOpenReservation={onOpenReservation}
      />
      <ReservationBlock
        title="취소·변경 내역"
        count={cancelChangeReservations.length}
        emptyText="선택한 날짜에 취소·변경 내역이 없어요"
        rows={cancelChangeReservations}
        onOpenReservation={onOpenReservation}
      />
      <ReservationBlock
        title="완료 내역"
        count={completedReservations.length}
        emptyText="선택한 날짜에 완료 내역이 없어요"
        rows={completedReservations}
        onOpenReservation={onOpenReservation}
      />
    </ScrollView>
  );
}

function ReservationBlock({
  title,
  count,
  emptyText,
  rows,
  onOpenReservation,
}: {
  title: string;
  count: number;
  emptyText: string;
  rows: AppointmentRowViewModel[];
  onOpenReservation: (reservationId: string) => void;
}) {
  return (
    <View style={styles.listCard}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.countText}>{count}건</Text>
      </View>
      {rows.length > 0 ? (
        <View style={styles.rows}>
          {rows.map((row) => (
            <Pressable key={row.id} style={styles.row} onPress={() => onOpenReservation(row.id)}>
              <Text style={styles.rowTime}>{row.time}</Text>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>
                  {row.petName} <Text style={styles.rowSubTitle}>{row.customerName}</Text>
                </Text>
                <Text style={styles.rowMeta}>{row.serviceName}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#8d867e" />
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>{emptyText}</Text>
        </View>
      )}
    </View>
  );
}

function buildQuickDates(rows: AppointmentRowViewModel[]): QuickDate[] {
  const rowDates = Array.from(new Set(rows.map((row) => row.date))).sort();
  void rowDates;
  const today = new Date();

  return Array.from({ length: 10 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);

    return {
      key: toDateKey(date),
      weekday: ["일", "월", "화", "수", "목", "금", "토"][date.getDay()],
      day: String(date.getDate()),
    };
  });
}

function getLocalDateKey() {
  return toDateKey(new Date());
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: ownerColors.background,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 34,
    gap: 16,
  },
  header: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ownerColors.border,
    paddingBottom: 16,
  },
  title: {
    color: "#111111",
    fontSize: 24,
    fontWeight: "800",
  },
  addButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    backgroundColor: ownerColors.accent,
    paddingHorizontal: 20,
  },
  addButtonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "800",
  },
  dateCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ownerColors.border,
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
    gap: 14,
  },
  dateCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  cardTitle: {
    color: "#050505",
    fontSize: 17,
    fontWeight: "800",
  },
  calendarButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ownerColors.border,
    backgroundColor: "#ffffff",
  },
  dateRow: {
    gap: 10,
    paddingRight: 6,
  },
  datePill: {
    width: 74,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ownerColors.border,
    backgroundColor: "#ffffff",
  },
  datePillActive: {
    borderColor: ownerColors.accent,
    backgroundColor: ownerColors.accent,
  },
  weekday: {
    color: "#807970",
    fontSize: 12,
    fontWeight: "700",
  },
  dayNumber: {
    marginTop: 6,
    color: "#0b0b0b",
    fontSize: 22,
    fontWeight: "800",
  },
  dateActiveText: {
    color: "#ffffff",
  },
  listCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ownerColors.border,
    backgroundColor: "#ffffff",
    padding: 16,
    gap: 16,
  },
  countText: {
    color: "#8c8278",
    fontSize: 16,
    fontWeight: "500",
  },
  rows: {
    gap: 8,
  },
  row: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ownerColors.border,
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
  },
  rowTime: {
    minWidth: 42,
    color: "#050505",
    fontSize: 15,
    fontWeight: "800",
  },
  rowBody: {
    flex: 1,
    gap: 3,
  },
  rowTitle: {
    color: "#050505",
    fontSize: 15,
    fontWeight: "800",
  },
  rowSubTitle: {
    color: "#716b65",
    fontSize: 13,
    fontWeight: "500",
  },
  rowMeta: {
    color: "#716b65",
    fontSize: 13,
  },
  emptyBox: {
    minHeight: 60,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ownerColors.border,
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
  },
  emptyText: {
    color: "#5e6671",
    fontSize: 16,
    fontWeight: "400",
    textAlign: "center",
  },
});
