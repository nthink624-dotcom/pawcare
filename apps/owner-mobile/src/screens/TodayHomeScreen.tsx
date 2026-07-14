import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { ownerColors, ownerShadow } from "@/components/ownerTheme";
import type { AppointmentRowViewModel, TodayHomeViewModel } from "@/viewModels/ownerViewModels";

type TodayHomeScreenProps = {
  viewModel: TodayHomeViewModel;
  todayDate?: string;
  getViewModelForDate?: (date: string) => TodayHomeViewModel;
  onOpenReservations: () => void;
};

type SummaryTone = "active" | "complete" | "cancel";
type SectionTone = "active" | "complete";

export default function TodayHomeScreen({
  viewModel,
  todayDate = getLocalDateKey(),
  getViewModelForDate,
  onOpenReservations,
}: TodayHomeScreenProps) {
  const [reservationDate, setReservationDate] = useState(todayDate);
  const panelViewModel = getViewModelForDate ? getViewModelForDate(reservationDate) : viewModel;
  const reservationCount =
    panelViewModel.activeReservations.length +
    panelViewModel.completedReservations.length +
    panelViewModel.cancelChangeReservations.length;
  const isToday = reservationDate === todayDate;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Pressable style={styles.shopButton} onPress={() => setReservationDate(todayDate)}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getShopInitial(viewModel.shop.name)}</Text>
          </View>
          <View style={styles.shopText}>
            <Text style={styles.shopName} numberOfLines={1}>
              {viewModel.shop.name}
            </Text>
            <Text style={styles.shopMeta} numberOfLines={1}>
              오늘 예약 현황
            </Text>
          </View>
          <Ionicons name="chevron-down" size={17} color={ownerColors.muted} />
        </Pressable>

        <Pressable style={styles.copyButton} onPress={onOpenReservations}>
          <Ionicons name="copy-outline" size={17} color={ownerColors.accent} />
          <Text style={styles.copyText}>예약 링크 복사</Text>
        </Pressable>
      </View>

      <View style={styles.dashboard}>
        <View style={styles.dateBar}>
          <Pressable style={styles.dateArrow} onPress={() => setReservationDate(addDays(reservationDate, -1))}>
            <Ionicons name="chevron-back" size={20} color={ownerColors.muted} />
          </Pressable>
          <Pressable style={styles.dateCenter} onPress={() => setReservationDate(todayDate)}>
            <Text style={styles.dateEyebrow}>{isToday ? "오늘" : "선택 날짜"}</Text>
            <Text style={styles.dateLabel}>{formatDateLabel(reservationDate)}</Text>
          </Pressable>
          <Pressable style={styles.dateArrow} onPress={() => setReservationDate(addDays(reservationDate, 1))}>
            <Ionicons name="chevron-forward" size={20} color={ownerColors.text} />
          </Pressable>
        </View>

        <View style={styles.summaryBar}>
          <SummaryCard label="예약" value={panelViewModel.stats.active} tone="active" />
          <View style={styles.summaryDivider} />
          <SummaryCard label="완료" value={panelViewModel.stats.completed} tone="complete" />
          <View style={styles.summaryDivider} />
          <SummaryCard label="취소·변경" value={panelViewModel.stats.cancelChange} tone="cancel" />
        </View>

        <View style={styles.managementHeader}>
          <View>
            <Text style={styles.managementTitle}>예약관리</Text>
            <Text style={styles.managementDescription}>선택한 날짜에 바로 처리할 예약을 확인하세요</Text>
          </View>
          <Text style={styles.managementCount}>{reservationCount}건</Text>
        </View>

        <View style={styles.sectionStack}>
          <ReservationSection
            title="예약 현황"
            tone="active"
            rows={panelViewModel.activeReservations}
            emptyText="지금 바로 처리할 예약이 없어요"
          />
          <ReservationSection
            title="완료 내역"
            tone="complete"
            rows={panelViewModel.completedReservations}
            emptyText="오늘 완료 내역이 없어요"
          />
        </View>
      </View>
    </ScrollView>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: SummaryTone;
}) {
  return (
    <View style={styles.summaryItem}>
      <View style={[styles.summaryDot, summaryAccentStyle[tone]]} />
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}건</Text>
    </View>
  );
}

function ReservationSection({
  title,
  helper,
  tone,
  rows,
  emptyText,
}: {
  title: string;
  helper?: string;
  tone: SectionTone;
  rows: AppointmentRowViewModel[];
  emptyText: string;
}) {
  return (
    <View style={[styles.section, sectionToneStyle[tone]]}>
      <View style={styles.sectionHeader}>
        <View style={styles.titleRow}>
          <View style={[styles.sectionDot, sectionDotStyle[tone]]} />
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        {helper ? <Text style={styles.sectionHelper}>{helper}</Text> : <Text style={styles.sectionCount}>{rows.length}건</Text>}
      </View>

      {rows.length > 0 ? (
        <View style={styles.reservationList}>
          {rows.map((row) => (
            <View key={row.id} style={styles.reservationRow}>
              <View style={styles.timeColumn}>
                <Text style={styles.reservationTime}>{row.time}</Text>
              </View>
              <View style={styles.rowDivider} />
              <View style={styles.reservationBody}>
                <Text style={styles.reservationName} numberOfLines={1}>
                  {row.petName} <Text style={styles.guardianName}>{row.customerName}</Text>
                </Text>
                <Text style={styles.reservationMeta} numberOfLines={1}>
                  {row.serviceName}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.emptyBox}>
          <Ionicons name="calendar-clear-outline" size={22} color={ownerColors.faint} />
          <Text style={styles.emptyText}>{emptyText}</Text>
        </View>
      )}
    </View>
  );
}

function getLocalDateKey() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDays(dateKey: string, amount: number) {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + amount);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDateLabel(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00`);
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];

  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${dayNames[date.getDay()]}요일`;
}

function getShopInitial(name: string) {
  return name.trim().slice(0, 1) || "샵";
}

const summaryAccentStyle = StyleSheet.create({
  active: { backgroundColor: ownerColors.accent },
  complete: { backgroundColor: "#8ea0b8" },
  cancel: { backgroundColor: "#b8616d" },
});

const sectionToneStyle = StyleSheet.create({
  active: {
    borderColor: "transparent",
    backgroundColor: "transparent",
  },
  complete: {
    borderColor: "transparent",
    backgroundColor: "transparent",
  },
});

const sectionDotStyle = StyleSheet.create({
  active: { backgroundColor: ownerColors.accent },
  complete: { backgroundColor: "#8ea0b8" },
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: ownerColors.background,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 112,
    gap: 12,
  },
  header: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  shopButton: {
    minWidth: 0,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 45,
    height: 45,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 23,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#d5e8de",
    backgroundColor: "#eff9f4",
  },
  avatarText: {
    color: ownerColors.accent,
    fontSize: 14,
    fontWeight: "800",
  },
  shopText: {
    minWidth: 0,
    flex: 1,
    gap: 2,
  },
  shopName: {
    color: ownerColors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  shopMeta: {
    color: ownerColors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  copyButton: {
    minHeight: 43,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#d8e7e0",
    backgroundColor: "#ffffff",
    paddingHorizontal: 13,
    ...ownerShadow,
    shadowOpacity: 0.04,
    elevation: 1,
  },
  copyText: {
    color: ownerColors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  dashboard: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ownerColors.border,
    backgroundColor: "#ffffff",
    padding: 14,
    gap: 16,
    ...ownerShadow,
    shadowOpacity: 0.055,
    elevation: 2,
  },
  dateBar: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 17,
    backgroundColor: "#f8f6f2",
    padding: 6,
  },
  dateArrow: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: "#ffffff",
  },
  dateCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  dateEyebrow: {
    color: ownerColors.accent,
    fontSize: 12,
    fontWeight: "800",
  },
  dateLabel: {
    color: ownerColors.text,
    fontSize: 17,
    fontWeight: "900",
  },
  summaryBar: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "stretch",
    borderRadius: 17,
    backgroundColor: "#faf8f4",
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  summaryDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  summaryDivider: {
    width: StyleSheet.hairlineWidth,
    marginVertical: 5,
    backgroundColor: "#e7dfd4",
  },
  summaryLabel: {
    color: ownerColors.muted,
    fontSize: 12,
    fontWeight: "800",
  },
  summaryValue: {
    color: ownerColors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  managementHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 2,
  },
  managementTitle: {
    color: ownerColors.text,
    fontSize: 20,
    fontWeight: "900",
  },
  managementDescription: {
    marginTop: 4,
    color: ownerColors.muted,
    fontSize: 13,
    fontWeight: "600",
  },
  managementCount: {
    color: ownerColors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  sectionStack: {
    gap: 0,
    overflow: "hidden",
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ownerColors.border,
    backgroundColor: "#ffffff",
  },
  section: {
    borderWidth: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ownerColors.border,
    borderRadius: 0,
    paddingHorizontal: 14,
    paddingVertical: 15,
    gap: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  titleRow: {
    minWidth: 0,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionTitle: {
    color: ownerColors.text,
    fontSize: 17,
    fontWeight: "900",
  },
  sectionHelper: {
    color: "#b47a63",
    fontSize: 12,
    fontWeight: "800",
  },
  sectionCount: {
    color: ownerColors.muted,
    fontSize: 13,
    fontWeight: "800",
  },
  approvalToggle: {
    minHeight: 50,
    flexDirection: "row",
    overflow: "hidden",
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#ead8cd",
    backgroundColor: "#ffffff",
    padding: 4,
  },
  approvalOption: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  approvalOptionActive: {
    backgroundColor: "#c98d6f",
  },
  approvalOptionText: {
    color: ownerColors.muted,
    fontSize: 15,
    fontWeight: "800",
  },
  approvalOptionActiveText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },
  reservationList: {
    gap: 8,
  },
  reservationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ownerColors.border,
    backgroundColor: "#ffffff",
    padding: 12,
  },
  timeColumn: {
    minWidth: 58,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  rowDivider: {
    width: StyleSheet.hairlineWidth,
    height: 40,
    backgroundColor: ownerColors.border,
  },
  reservationTime: {
    color: ownerColors.text,
    fontSize: 14,
    fontWeight: "900",
  },
  reservationBody: {
    minWidth: 0,
    flex: 1,
    gap: 3,
  },
  reservationName: {
    color: ownerColors.text,
    fontSize: 15,
    fontWeight: "900",
  },
  guardianName: {
    color: ownerColors.muted,
    fontSize: 14,
    fontWeight: "700",
  },
  reservationMeta: {
    color: ownerColors.muted,
    fontSize: 14,
    fontWeight: "600",
  },
  emptyBox: {
    minHeight: 92,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ownerColors.border,
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
  },
  emptyText: {
    color: ownerColors.text,
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
});
