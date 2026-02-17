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
    color: "#8C2D1E",
    backgroundColor: "#FCEBE8",
    borderColor: "#E8C1BB",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: "600",
  },
});
