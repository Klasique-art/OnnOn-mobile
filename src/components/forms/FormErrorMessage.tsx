import { StyleSheet, Text } from "react-native";

type FormErrorMessageProps = {
  error?: string;
  visible?: boolean;
};

export default function FormErrorMessage({
  error,
  visible,
}: FormErrorMessageProps) {
  if (!visible || !error) return null;
  return <Text style={styles.error}>{error}</Text>;
}

const styles = StyleSheet.create({
  error: {
    color: "#DC0000",
    backgroundColor: "#FFE5E5",
    borderColor: "#F3A3A3",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: "600",
  },
});

