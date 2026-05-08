import { Pressable, StyleSheet, Text } from "react-native";

type ActionButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary";
};

export function ActionButton({ label, onPress, variant = "primary" }: ActionButtonProps) {
  return (
    <Pressable onPress={onPress} style={[styles.button, variant === "secondary" && styles.secondary]}>
      <Text style={[styles.label, variant === "secondary" && styles.secondaryLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: "#1f6b5b",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  secondary: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#d8cec2",
    backgroundColor: "#fffaf3",
  },
  label: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryLabel: {
    color: "#1f6b5b",
  },
});
