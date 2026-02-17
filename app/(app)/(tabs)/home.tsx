import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import PlaceholderScreen from "@/src/components/PlaceholderScreen";
import { colors, type } from "@/src/theme/colors";

export default function HomeScreen() {
  return (
    <PlaceholderScreen
      title="Home"
      description="Your launchpad for meetings, calls, and messaging. This is now styled as your base design system."
      badge="Main Hub"
      showBack={false}
      footer={
        <View style={styles.actions}>
          <Link href="/(app)/call-room" asChild>
            <Pressable style={styles.primaryButton}>
              <Text style={styles.primaryText}>Open Call Room</Text>
            </Pressable>
          </Link>
          <Link href="/(app)/billing" asChild>
            <Pressable style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>Open Billing</Text>
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
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.primaryDark,
  },
  primaryText: {
    color: colors.primaryText,
    fontFamily: type.body,
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.2,
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
