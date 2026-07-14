import { type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { ownerColors } from "@/components/ownerTheme";

type OwnerScreenProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  hideHeader?: boolean;
  footer?: ReactNode;
  children: ReactNode;
};

type OwnerCardProps = {
  title?: string;
  description?: string;
  action?: ReactNode;
  tone?: "default" | "accent" | "warning" | "danger" | "complete";
  children?: ReactNode;
};

type OwnerFieldCardProps = {
  label: string;
  children: ReactNode;
  flush?: boolean;
};

type OwnerButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "kakao" | "naver" | "ghost" | "danger";
  disabled?: boolean;
};

type StatusBadgeProps = {
  label: string;
};

type InfoRowProps = {
  label: string;
  value: string;
};

export function OwnerScreen({ title, subtitle, action, hideHeader = false, footer, children }: OwnerScreenProps) {
  return (
    <View style={styles.screenFrame}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.screenContent, footer ? styles.screenContentWithFooter : null]}
        showsVerticalScrollIndicator={false}
      >
        {!hideHeader ? (
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
            {action}
          </View>
        ) : null}
        {children}
      </ScrollView>
      {footer ? (
        <View style={styles.screenFooter}>
          {footer}
        </View>
      ) : null}
    </View>
  );
}

export function OwnerCard({ title, description, action, tone = "default", children }: OwnerCardProps) {
  return (
    <View style={[styles.card, tone === "accent" && styles.accentCard, tone === "warning" && styles.warningCard, tone === "danger" && styles.dangerCard, tone === "complete" && styles.completeCard]}>
      {tone !== "default" ? <View style={[styles.cardStripe, stripeStyleByTone[tone]]} /> : null}
      {title ? (
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle}>{title}</Text>
          {action}
        </View>
      ) : null}
      {description ? <Text style={styles.cardDescription}>{description}</Text> : null}
      {children}
    </View>
  );
}

export function OwnerFieldCard({ label, children, flush = false }: OwnerFieldCardProps) {
  return (
    <View style={[styles.fieldCard, flush && styles.fieldCardFlush]}>
      <Text style={styles.fieldLegend}>{label}</Text>
      <View style={flush ? styles.fieldFlushBody : styles.fieldBody}>{children}</View>
    </View>
  );
}

export function OwnerButton({ label, onPress, variant = "primary", disabled = false }: OwnerButtonProps) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={[styles.button, buttonStyleByVariant[variant], disabled && styles.buttonDisabled]}
    >
      <Text style={[styles.buttonLabel, buttonLabelStyleByVariant[variant], disabled && styles.buttonLabelDisabled]}>
        {label}
      </Text>
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
  const compactLabel = getCompactStatusLabel(label);
  const style = getStatusStyle(label);

  return (
    <View style={[styles.statusBadge, style]}>
      {compactLabel === "완료" ? <Ionicons name="checkmark" size={13} color={ownerColors.accent} /> : null}
      <Text style={[styles.statusText, compactLabel === "완료" && styles.statusCompleteText]}>{compactLabel}</Text>
    </View>
  );
}

function getCompactStatusLabel(label: string) {
  if (label === "미용중") return "진행";
  if (label === "픽업 준비") return "픽업";
  return label;
}

function getStatusStyle(label: string) {
  if (label === "대기") return styles.statusWarning;
  if (label === "미용중") return styles.statusInfo;
  if (label === "픽업 준비") return styles.statusPickup;
  if (label === "완료") return styles.statusComplete;
  if (label === "취소") return styles.statusDanger;
  return styles.statusAccent;
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
  screenFrame: {
    flex: 1,
    backgroundColor: ownerColors.background,
  },
  screen: {
    flex: 1,
    backgroundColor: ownerColors.background,
  },
  screenContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
    gap: 12,
  },
  screenContentWithFooter: {
    paddingBottom: 160,
  },
  screenFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: ownerColors.border,
    backgroundColor: "rgba(255,255,255,0.98)",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 10,
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
    fontSize: 20,
    fontWeight: "500",
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
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
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
  fieldCard: {
    position: "relative",
    overflow: "visible",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ownerColors.border,
    borderRadius: 10,
    backgroundColor: ownerColors.surface,
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 11,
    marginTop: 7,
  },
  fieldCardFlush: {
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
  fieldLegend: {
    position: "absolute",
    top: -9,
    left: 12,
    paddingHorizontal: 6,
    backgroundColor: ownerColors.surface,
    color: ownerColors.muted,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "400",
  },
  fieldBody: {
    gap: 8,
  },
  fieldFlushBody: {
    gap: 0,
  },
  cardStripe: {
    height: 6,
    borderRadius: 999,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  cardTitle: {
    flex: 1,
    color: ownerColors.text,
    fontSize: 15,
    fontWeight: "500",
  },
  cardDescription: {
    color: ownerColors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  button: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  buttonLabelDisabled: {
    opacity: 0.85,
  },
  searchBox: {
    minHeight: 48,
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
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 0,
  },
  statusText: {
    color: ownerColors.text,
    fontSize: 11,
    fontWeight: "400",
  },
  statusCompleteText: {
    color: ownerColors.accent,
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
    gap: 5,
  },
  infoLabel: {
    color: ownerColors.muted,
    fontSize: 13,
    fontWeight: "400",
  },
  infoValue: {
    color: ownerColors.text,
    fontSize: 15,
    fontWeight: "500",
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
    fontSize: 14,
    fontWeight: "400",
  },
});
