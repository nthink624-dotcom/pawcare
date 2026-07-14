import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { ownerColors } from "@/components/ownerTheme";
import type { SettingsSummaryViewModel } from "@/viewModels/ownerViewModels";

type SettingsScreenProps = {
  viewModel: SettingsSummaryViewModel;
  onSignOut?: () => void;
};

type SettingsEntryScreen = "shop" | "hours" | "notifications" | "services" | "addons" | "account";

const settingsRows: Array<{ key: SettingsEntryScreen; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: "shop", label: "매장 기본 정보", icon: "storefront-outline" },
  { key: "hours", label: "운영시간 안내", icon: "calendar-outline" },
  { key: "notifications", label: "알림톡 설정", icon: "notifications-outline" },
  { key: "services", label: "서비스 관리", icon: "cut-outline" },
  { key: "addons", label: "부가기능", icon: "add-outline" },
  { key: "account", label: "계정", icon: "person-outline" },
];

const settingsEntryTitles: Record<SettingsEntryScreen, string> = {
  shop: "매장 기본 정보",
  hours: "운영시간 안내",
  notifications: "알림톡 설정",
  services: "서비스 관리",
  addons: "부가기능",
  account: "계정",
};

export default function SettingsScreen({ viewModel, onSignOut }: SettingsScreenProps) {
  const [activeScreen, setActiveScreen] = useState<SettingsEntryScreen | null>(null);

  if (activeScreen) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => setActiveScreen(null)} style={styles.detailHeader} accessibilityLabel="설정으로 돌아가기">
          <Ionicons name="chevron-back" size={19} color={ownerColors.text} />
          <Text style={styles.detailHeaderTitle}>{settingsEntryTitles[activeScreen]}</Text>
        </Pressable>
        <SettingsDetailContent activeScreen={activeScreen} viewModel={viewModel} onSignOut={onSignOut} />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>설정</Text>
      </View>

      <View style={styles.planCard}>
        <View style={styles.planTop}>
          <View style={styles.planLeft}>
            <Text style={styles.planCaption}>현재 플랜</Text>
            <Text style={styles.planName}>2~4인 운영</Text>
            <Text style={styles.planDescription}>모든 플랜은 1개 사업자 / 1개 매장 기준입니다.</Text>
          </View>
          <View style={styles.priceRight}>
            <Text style={styles.price}>월 29,000원</Text>
            <Text style={styles.totalPrice}>월 정기결제</Text>
          </View>
        </View>
        <View style={styles.planDivider} />
        <View style={styles.planBottom}>
          <View>
            <Text style={styles.planCaption}>서비스 종료일</Text>
            <Text style={styles.endDate}>2026.05.31</Text>
          </View>
          <Pressable style={styles.planButton}>
            <Text style={styles.planButtonText}>플랜 보기</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.menuCard}>
        {settingsRows.map((row, index) => (
          <Pressable key={row.key} style={[styles.settingsRow, index === settingsRows.length - 1 && styles.settingsRowLast]} onPress={() => setActiveScreen(row.key)}>
            <Ionicons name={row.icon} size={22} color="#23231f" />
            <Text style={styles.rowLabel}>{row.label}</Text>
            <Ionicons name="chevron-forward" size={18} color="#8f887f" />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

function SettingsDetailContent({
  activeScreen,
  viewModel,
  onSignOut,
}: {
  activeScreen: SettingsEntryScreen;
  viewModel: SettingsSummaryViewModel;
  onSignOut?: () => void;
}) {
  if (activeScreen === "shop") {
    return (
      <View style={styles.detailCard}>
        <ReadOnlyField label="매장명" value={viewModel.shop.name} />
        <ReadOnlyField label="업체 연락처" value={viewModel.shop.phone} />
        <ReadOnlyField label="주소" value={viewModel.shop.address} />
        <ReadOnlyField label="소개 문구" value={viewModel.shop.description} />
      </View>
    );
  }

  if (activeScreen === "hours") {
    return (
      <View style={styles.detailCard}>
        <ReadOnlyField label="운영 시간" value={viewModel.businessHoursSummary} />
        <ReadOnlyField label="예약 정책" value={viewModel.bookingPolicySummary} />
      </View>
    );
  }

  if (activeScreen === "notifications") {
    return (
      <View style={styles.detailCard}>
        <ReadOnlyField label="알림톡 발송" value={viewModel.notificationSummary} />
        <ReadOnlyField label="고객 예약 화면" value={viewModel.customerPageSummary} />
      </View>
    );
  }

  if (activeScreen === "services") {
    return (
      <View style={styles.detailCard}>
        {viewModel.serviceRows.map((service) => (
          <View key={service.id} style={styles.serviceRow}>
            <View style={styles.serviceBody}>
              <Text style={styles.serviceName}>{service.name}</Text>
              <Text style={styles.serviceMeta}>
                {service.priceLabel} · {service.durationLabel}
              </Text>
            </View>
            <Text style={styles.serviceStatus}>{service.visibilityLabel}</Text>
          </View>
        ))}
      </View>
    );
  }

  if (activeScreen === "addons") {
    return (
      <View style={styles.detailCard}>
        <ReadOnlyField label="지점·타 업체 운영" value="동일 브랜드라도 지점이 다르거나 타 업체 관리를 함께 사용하는 경우 별도 문의가 필요합니다." />
        <ReadOnlyField label="외부 프리랜서" value="해당 매장에서 실제 예약을 수행하는 담당자만 등록할 수 있습니다." />
      </View>
    );
  }

  return (
    <View style={styles.detailCard}>
      <ReadOnlyField label="로그인 아이디" value={resolveLoginIdFromOwnerAuthEmail(viewModel.accountEmail) ?? viewModel.accountEmail} />
      <Pressable style={styles.signOutButton} onPress={onSignOut}>
        <Text style={styles.signOutText}>로그아웃</Text>
      </Pressable>
    </View>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

function resolveLoginIdFromOwnerAuthEmail(email?: string | null) {
  const trimmed = email?.trim();
  if (!trimmed) return null;

  const lowerEmail = trimmed.toLowerCase();
  const suffixes = ["@owner.petmanager.local", "@owner.pawcare.local"];
  const matchedSuffix = suffixes.find((suffix) => lowerEmail.endsWith(suffix));

  if (!matchedSuffix) return null;
  return trimmed.slice(0, -matchedSuffix.length);
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: ownerColors.background,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 34,
    gap: 16,
  },
  header: {
    minHeight: 34,
    justifyContent: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ownerColors.border,
    paddingBottom: 16,
  },
  title: {
    color: "#111111",
    fontSize: 24,
    fontWeight: "800",
  },
  planCard: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ownerColors.border,
    backgroundColor: "#ffffff",
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 14,
  },
  planTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  planLeft: {
    flex: 1,
    minWidth: 0,
  },
  planCaption: {
    color: "#796f66",
    fontSize: 14,
    fontWeight: "500",
  },
  planName: {
    marginTop: 6,
    color: "#111111",
    fontSize: 25,
    fontWeight: "900",
  },
  planDescription: {
    marginTop: 10,
    color: "#71685f",
    fontSize: 15,
    lineHeight: 22,
  },
  priceRight: {
    alignItems: "flex-end",
    paddingTop: 2,
  },
  price: {
    color: "#111111",
    fontSize: 25,
    fontWeight: "900",
  },
  totalPrice: {
    marginTop: 5,
    color: "#7b7268",
    fontSize: 14,
  },
  planDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: ownerColors.border,
  },
  planBottom: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  endDate: {
    marginTop: 6,
    color: "#111111",
    fontSize: 22,
    fontWeight: "500",
  },
  planButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: ownerColors.accent,
    paddingHorizontal: 18,
  },
  planButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  menuCard: {
    overflow: "hidden",
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ownerColors.border,
    backgroundColor: "#ffffff",
  },
  settingsRow: {
    minHeight: 69,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 22,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ownerColors.border,
  },
  settingsRowLast: {
    borderBottomWidth: 0,
  },
  rowLabel: {
    flex: 1,
    color: "#111111",
    fontSize: 17,
    fontWeight: "500",
  },
  detailHeader: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  detailHeaderTitle: {
    color: ownerColors.text,
    fontSize: 17,
    fontWeight: "800",
  },
  detailCard: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ownerColors.border,
    backgroundColor: "#ffffff",
    padding: 14,
    gap: 10,
  },
  field: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ownerColors.border,
    backgroundColor: ownerColors.surfaceSoft,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 5,
  },
  fieldLabel: {
    color: ownerColors.muted,
    fontSize: 13,
    fontWeight: "600",
  },
  fieldValue: {
    color: ownerColors.text,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "500",
  },
  serviceRow: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ownerColors.border,
    backgroundColor: ownerColors.surfaceSoft,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  serviceBody: {
    flex: 1,
  },
  serviceName: {
    color: ownerColors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  serviceMeta: {
    marginTop: 4,
    color: ownerColors.muted,
    fontSize: 13,
  },
  serviceStatus: {
    color: ownerColors.accent,
    fontSize: 13,
    fontWeight: "700",
  },
  signOutButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: ownerColors.danger,
  },
  signOutText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
});
