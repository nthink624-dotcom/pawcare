import { Pressable, StyleSheet, Text, View } from "react-native";

import { InfoRow, OwnerButton, OwnerCard, OwnerScreen } from "@/components/OwnerUi";
import { ownerColors } from "@/components/ownerTheme";
import { settingsRows, shopSummary } from "@/screens/ownerPlaceholderData";

type SettingsScreenProps = {
  onSignOut?: () => void;
};

export default function SettingsScreen({ onSignOut }: SettingsScreenProps) {
  return (
    <OwnerScreen title="설정" subtitle="매장 운영 정책과 알림, 결제를 관리하는 화면입니다.">
      <OwnerCard title="매장 기본 정보" tone="accent">
        <InfoRow label="매장명" value={shopSummary.name} />
        <InfoRow label="주소" value={shopSummary.address} />
        <Text style={styles.helper}>대표 이미지, 매장명, 연락처, 고객 예약 화면 안내 문구를 이후 단계에서 연결합니다.</Text>
      </OwnerCard>

      <OwnerCard title="관리자 설정">
        {settingsRows.map((row) => (
          <Pressable key={row.key} style={styles.settingsRow}>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Text style={styles.rowDescription}>{row.description}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
      </OwnerCard>

      <OwnerCard title="계정">
        <InfoRow label="로그인 계정" value={shopSummary.ownerEmail} />
        <Pressable style={styles.settingsRow}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>비밀번호 재설정</Text>
            <Text style={styles.rowDescription}>기존 웹의 비밀번호 재설정 진입점과 같은 자리입니다.</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
        <OwnerButton label="로그아웃" onPress={onSignOut} variant="danger" />
      </OwnerCard>
    </OwnerScreen>
  );
}

const styles = StyleSheet.create({
  helper: {
    color: ownerColors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  settingsRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ownerColors.border,
    backgroundColor: ownerColors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rowText: {
    flex: 1,
    gap: 4,
  },
  rowLabel: {
    color: ownerColors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  rowDescription: {
    color: ownerColors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  chevron: {
    color: ownerColors.faint,
    fontSize: 24,
  },
});
