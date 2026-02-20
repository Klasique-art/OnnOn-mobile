import { useState } from "react";
import { Href, Link, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  AppErrorMessage,
  AppForm,
  AppFormField,
  SubmitButton,
} from "@/src/components/forms";
import { LoginFormValues, LoginValidationSchema } from "@/src/validation/authSchemas";
import { colors, type } from "@/src/theme/colors";

export default function LoginScreen() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (values: LoginFormValues, { resetForm }: any) => {
    try {
      setIsLoading(true);
      setError(null);

      await new Promise((resolve) => setTimeout(resolve, 800));

      if (
        values.emailOrUsername.toLowerCase() === "blocked@example.com" ||
        values.password.toLowerCase() === "wrongpass"
      ) {
        throw new Error("Invalid credentials");
      }

      resetForm();
      router.replace("/(app)/(tabs)/home" as Href);
    } catch {
      setError("Login failed. Please check your credentials and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right", "bottom"]}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView
          style={styles.keyboardLayer}
          behavior="padding"
          keyboardVerticalOffset={72}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.bgOrbTop} />
            <View style={styles.bgOrbBottom} />

            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={20} color={colors.text} />
            </Pressable>

            <View style={styles.header}>
              <View style={styles.logoWrap}>
                <Ionicons name="videocam" size={24} color={colors.primaryText} />
              </View>
              <Text style={styles.title}>Welcome back</Text>
              <Text style={styles.subtitle}>
                Sign in to continue to your OnnOn workspace
              </Text>
            </View>

            <View style={styles.formCard}>
              <AppForm<LoginFormValues>
                initialValues={{ emailOrUsername: "", password: "" }}
                onSubmit={handleSubmit}
                validationSchema={LoginValidationSchema}
              >
                <>
                  <AppErrorMessage error={error || undefined} visible={!!error} />

                  <AppFormField
                    name="emailOrUsername"
                    label="Email or Username"
                    placeholder="Enter email or username"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    textContentType="username"
                  />

                  <AppFormField
                    name="password"
                    label="Password"
                    placeholder="Enter password"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="password"
                    icon={showPassword ? "eye-off-outline" : "eye-outline"}
                    iconPress={() => setShowPassword((prev) => !prev)}
                    iconAriaLabel={showPassword ? "Hide password" : "Show password"}
                  />

                  <Link href="/(auth)/forgot-password" style={styles.link}>
                    Forgot Password?
                  </Link>

                  <SubmitButton title={isLoading ? "Signing in..." : "Sign In"} disabled={isLoading} />

                  <View style={styles.footerRow}>
                    <Text style={styles.footerText}>Don&apos;t have an account? </Text>
                    <Link href="/(auth)/register" style={styles.footerLink}>
                      Sign up
                    </Link>
                  </View>
                </>
              </AppForm>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  keyboardLayer: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 24,
  },
  bgOrbTop: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "#FFE9C4",
    top: -120,
    right: -100,
  },
  bgOrbBottom: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "#D7E7FA",
    bottom: -120,
    left: -80,
  },
  backBtn: {
    marginTop: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.stroke,
  },
  header: {
    marginTop: 18,
    marginBottom: 18,
    alignItems: "center",
  },
  logoWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.primaryDark,
    marginBottom: 12,
  },
  title: {
    color: colors.text,
    fontFamily: type.display,
    fontSize: 34,
    lineHeight: 40,
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 14,
    textAlign: "center",
    marginTop: 4,
    maxWidth: 280,
  },
  formCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  link: {
    color: colors.info,
    fontFamily: type.body,
    fontWeight: "700",
    fontSize: 13,
    textDecorationLine: "underline",
    marginTop: -2,
    marginBottom: 4,
  },
  footerRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  footerText: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 13,
  },
  footerLink: {
    color: colors.primaryDark,
    fontFamily: type.body,
    fontSize: 13,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
});

