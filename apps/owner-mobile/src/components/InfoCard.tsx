import { type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

type InfoCardProps = {
  title: string;
  description?: string;
  children?: ReactNode;
};

export function InfoCard({ title, description, children }: InfoCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#ded6ca",
    borderRadius: 8,
    backgroundColor: "#ffffff",
    padding: 14,
    gap: 8,
  },
  title: {
    color: "#191513",
    fontSize: 16,
    fontWeight: "800",
  },
  description: {
    color: "#686059",
    fontSize: 13,
    lineHeight: 19,
  },
});
