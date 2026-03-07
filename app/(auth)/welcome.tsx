import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import PlaceholderScreen from "@/src/components/PlaceholderScreen";
import { colors, type } from "@/src/theme/colors";

export default function WelcomeScreen() {
  return (
    <PlaceholderScreen
      title="Welcome to OnnOn"
      description="A video-first collaboration app with clean rooms, calm visuals, and focused communication."
      badge="Get Started"
      showBack={false}
      footer={
        <View style={styles.actions}>
          <Link href="/(auth)/login" asChild>
            <Pressable style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>Go to Login</Text>
            </Pressable>
          </Link>
          <Link href="/(auth)/register" asChild>
            <Pressable style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>Go to Register</Text>
            </Pressable>
          </Link>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  actions: {
    marginTop: 18,
    gap: 10,
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.stroke,
  },
  secondaryText: {
    color: colors.text,
    fontFamily: type.body,
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
});
