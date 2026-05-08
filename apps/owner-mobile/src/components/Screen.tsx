import { type ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

type ScreenProps = {
  title: string;
  eyebrow?: string;
  children: ReactNode;
};

export function Screen({ title, eyebrow, children }: ScreenProps) {
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.header}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title}>{title}</Text>
      </View>
      <View style={styles.body}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 26,
  },
  header: {
    gap: 6,
    marginBottom: 18,
  },
  eyebrow: {
    color: "#1f6b5b",
    fontSize: 12,
    fontWeight: "700",
  },
  title: {
    color: "#191513",
    fontSize: 26,
    fontWeight: "800",
  },
  body: {
    gap: 12,
  },
});
