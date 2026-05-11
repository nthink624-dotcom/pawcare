import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { EmptyState, InfoRow, OwnerButton, OwnerCard, OwnerScreen } from "@/components/OwnerUi";
import { ownerColors } from "@/components/ownerTheme";
import type { CustomerDetailViewModel } from "@/viewModels/ownerViewModels";

type CustomerDetailScreenProps = {
  customer: CustomerDetailViewModel | null;
  onBack: () => void;
};

type CustomerDetailTab = "records" | "pets" | "notifications";

export default function CustomerDetailScreen({ customer, onBack }: CustomerDetailScreenProps) {
  const [activeTab, setActiveTab] = useState<CustomerDetailTab>("records");

  if (!customer) {
    return (
      <OwnerScreen title="고객 상세" action={<OwnerButton label="목록" onPress={onBack} variant="ghost" />}>
        <OwnerCard title="고객 없음" description="선택한 고객 정보를 찾을 수 없습니다." />
      </OwnerScreen>
    );
  }

  return (
    <OwnerScreen title="고객 상세" action={<OwnerButton label="목록" onPress={onBack} variant="ghost" />}>
      <OwnerCard title="기본 정보">
        <InfoRow label="보호자 이름" value={`${customer.name} 보호자`} />
        <InfoRow label="연락처" value={customer.phone} />
        <InfoRow label="반려동물" value={customer.petNames.join(", ") || "등록된 반려동물 없음"} />
        <InfoRow label="고객 메모" value={customer.memo || "메모를 추가해 주세요"} />
      </OwnerCard>

      <OwnerCard title="개인 알림톡">
        <View style={styles.notificationHeader}>
          <View style={styles.profileBody}>
            <Text style={styles.notificationTitle}>알림톡 전체 수신</Text>
            <Text style={styles.meta}>이 고객에게 가는 예약·미용 알림을 한 번에 켜거나 끌 수 있어요.</Text>
          </View>
          <View style={styles.readOnlySwitch}>
            <View style={styles.switchThumb} />
          </View>
        </View>
        {["예약 확정", "예약 거절", "예약 취소", "예약 변경", "픽업 준비", "미용 완료"].map((label) => (
          <View key={label} style={styles.notificationItem}>
            <Text style={styles.notificationItemLabel}>{label}</Text>
            <Text style={styles.notificationItemStatus}>{customer.alertLabel}</Text>
          </View>
        ))}
      </OwnerCard>

      <View style={styles.tabRow}>
        <DetailTabButton label="미용 기록" active={activeTab === "records"} onPress={() => setActiveTab("records")} />
        <DetailTabButton label="반려동물" active={activeTab === "pets"} onPress={() => setActiveTab("pets")} />
        <DetailTabButton label="알림 내역" active={activeTab === "notifications"} onPress={() => setActiveTab("notifications")} />
      </View>

      {activeTab === "records" ? (
        <OwnerCard>
          {customer.groomingRecords.length === 0 ? (
            <EmptyState title="미용 기록이 없어요" />
          ) : (
            customer.groomingRecords.map((record) => (
              <View key={record.id} style={styles.historyRow}>
                <Text style={styles.historyTime}>{record.groomedAt}</Text>
                <View style={styles.profileBody}>
                  <Text style={styles.petName}>{record.petName}</Text>
                  <Text style={styles.meta}>
                    {record.serviceName} · {record.pricePaidLabel}
                  </Text>
                </View>
              </View>
            ))
          )}
        </OwnerCard>
      ) : null}

      {activeTab === "pets" ? (
        <OwnerCard>
          {customer.pets.map((pet) => (
            <View key={pet.id} style={styles.petRow}>
              <View style={styles.petAvatar}>
                <Text style={styles.petAvatarText}>{pet.avatarSeed}</Text>
              </View>
              <View style={styles.profileBody}>
                <Text style={styles.petName}>{pet.name}</Text>
                <Text style={styles.meta}>
                  {pet.breed} · {pet.groomingCycleWeeks}주 주기
                </Text>
              </View>
            </View>
          ))}
          <OwnerButton label="아기 추가하기" variant="secondary" />
        </OwnerCard>
      ) : null}

      {activeTab === "notifications" ? (
        <OwnerCard>
          {customer.notifications.length === 0 ? (
            <EmptyState title="발송된 알림톡이 없어요" />
          ) : (
            customer.notifications.map((notification) => (
              <View key={notification.id} style={styles.historyRow}>
                <Text style={styles.historyTime}>{notification.createdAt}</Text>
                <View style={styles.profileBody}>
                  <Text style={styles.petName}>{notification.channel}</Text>
                  <Text style={styles.meta}>{notification.message}</Text>
                </View>
              </View>
            ))
          )}
        </OwnerCard>
      ) : null}
    </OwnerScreen>
  );
}

function DetailTabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tabButton, active && styles.tabButtonActive]}>
      <Text style={[styles.tabButtonText, active && styles.tabButtonTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
    paddingBottom: 12,
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
  switchThumb: {
    alignSelf: "flex-end",
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#ffffff",
  },
  notificationItem: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ownerColors.border,
    backgroundColor: ownerColors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  notificationItemLabel: {
    color: ownerColors.text,
    fontSize: 14,
    fontWeight: "500",
  },
  notificationItemStatus: {
    color: ownerColors.muted,
    fontSize: 12,
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
  petRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ownerColors.border,
    backgroundColor: ownerColors.surface,
    padding: 12,
  },
  petAvatar: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 21,
    backgroundColor: ownerColors.accentSoft,
  },
  petAvatarText: {
    color: ownerColors.accent,
    fontSize: 17,
    fontWeight: "900",
  },
  petName: {
    color: ownerColors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ownerColors.border,
    backgroundColor: ownerColors.surfaceSoft,
    padding: 12,
  },
  historyTime: {
    minWidth: 46,
    color: ownerColors.text,
    fontSize: 16,
    fontWeight: "800",
  },
});
