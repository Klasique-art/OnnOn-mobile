import { useEffect, useMemo, useRef, useState } from "react";
import { Href, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AxiosError } from "axios";
import OTPTextInput from "react-native-otp-textinput";
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

import client from "@/lib/client";
import { useAuth } from "@/context/AuthContext";
import { AppErrorMessage, FormLoader } from "@/src/components/forms";
import { colors, type } from "@/src/theme/colors";

type VerifyEmailResponse = {
  success: boolean;
  message: string;
};

type VerifyEmailRequest = {
  email: string;
  otpCode: string;
};

type VerifyErrorResponse = {
  message?: string;
};

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 30;

const getFriendlyError = (
  error: AxiosError<VerifyErrorResponse>,
  fallback: string
) => {
  const message = error.response?.data?.message;
  return message || fallback;
};

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { setToken } = useAuth();
  const { email: emailParam, token: tokenParam } = useLocalSearchParams<{
    email?: string;
    token?: string;
  }>();
  const otpRef = useRef<OTPTextInput | null>(null);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const email = useMemo(() => {
    if (!emailParam) return "";
    return Array.isArray(emailParam) ? emailParam[0] ?? "" : emailParam;
  }, [emailParam]);

  const signupToken = useMemo(() => {
    if (!tokenParam) return "";
    return Array.isArray(tokenParam) ? tokenParam[0] ?? "" : tokenParam;
  }, [tokenParam]);

  useEffect(() => {
    if (!cooldown) return;
    const timer = setInterval(() => {
      setCooldown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const canSubmit = otp.length === OTP_LENGTH && !isSubmitting && Boolean(email);
  const canResend = !isResending && cooldown === 0 && Boolean(email);

  const verifyEmail = async () => {
    if (!email) {
      console.warn("[VerifyEmail] Missing email context on verify", { email });
      setError("Missing email context. Please register again.");
      return;
    }
    if (otp.length !== OTP_LENGTH) {
      setError("Enter the 6-digit verification code.");
      return;
    }

    try {
      setError(null);
      setIsSubmitting(true);

      const payload: VerifyEmailRequest = {
        email: email.trim(),
        otpCode: otp.trim(),
      };
      await client.post<VerifyEmailResponse>("/users/verify-email", payload);
      if (!signupToken) {
        setError("Verification succeeded but missing session token. Please sign in.");
        router.replace("/(auth)/login" as Href);
        return;
      }

      await setToken(signupToken);
      router.replace("/(app)/(tabs)/home" as Href);
    } catch (err) {
      const apiError = err as AxiosError<VerifyErrorResponse>;
      console.warn("[VerifyEmail] Verification failed", {
        email: email.trim(),
        message: apiError.message,
        code: apiError.code,
        status: apiError.response?.status,
        responseData: apiError.response?.data,
      });
      setError(getFriendlyError(apiError, "Verification failed. Try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resendOtp = async () => {
    if (!email) {
      console.warn("[VerifyEmail] Missing email context on resend", { email });
      setError("Missing email context. Please register again.");
      return;
    }

    try {
      setError(null);
      setIsResending(true);
      await client.post<VerifyEmailResponse>("/users/resend-otp", {
        email: email.trim(),
      });
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      const apiError = err as AxiosError<VerifyErrorResponse>;
      console.warn("[VerifyEmail] Resend OTP failed", {
        email: email.trim(),
        message: apiError.message,
        code: apiError.code,
        status: apiError.response?.status,
        responseData: apiError.response?.data,
      });
      setError(getFriendlyError(apiError, "Could not resend code. Try again."));
    } finally {
      setIsResending(false);
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
                <Ionicons name="mail-open-outline" size={24} color={colors.primaryText} />
              </View>
              <Text style={styles.title}>Verify your email</Text>
              <Text style={styles.subtitle}>
                Enter the 6-digit code sent to {email || "your email address"}.
              </Text>
            </View>

            <View style={styles.formCard}>
              <FormLoader
                visible={isSubmitting || isResending}
                label={isSubmitting ? "Verifying..." : "Resending code..."}
              />
              <AppErrorMessage error={error || undefined} visible={!!error} />

              <View style={styles.otpWrap}>
                <OTPTextInput
                  ref={(node) => {
                    otpRef.current = node;
                  }}
                  inputCount={OTP_LENGTH}
                  handleTextChange={(value) => setOtp(value)}
                  tintColor={colors.primaryDark}
                  offTintColor={colors.stroke}
                  textInputStyle={styles.otpInput}
                />
              </View>

              <Pressable
                onPress={verifyEmail}
                style={[styles.primaryButton, !canSubmit && styles.disabledButton]}
                disabled={!canSubmit}
              >
                <Text style={styles.primaryButtonText}>Verify Email</Text>
              </Pressable>

              <View style={styles.resendRow}>
                <Pressable
                  onPress={resendOtp}
                  disabled={!canResend}
                  style={styles.resendAction}
                >
                  <Text style={[styles.resendText, !canResend && styles.resendTextDisabled]}>
                    {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    otpRef.current?.clear();
                    setOtp("");
                    setError(null);
                  }}
                  style={styles.clearAction}
                >
                  <Text style={styles.clearText}>Clear code</Text>
                </Pressable>
              </View>
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
    maxWidth: 320,
  },
  formCard: {
    position: "relative",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: 18,
    padding: 14,
    gap: 14,
  },
  otpWrap: {
    marginTop: 2,
    alignItems: "center",
  },
  otpInput: {
    width: 42,
    height: 50,
    borderWidth: 1,
    borderRadius: 12,
    borderColor: colors.stroke,
    backgroundColor: colors.surfaceSoft,
    color: colors.text,
    fontFamily: type.body,
    fontSize: 20,
    fontWeight: "700",
  },
  primaryButton: {
    borderRadius: 12,
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  disabledButton: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: colors.primaryText,
    fontFamily: type.body,
    fontSize: 15,
    fontWeight: "700",
  },
  resendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  resendAction: {
    paddingVertical: 4,
  },
  resendText: {
    color: colors.primaryDark,
    fontFamily: type.body,
    fontSize: 13,
    fontWeight: "700",
  },
  resendTextDisabled: {
    color: colors.textMuted,
  },
  clearAction: {
    paddingVertical: 4,
  },
  clearText: {
    color: colors.info,
    fontFamily: type.body,
    fontSize: 13,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
});
