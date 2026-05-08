import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { ownerColors } from "@/components/ownerTheme";

type LoadingStateProps = {
  title?: string;
  description?: string;
};

export function LoadingState({
  title = "데이터를 불러오는 중입니다.",
  description = "잠시만 기다려주세요.",
}: LoadingStateProps) {
  return (
    <View style={styles.container}>
      <ActivityIndicator color={ownerColors.accent} size="small" />
      <View style={styles.textGroup}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 148,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ownerColors.border,
    borderRadius: 10,
    backgroundColor: ownerColors.surface,
    paddingHorizontal: 20,
    paddingVertical: 22,
    gap: 14,
  },
  textGroup: {
    alignItems: "center",
    gap: 6,
  },
  title: {
    color: ownerColors.text,
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  description: {
    color: ownerColors.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
});
