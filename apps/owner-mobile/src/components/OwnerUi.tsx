import { type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ownerColors, ownerShadow } from "@/components/ownerTheme";

type OwnerScreenProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
};

type OwnerCardProps = {
  title?: string;
  description?: string;
  tone?: "default" | "accent" | "warning" | "danger" | "complete";
  children?: ReactNode;
};

type OwnerButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "kakao" | "naver" | "ghost" | "danger";
};

type StatusBadgeProps = {
  label: string;
};

type InfoRowProps = {
  label: string;
  value: string;
};

export function OwnerScreen({ title, subtitle, action, children }: OwnerScreenProps) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {action}
      </View>
      {children}
    </ScrollView>
  );
}

export function OwnerCard({ title, description, tone = "default", children }: OwnerCardProps) {
  return (
    <View style={[styles.card, tone === "accent" && styles.accentCard, tone === "warning" && styles.warningCard, tone === "danger" && styles.dangerCard, tone === "complete" && styles.completeCard]}>
      {tone !== "default" ? <View style={[styles.cardStripe, stripeStyleByTone[tone]]} /> : null}
      {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
      {description ? <Text style={styles.cardDescription}>{description}</Text> : null}
      {children}
    </View>
  );
}

export function OwnerButton({ label, onPress, variant = "primary" }: OwnerButtonProps) {
  return (
    <Pressable onPress={onPress} style={[styles.button, buttonStyleByVariant[variant]]}>
      <Text style={[styles.buttonLabel, buttonLabelStyleByVariant[variant]]}>{label}</Text>
    </Pressable>
  );
}

export function SearchBox({ placeholder }: { placeholder: string }) {
  return <TextInput editable={false} placeholder={placeholder} placeholderTextColor={ownerColors.faint} style={styles.searchBox} />;
}

export function Chip({ label, active = false, tone = "default" }: { label: string; active?: boolean; tone?: "default" | "soft" | "danger" }) {
  return (
    <View style={[styles.chip, active && styles.chipActive, tone === "soft" && styles.chipSoft, tone === "danger" && styles.chipDanger]}>
      <Text style={[styles.chipText, active && styles.chipTextActive, tone === "danger" && styles.chipDangerText]}>{label}</Text>
    </View>
  );
}

export function StatusBadge({ label }: StatusBadgeProps) {
  const style =
    label === "승인 대기"
      ? styles.statusWarning
      : label === "진행 중"
        ? styles.statusInfo
        : label === "픽업 준비"
          ? styles.statusPickup
          : label === "완료"
            ? styles.statusComplete
            : label === "취소"
              ? styles.statusDanger
              : styles.statusAccent;

  return (
    <View style={[styles.statusBadge, style]}>
      <Text style={styles.statusText}>{label}</Text>
    </View>
  );
}

export function InfoRow({ label, value }: InfoRowProps) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export function TagList({ tags }: { tags: string[] }) {
  return (
    <View style={styles.tagList}>
      {tags.map((tag) => (
        <Chip key={tag} label={tag} tone="soft" />
      ))}
    </View>
  );
}

export function EmptyState({ title }: { title: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{title}</Text>
    </View>
  );
}

const stripeStyleByTone = {
  default: {},
  accent: { backgroundColor: ownerColors.accent },
  warning: { backgroundColor: ownerColors.warning },
  danger: { backgroundColor: ownerColors.danger },
  complete: { backgroundColor: ownerColors.complete },
};

const buttonStyleByVariant = StyleSheet.create({
  primary: {
    borderColor: ownerColors.accent,
    backgroundColor: ownerColors.accent,
  },
  secondary: {
    borderColor: "#cfe3dc",
    backgroundColor: ownerColors.accentSoft,
  },
  kakao: {
    borderColor: "#fee500",
    backgroundColor: "#fee500",
  },
  naver: {
    borderColor: "#05ac4f",
    backgroundColor: "#05ac4f",
  },
  ghost: {
    borderColor: ownerColors.border,
    backgroundColor: ownerColors.surface,
  },
  danger: {
    borderColor: ownerColors.danger,
    backgroundColor: ownerColors.danger,
  },
});

const buttonLabelStyleByVariant = StyleSheet.create({
  primary: {
    color: "#ffffff",
  },
  secondary: {
    color: ownerColors.accent,
  },
  kakao: {
    color: "#191600",
  },
  naver: {
    color: "#ffffff",
  },
  ghost: {
    color: ownerColors.text,
  },
  danger: {
    color: "#ffffff",
  },
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: ownerColors.background,
  },
  screenContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
    gap: 14,
  },
  header: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerText: {
    flex: 1,
    gap: 3,
  },
  title: {
    color: ownerColors.text,
    fontSize: 22,
    fontWeight: "800",
  },
  subtitle: {
    color: ownerColors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ownerColors.border,
    borderRadius: 10,
    backgroundColor: ownerColors.surface,
    padding: 14,
    gap: 10,
    ...ownerShadow,
  },
  accentCard: {
    borderColor: "#d8e7e0",
    backgroundColor: "#f6fbf8",
  },
  warningCard: {
    borderColor: "#ead9cf",
    backgroundColor: ownerColors.warningSoft,
  },
  dangerCard: {
    borderColor: "#ead6cc",
    backgroundColor: ownerColors.dangerSoft,
  },
  completeCard: {
    borderColor: "#e9ddd3",
    backgroundColor: ownerColors.completeSoft,
  },
  cardStripe: {
    height: 6,
    borderRadius: 999,
  },
  cardTitle: {
    color: ownerColors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  cardDescription: {
    color: ownerColors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  button: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  buttonLabel: {
    fontSize: 14,
    fontWeight: "800",
  },
  searchBox: {
    minHeight: 46,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ownerColors.border,
    borderRadius: 10,
    backgroundColor: ownerColors.surface,
    paddingHorizontal: 14,
    color: ownerColors.text,
    fontSize: 14,
  },
  chip: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ownerColors.border,
    backgroundColor: ownerColors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipActive: {
    borderColor: ownerColors.accent,
    backgroundColor: ownerColors.accent,
  },
  chipSoft: {
    backgroundColor: "#f4f0eb",
  },
  chipDanger: {
    borderColor: "#ead6cc",
    backgroundColor: ownerColors.dangerSoft,
  },
  chipText: {
    color: ownerColors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  chipTextActive: {
    color: "#ffffff",
  },
  chipDangerText: {
    color: ownerColors.danger,
  },
  statusBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  statusText: {
    color: ownerColors.text,
    fontSize: 12,
    fontWeight: "800",
  },
  statusWarning: {
    backgroundColor: ownerColors.warningSoft,
  },
  statusAccent: {
    backgroundColor: ownerColors.accentSoft,
  },
  statusInfo: {
    backgroundColor: "#eef3ff",
  },
  statusPickup: {
    backgroundColor: "#faf0f3",
  },
  statusComplete: {
    backgroundColor: "#f0f0ef",
  },
  statusDanger: {
    backgroundColor: ownerColors.dangerSoft,
  },
  infoRow: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ownerColors.border,
    backgroundColor: ownerColors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  infoLabel: {
    color: ownerColors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  infoValue: {
    color: ownerColors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  tagList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  empty: {
    minHeight: 52,
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ownerColors.border,
    backgroundColor: ownerColors.surfaceSoft,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  emptyText: {
    color: ownerColors.muted,
    fontSize: 13,
    fontWeight: "700",
  },
});
