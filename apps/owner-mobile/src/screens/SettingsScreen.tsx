import { Pressable, StyleSheet, Text, View } from "react-native";

import { InfoRow, OwnerButton, OwnerCard, OwnerScreen } from "@/components/OwnerUi";
import { ownerColors } from "@/components/ownerTheme";
import type { SettingsSummaryViewModel } from "@/viewModels/ownerViewModels";

type SettingsScreenProps = {
  viewModel: SettingsSummaryViewModel;
  onSignOut?: () => void;
};

export default function SettingsScreen({ viewModel, onSignOut }: SettingsScreenProps) {
  const settingsRows = [
    { key: "shop", label: "매장 기본 정보" },
    { key: "closures", label: "운영시간 안내" },
    { key: "notifications", label: "알림톡 설정" },
    { key: "services", label: "서비스 관리" },
    { key: "addons", label: "부가기능" },
    { key: "account", label: "계정" },
  ];

  return (
    <OwnerScreen title="설정">
      <OwnerCard>
        {settingsRows.map((row) => (
          <Pressable key={row.key} style={styles.settingsRow}>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>{row.label}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
      </OwnerCard>

      <OwnerCard title="계정">
        <InfoRow label="로그인 계정" value={viewModel.accountEmail} />
        <OwnerButton label="로그아웃" onPress={onSignOut} variant="danger" />
      </OwnerCard>
    </OwnerScreen>
  );
}

const styles = StyleSheet.create({
  settingsRow: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: ownerColors.surface,
    paddingHorizontal: 4,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ownerColors.border,
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    color: ownerColors.text,
    fontSize: 15,
    fontWeight: "400",
  },
  chevron: {
    color: ownerColors.faint,
    fontSize: 24,
  },
});
