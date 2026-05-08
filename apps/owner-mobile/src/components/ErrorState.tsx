import { Pressable, StyleSheet, Text, View } from "react-native";

import { ownerColors } from "@/components/ownerTheme";

type ErrorStateProps = {
  title?: string;
  description?: string;
  retryLabel?: string;
  onRetry?: () => void;
};

export function ErrorState({
  title = "데이터를 불러오지 못했습니다.",
  description = "네트워크 상태를 확인한 뒤 다시 시도해주세요.",
  retryLabel = "다시 시도",
  onRetry,
}: ErrorStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.textGroup}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      {onRetry ? (
        <Pressable onPress={onRetry} style={styles.retryButton}>
          <Text style={styles.retryLabel}>{retryLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 148,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#ead6cc",
    borderRadius: 10,
    backgroundColor: ownerColors.dangerSoft,
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
  retryButton: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: ownerColors.accent,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  retryLabel: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
});
