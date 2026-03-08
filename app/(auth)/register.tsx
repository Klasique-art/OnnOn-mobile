import { useState } from "react";
import { Href, Link, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AxiosError } from "axios";
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
  FormLoader,
  SubmitButton,
} from "@/src/components/forms";
import {
  SignupFormValues,
  SignupValidationSchema,
} from "@/src/validation/authSchemas";
import { colors, type } from "@/src/theme/colors";
import client from "@/lib/client";

type RegisterResponse = {
  success: boolean;
  message: string;
  token: string;
  user: {
    id: string;
    email: string;
    isVerified: boolean;
  };
};

type RegisterErrorResponse = {
  message?: string;
};

const logSignupError = (error: AxiosError<RegisterErrorResponse>) => {
  console.warn("[Signup] Registration failed", {
    message: error.message,
    code: error.code,
    status: error.response?.status,
    responseData: error.response?.data,
  });
};

export default function RegisterScreen() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (
    values: SignupFormValues,
    { resetForm }: { resetForm: () => void }
  ) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await client.post<RegisterResponse>("/users/register", {
        email: values.email.trim(),
        password: values.password,
      });

      resetForm();
      router.replace({
        pathname: "/(auth)/verify-email",
        params: {
          email: values.email.trim(),
          token: response.data.token,
        },
      } as Href);
    } catch (err) {
      const apiError = err as AxiosError<RegisterErrorResponse>;
      const apiMessage = apiError.response?.data?.message;
      logSignupError(apiError);

      if (apiMessage) {
        setError(apiMessage);
      } else if (apiError.code === "ECONNABORTED") {
        setError("Signup timed out. Please try again.");
      } else {
        setError("Signup failed. Please try again.");
      }
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
                <Ionicons name="person-add" size={24} color={colors.primaryText} />
              </View>
              <Text style={styles.title}>Create account</Text>
              <Text style={styles.subtitle}>
                Join OnnOn and start collaborating in secure meeting rooms.
              </Text>
            </View>

            <View style={styles.formCard}>
              <FormLoader visible={isLoading} label="Creating account..." />
              <AppForm<SignupFormValues>
                initialValues={{
                  email: "",
                  password: "",
                  confirmPassword: "",
                }}
                onSubmit={handleSubmit}
                validationSchema={SignupValidationSchema}
              >
                <>
                  <AppErrorMessage error={error || undefined} visible={!!error} />

                  <AppFormField
                    name="email"
                    label="Email"
                    placeholder="you@example.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="emailAddress"
                  />

                  <AppFormField
                    key={showPassword ? "password-visible" : "password-hidden"}
                    name="password"
                    label="Password"
                    placeholder="Create a password"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="password"
                    icon={showPassword ? "eye-off-outline" : "eye-outline"}
                    iconPress={() => setShowPassword((prev) => !prev)}
                    iconAriaLabel={showPassword ? "Hide password" : "Show password"}
                  />

                  <AppFormField
                    key={
                      showConfirmPassword
                        ? "confirm-password-visible"
                        : "confirm-password-hidden"
                    }
                    name="confirmPassword"
                    label="Confirm Password"
                    placeholder="Repeat your password"
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="password"
                    icon={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                    iconPress={() => setShowConfirmPassword((prev) => !prev)}
                    iconAriaLabel={
                      showConfirmPassword ? "Hide password" : "Show password"
                    }
                  />

                  <View style={styles.securityHint}>
                    <Text style={styles.securityHintText}>
                      Use at least 8 characters with uppercase, lowercase, number, and symbol.
                    </Text>
                  </View>

                  <SubmitButton
                    title={isLoading ? "Creating account..." : "Create Account"}
                    disabled={isLoading}
                  />

                  <View style={styles.footerRow}>
                    <Text style={styles.footerText}>Already have an account? </Text>
                    <Link href="/(auth)/login" style={styles.footerLink}>
                      Sign in
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
    marginTop: 14,
    marginBottom: 16,
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
    maxWidth: 300,
  },
  formCard: {
    position: "relative",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  securityHint: {
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: 10,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  securityHintText: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 12,
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

