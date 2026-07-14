import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { OwnerFieldCard } from "@/components/OwnerUi";
import { ownerColors } from "@/components/ownerTheme";

export type CustomerDetailTab = "records" | "pets" | "notifications";

type NotificationTemplate = {
  label: string;
  description: string;
};

export function DetailHeader({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.detailHeader}>
      <Pressable onPress={onBack} style={styles.backButton} accessibilityLabel="고객관리로 돌아가기">
        <Ionicons name="chevron-back" size={22} color={ownerColors.text} />
      </Pressable>
      <Text style={styles.detailHeaderTitle}>고객 상세</Text>
    </View>
  );
}

export function DetailShell({ children }: { children: ReactNode }) {
  return (
    <View style={styles.detailShell}>
      <View style={styles.detailStack}>{children}</View>
    </View>
  );
}

export function DetailFieldCard({ title, flush = false, children }: { title: string; flush?: boolean; children: ReactNode }) {
  return (
    <OwnerFieldCard label={title} flush={flush}>
      <View style={flush ? styles.flushBody : styles.fieldCardBody}>{children}</View>
    </OwnerFieldCard>
  );
}

export function DetailInfoRow({
  label,
  value,
  muted = false,
  multiline = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
  multiline?: boolean;
}) {
  return (
    <View style={[styles.infoRow, multiline && styles.infoRowMultiline]}>
      <View style={styles.infoValueWrap}>
        <View style={styles.infoTextBlock}>
          <Text style={[styles.infoValue, multiline && styles.infoValueMultiline, muted && styles.infoValueMuted]} numberOfLines={multiline ? 3 : 1}>
            {value}
          </Text>
          <Text style={styles.infoLabel}>{label}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={ownerColors.faint} />
      </View>
    </View>
  );
}

export function NotificationSettingsCard({
  active,
  items,
}: {
  active: boolean;
  items: NotificationTemplate[];
}) {
  return (
    <DetailFieldCard title="개인 알림톡" flush>
      <View style={styles.notificationHeader}>
        <View style={styles.profileBody}>
          <Text style={styles.notificationTitle}>알림톡 전체 수신</Text>
          <Text style={styles.meta}>이 고객에게 가는 예약·미용 알림을 한 번에 켜거나 끌 수 있어요.</Text>
        </View>
        <View style={[styles.readOnlySwitch, !active && styles.readOnlySwitchOff]}>
          <View style={[styles.switchThumb, !active && styles.switchThumbOff]} />
        </View>
      </View>
      <View style={styles.notificationList}>
        {items.map((item) => (
          <View key={item.label} style={[styles.notificationItem, active && styles.notificationItemActive]}>
            <View style={styles.notificationItemBody}>
              <Text style={styles.notificationItemLabel}>{item.label}</Text>
              <Text style={styles.notificationItemDescription}>{item.description}</Text>
            </View>
            <View style={[styles.notificationPill, active && styles.notificationPillActive]}>
              <Text style={[styles.notificationPillText, active && styles.notificationPillTextActive]}>{active ? "ON" : "OFF"}</Text>
            </View>
          </View>
        ))}
      </View>
    </DetailFieldCard>
  );
}

export function DetailTabBar({
  activeTab,
  onChange,
}: {
  activeTab: CustomerDetailTab;
  onChange: (tab: CustomerDetailTab) => void;
}) {
  const tabs: Array<{ key: CustomerDetailTab; label: string }> = [
    { key: "records", label: "미용 기록" },
    { key: "pets", label: "반려동물" },
    { key: "notifications", label: "알림 내역" },
  ];

  return (
    <View style={styles.tabRow}>
      {tabs.map((tab) => (
        <Pressable key={tab.key} onPress={() => onChange(tab.key)} style={[styles.tabButton, activeTab === tab.key && styles.tabButtonActive]}>
          <Text style={[styles.tabButtonText, activeTab === tab.key && styles.tabButtonTextActive]}>{tab.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function DetailListCard({ children }: { children: ReactNode }) {
  return <View style={styles.listCard}>{children}</View>;
}

export function DetailTabPanel({ children }: { children: ReactNode }) {
  return <View style={styles.tabPanel}>{children}</View>;
}

export function DetailTabBlock({ children }: { children: ReactNode }) {
  return <View style={styles.tabBlock}>{children}</View>;
}

export function GroomingRecordRow({
  petName,
  date,
  serviceName,
  pricePaidLabel,
  memo,
}: {
  petName: string;
  date: string;
  serviceName: string;
  pricePaidLabel: string;
  memo: string;
}) {
  return (
    <View style={styles.historyRow}>
      <View style={styles.recordBody}>
        <View style={styles.inlineTitleRow}>
          <Text style={styles.petName}>{petName}</Text>
          <Text style={styles.recordDate}>{date}</Text>
        </View>
        <Text style={styles.meta}>
          {serviceName} · {pricePaidLabel}
        </Text>
        <Text style={styles.recordMemo}>{memo || "상세 메모 없음"}</Text>
      </View>
      <Text style={styles.editText}>수정</Text>
    </View>
  );
}

export function PetProfileRow({ name, summary }: { name: string; summary: string }) {
  return (
    <View style={styles.petRow}>
      <View style={styles.recordBody}>
        <View style={styles.inlineTitleRow}>
          <Text style={styles.petName}>{name}</Text>
        </View>
        <Text style={styles.meta}>{summary}</Text>
      </View>
      <Text style={styles.editText}>수정</Text>
    </View>
  );
}

export function NotificationHistoryRow({ channel, createdAt, message }: { channel: string; createdAt: string; message: string }) {
  return (
    <View style={styles.historyRow}>
      <View style={styles.recordBody}>
        <View style={styles.inlineTitleRow}>
          <Text style={styles.petName}>{channel}</Text>
          <Text style={styles.recordDate}>{createdAt}</Text>
        </View>
        <Text style={styles.meta}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  detailHeader: {
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  backButton: {
    position: "absolute",
    left: 0,
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  detailHeaderTitle: {
    color: ownerColors.text,
    fontSize: 18,
    fontWeight: "500",
  },
  detailShell: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ownerColors.border,
    backgroundColor: ownerColors.surfaceSoft,
    padding: 8,
  },
  detailStack: {
    gap: 12,
  },
  fieldCardBody: {
    marginHorizontal: -14,
    marginBottom: -11,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: ownerColors.border,
  },
  flushBody: {
    marginTop: -4,
    gap: 0,
  },
  infoRow: {
    minHeight: 48,
    justifyContent: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ownerColors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  infoRowMultiline: {
    minHeight: 72,
    paddingVertical: 8,
  },
  infoLabel: {
    marginTop: 2,
    color: "#a39d94",
    fontSize: 12,
    lineHeight: 16,
  },
  infoValueWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
  infoTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  infoValue: {
    color: ownerColors.text,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400",
  },
  infoValueMultiline: {
    fontSize: 15,
    lineHeight: 20,
  },
  infoValueMuted: {
    color: ownerColors.faint,
    fontWeight: "400",
  },
  profileBody: {
    flex: 1,
    gap: 4,
  },
  meta: {
    color: ownerColors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  notificationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ownerColors.border,
    backgroundColor: "#fffdfa",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  notificationTitle: {
    color: ownerColors.text,
    fontSize: 15,
    fontWeight: "500",
  },
  readOnlySwitch: {
    width: 48,
    height: 28,
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: ownerColors.accent,
    paddingHorizontal: 4,
  },
  readOnlySwitchOff: {
    backgroundColor: "#d9d6cf",
  },
  switchThumb: {
    alignSelf: "flex-end",
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#ffffff",
  },
  switchThumbOff: {
    alignSelf: "flex-start",
  },
  notificationList: {
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
  },
  notificationItem: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ownerColors.border,
    backgroundColor: "#fcfaf7",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  notificationItemActive: {
    borderColor: "#dfe8e3",
    backgroundColor: "#fbfdfc",
  },
  notificationItemBody: {
    flex: 1,
    minWidth: 0,
  },
  notificationItemLabel: {
    color: ownerColors.text,
    fontSize: 15,
    fontWeight: "400",
  },
  notificationItemDescription: {
    marginTop: 4,
    color: "#9b968f",
    fontSize: 12,
    lineHeight: 17,
  },
  notificationPill: {
    minWidth: 52,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e7e1d8",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
  },
  notificationPillActive: {
    borderColor: "#cfe0d8",
    backgroundColor: "#eef7f3",
  },
  notificationPillText: {
    color: "#b0aba3",
    fontSize: 12,
    fontWeight: "500",
  },
  notificationPillTextActive: {
    color: ownerColors.accent,
  },
  tabRow: {
    flexDirection: "row",
    gap: 4,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ownerColors.border,
    backgroundColor: "#f8f5f0",
    padding: 4,
  },
  tabBlock: {
    gap: 10,
  },
  tabButton: {
    flex: 1,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    paddingHorizontal: 6,
  },
  tabButtonActive: {
    backgroundColor: "#ffffff",
  },
  tabButtonText: {
    color: ownerColors.muted,
    fontSize: 14,
    fontWeight: "500",
  },
  tabButtonTextActive: {
    color: ownerColors.text,
  },
  tabPanel: {
    gap: 10,
  },
  listCard: {
    overflow: "hidden",
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ownerColors.border,
    backgroundColor: "#ffffff",
  },
  petRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ownerColors.border,
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  petName: {
    color: ownerColors.text,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "500",
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ownerColors.border,
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  recordBody: {
    flex: 1,
    minWidth: 0,
  },
  inlineTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  recordDate: {
    color: ownerColors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  recordMemo: {
    marginTop: 4,
    color: ownerColors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  editText: {
    color: ownerColors.accent,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
});
