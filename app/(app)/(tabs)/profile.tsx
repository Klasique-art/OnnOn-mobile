import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { AxiosError } from "axios";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import client from "@/lib/client";
import { FormLoader } from "@/src/components/forms";
import { colors, type } from "@/src/theme/colors";

type ProfileTheme = "light" | "dark";

type ProfilePreferences = {
  theme: ProfileTheme;
  notifications: boolean;
  audioDefault: boolean;
  videoDefault: boolean;
};

type ProfileData = {
  _id: string;
  userId: string;
  email: string;
  displayName: string;
  avatar: string | null;
  bio: string;
  preferences: ProfilePreferences;
  createdAt: string;
  updatedAt: string;
};

type ProfileResponse = {
  success: boolean;
  message?: string;
  data: ProfileData;
};

type ApiErrorResponse = {
  success?: boolean;
  message?: string;
};

type DraftProfile = {
  displayName: string;
  bio: string;
  avatar: string | null;
  preferences: ProfilePreferences;
};

const DEFAULT_PREFERENCES: ProfilePreferences = {
  theme: "light",
  notifications: true,
  audioDefault: true,
  videoDefault: true,
};

const toDraftProfile = (profile: ProfileData): DraftProfile => ({
  displayName: profile.displayName ?? "",
  bio: profile.bio ?? "",
  avatar: profile.avatar ?? null,
  preferences: {
    theme: profile.preferences?.theme ?? DEFAULT_PREFERENCES.theme,
    notifications:
      profile.preferences?.notifications ?? DEFAULT_PREFERENCES.notifications,
    audioDefault:
      profile.preferences?.audioDefault ?? DEFAULT_PREFERENCES.audioDefault,
    videoDefault:
      profile.preferences?.videoDefault ?? DEFAULT_PREFERENCES.videoDefault,
  },
});

const getErrorMessage = (
  error: AxiosError<ApiErrorResponse>,
  fallback: string
) => error.response?.data?.message || fallback;

const logProfileError = (label: string, err: unknown, context?: object) => {
  const apiError = err as AxiosError<ApiErrorResponse>;
  console.error(label, {
    ...context,
    message: apiError?.message || String(err),
    code: apiError?.code,
    status: apiError?.response?.status,
    responseData: apiError?.response?.data,
  });
};

export default function ProfileScreen() {
  const router = useRouter();
  const { setToken } = useAuth();
  const { width } = useWindowDimensions();
  const isCompact = width < 370;

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [draft, setDraft] = useState<DraftProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isRemovingAvatar, setIsRemovingAvatar] = useState(false);
  const [screenError, setScreenError] = useState<string | null>(null);

  const isBusy = isSaving || isUploadingAvatar || isRemovingAvatar;

  const loadProfile = async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);
    else setIsLoadingProfile(true);

    try {
      setScreenError(null);
      const response = await client.get<ProfileResponse>("/profile/me");
      setProfile(response.data.data);
      setDraft(toDraftProfile(response.data.data));
    } catch (err) {
      const apiError = err as AxiosError<ApiErrorResponse>;
      logProfileError("[Profile] Failed to fetch profile", err);
      setScreenError(getErrorMessage(apiError, "Could not load profile."));
    } finally {
      if (showRefresh) setIsRefreshing(false);
      else setIsLoadingProfile(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const hasChanges = useMemo(() => {
    if (!profile || !draft) return false;
    const original = toDraftProfile(profile);
    return JSON.stringify(original) !== JSON.stringify(draft);
  }, [draft, profile]);

  const initials = useMemo(() => {
    const source = draft?.displayName?.trim() || "User";
    const parts = source.split(" ").filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] || "U"}${parts[1][0] || ""}`.toUpperCase();
  }, [draft?.displayName]);

  const onSaveProfile = async () => {
    if (!draft) return;
    if (draft.displayName.trim().length < 2) {
      setScreenError("Display name must be at least 2 characters.");
      return;
    }

    try {
      setIsSaving(true);
      setScreenError(null);

      const payload = {
        displayName: draft.displayName.trim(),
        bio: draft.bio.trim(),
        preferences: draft.preferences,
      };

      const response = await client.put<ProfileResponse>("/profile/me", payload);
      setProfile(response.data.data);
      setDraft(toDraftProfile(response.data.data));
      setIsEditing(false);
      Alert.alert("Profile Updated", "Your profile changes were saved.");
    } catch (err) {
      const apiError = err as AxiosError<ApiErrorResponse>;
      logProfileError("[Profile] Failed to update profile", err);
      setScreenError(getErrorMessage(apiError, "Could not update profile."));
    } finally {
      setIsSaving(false);
    }
  };

  const onPickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Photo Permission Needed",
        "Allow photo access in settings to upload an avatar."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (result.canceled || !result.assets?.[0]?.uri) return;

    try {
      const selected = result.assets[0];
      const uri = selected.uri;
      const fileName = selected.fileName || `avatar-${Date.now()}.jpg`;
      const mimeType = selected.mimeType || "image/jpeg";
      const formData = new FormData();
      formData.append("avatar", {
        uri,
        name: fileName,
        type: mimeType,
      } as never);

      setIsUploadingAvatar(true);
      setScreenError(null);
      const response = await client.post<ProfileResponse>("/profile/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setProfile(response.data.data);
      setDraft(toDraftProfile(response.data.data));
      Alert.alert("Avatar Updated", "Profile photo changed successfully.");
    } catch (err) {
      const apiError = err as AxiosError<ApiErrorResponse>;
      logProfileError("[Profile] Failed to upload avatar", err, {
        selectedAsset: result.assets[0],
      });
      setScreenError(getErrorMessage(apiError, "Could not upload avatar."));
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const onRemoveAvatar = () => {
    Alert.alert(
      "Remove Avatar",
      "This will reset your avatar to the default image.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              setIsRemovingAvatar(true);
              setScreenError(null);
              const response = await client.delete<ProfileResponse>("/profile/avatar");
              setProfile(response.data.data);
              setDraft(toDraftProfile(response.data.data));
            } catch (err) {
              const apiError = err as AxiosError<ApiErrorResponse>;
              logProfileError("[Profile] Failed to remove avatar", err);
              setScreenError(getErrorMessage(apiError, "Could not remove avatar."));
            } finally {
              setIsRemovingAvatar(false);
            }
          },
        },
      ]
    );
  };

  const onCancelEdit = () => {
    if (!profile) return;
    setDraft(toDraftProfile(profile));
    setIsEditing(false);
    setScreenError(null);
  };

  const onLogout = async () => {
    await setToken(null);
    router.replace("/(auth)/welcome");
  };

  if (isLoadingProfile && !draft) {
    return (
      <SafeAreaView style={styles.screen} edges={["top", "left", "right", "bottom"]}>
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color={colors.primaryDark} />
          <Text style={styles.stateText}>Loading your profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!draft) {
    return (
      <SafeAreaView style={styles.screen} edges={["top", "left", "right", "bottom"]}>
        <View style={styles.centeredState}>
          <Text style={styles.stateText}>Profile unavailable.</Text>
          <Pressable onPress={() => loadProfile()} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.keyboardLayer}
        behavior="padding"
        keyboardVerticalOffset={76}
      >
        <ScrollView
          contentContainerStyle={[styles.content, isCompact && styles.contentCompact]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadProfile(true)}
              tintColor={colors.primaryDark}
            />
          }
        >
          <View style={styles.bgOrbTop} />
          <View style={styles.bgOrbBottom} />

          <View style={styles.header}>
            <Text style={styles.kicker}>Account</Text>
            <Text style={styles.title}>Your Profile</Text>
            <Text style={styles.subtitle}>
              Manage personal details, profile photo, and meeting defaults.
            </Text>
          </View>

          <View style={styles.heroCard}>
            <FormLoader
              visible={isBusy}
              label={
                isSaving
                  ? "Saving profile..."
                  : isUploadingAvatar
                    ? "Uploading photo..."
                    : "Removing photo..."
              }
            />
            <View style={styles.heroTopRow}>
              <View style={styles.avatarShell}>
                {draft.avatar ? (
                  <Image source={{ uri: draft.avatar }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarInitials}>{initials}</Text>
                )}
              </View>
              <View style={styles.heroTextWrap}>
                <Text style={styles.heroName}>
                  {draft.displayName.trim() || "Unnamed User"}
                </Text>
                <Text style={styles.heroMeta}>User ID: {profile?.userId || "-"}</Text>
              </View>
            </View>

            <View style={[styles.avatarActions, isCompact && styles.avatarActionsCompact]}>
              <Pressable
                style={[styles.ghostButton, styles.avatarActionButton]}
                onPress={onPickAvatar}
                accessibilityRole="button"
                accessibilityLabel="Change profile photo"
              >
                <Ionicons name="image-outline" size={15} color={colors.text} />
                <Text style={styles.ghostButtonText}>Change Photo</Text>
              </Pressable>
              <Pressable
                style={[styles.dangerButton, styles.avatarActionButton]}
                onPress={onRemoveAvatar}
                accessibilityRole="button"
                accessibilityLabel="Remove profile photo"
              >
                <Ionicons name="trash-outline" size={15} color={colors.error} />
                <Text style={styles.dangerButtonText}>Remove</Text>
              </Pressable>
            </View>
          </View>

          {screenError ? (
            <View style={styles.errorBanner} accessibilityLiveRegion="polite">
              <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
              <Text style={styles.errorBannerText}>{screenError}</Text>
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Basic Info</Text>

            <Text style={styles.fieldLabel}>Email</Text>
            <View style={styles.readOnlyField}>
              <Text style={styles.readOnlyText}>{profile?.email || "-"}</Text>
            </View>

            <Text style={styles.fieldLabel}>Display Name</Text>
            <TextInput
              value={draft.displayName}
              onChangeText={(value) =>
                setDraft((prev) => (prev ? { ...prev, displayName: value } : prev))
              }
              style={[styles.input, !isEditing && styles.inputDisabled]}
              placeholder="Display name"
              placeholderTextColor={colors.textMuted}
              editable={isEditing}
              maxLength={50}
              accessibilityLabel="Display name"
            />

            <Text style={styles.fieldLabel}>Bio</Text>
            <TextInput
              value={draft.bio}
              onChangeText={(value) =>
                setDraft((prev) => (prev ? { ...prev, bio: value } : prev))
              }
              style={[styles.input, styles.textArea, !isEditing && styles.inputDisabled]}
              multiline
              placeholder="Tell people about you"
              placeholderTextColor={colors.textMuted}
              editable={isEditing}
              maxLength={200}
              accessibilityLabel="Bio"
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Preferences</Text>

            <Text style={styles.fieldLabel}>Theme</Text>
            <View style={styles.segmentRow}>
              <ThemeButton
                label="Light"
                selected={draft.preferences.theme === "light"}
                disabled={!isEditing}
                onPress={() =>
                  setDraft((prev) =>
                    prev
                      ? {
                          ...prev,
                          preferences: { ...prev.preferences, theme: "light" },
                        }
                      : prev
                  )
                }
              />
              <ThemeButton
                label="Dark"
                selected={draft.preferences.theme === "dark"}
                disabled={!isEditing}
                onPress={() =>
                  setDraft((prev) =>
                    prev
                      ? {
                          ...prev,
                          preferences: { ...prev.preferences, theme: "dark" },
                        }
                      : prev
                  )
                }
              />
            </View>

            <PreferenceRow
              label="Push Notifications"
              value={draft.preferences.notifications}
              disabled={!isEditing}
              onChange={(value) =>
                setDraft((prev) =>
                  prev
                    ? {
                        ...prev,
                        preferences: { ...prev.preferences, notifications: value },
                      }
                    : prev
                )
              }
            />
            <PreferenceRow
              label="Join With Microphone"
              value={draft.preferences.audioDefault}
              disabled={!isEditing}
              onChange={(value) =>
                setDraft((prev) =>
                  prev
                    ? {
                        ...prev,
                        preferences: { ...prev.preferences, audioDefault: value },
                      }
                    : prev
                )
              }
            />
            <PreferenceRow
              label="Join With Camera"
              value={draft.preferences.videoDefault}
              disabled={!isEditing}
              onChange={(value) =>
                setDraft((prev) =>
                  prev
                    ? {
                        ...prev,
                        preferences: { ...prev.preferences, videoDefault: value },
                      }
                    : prev
                )
              }
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Actions</Text>
            {isEditing ? (
              <View style={styles.rowButtons}>
                <Pressable
                  style={[styles.ghostButton, styles.flexButton]}
                  onPress={onCancelEdit}
                >
                  <Text style={styles.ghostButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.primaryButton,
                    styles.flexButton,
                    (!hasChanges || isBusy) && styles.buttonDisabled,
                  ]}
                  onPress={onSaveProfile}
                  disabled={!hasChanges || isBusy}
                >
                  <Text style={styles.primaryButtonText}>Save Changes</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.rowButtons}>
                <Pressable
                  style={[styles.primaryButton, styles.flexButton]}
                  onPress={() => setIsEditing(true)}
                >
                  <Text style={styles.primaryButtonText}>Edit Profile</Text>
                </Pressable>
                <Pressable
                  style={[styles.ghostButton, styles.flexButton]}
                  onPress={() => loadProfile(true)}
                >
                  <Text style={styles.ghostButtonText}>Refresh</Text>
                </Pressable>
              </View>
            )}

            <Pressable style={styles.logoutButton} onPress={onLogout}>
              <Text style={styles.logoutButtonText}>Log Out</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function PreferenceRow({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <View style={styles.preferenceRow}>
      <Text style={[styles.preferenceLabel, disabled && styles.disabledText]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        accessibilityLabel={label}
        trackColor={{ false: "#B7C5D5", true: "#F6C063" }}
        thumbColor={value ? colors.primary : "#EEF3F8"}
      />
    </View>
  );
}

function ThemeButton({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[
        styles.segment,
        selected && styles.segmentActive,
        disabled && styles.segmentDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
    >
      <Text style={[styles.segmentText, selected && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 96,
    gap: 12,
  },
  contentCompact: {
    paddingHorizontal: 12,
  },
  bgOrbTop: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "#E7F2FF",
    top: -110,
    right: -130,
  },
  bgOrbBottom: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "#FFF2D8",
    bottom: -130,
    left: -100,
  },
  centeredState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 20,
  },
  stateText: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 14,
    textAlign: "center",
  },
  retryButton: {
    borderWidth: 1,
    borderColor: colors.primaryDark,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: colors.primaryText,
    fontFamily: type.body,
    fontSize: 14,
    fontWeight: "700",
  },
  header: {
    marginBottom: 2,
  },
  kicker: {
    color: colors.info,
    fontFamily: type.body,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  title: {
    color: colors.text,
    fontFamily: type.display,
    fontSize: 32,
    lineHeight: 38,
    marginTop: 2,
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 14,
    marginTop: 3,
  },
  heroCard: {
    position: "relative",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: 18,
    padding: 14,
    gap: 12,
  },
  heroTopRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  avatarShell: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: "#D8EAFB",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarInitials: {
    color: colors.text,
    fontFamily: type.body,
    fontSize: 24,
    fontWeight: "800",
  },
  heroTextWrap: {
    flex: 1,
    gap: 4,
  },
  heroName: {
    color: colors.text,
    fontFamily: type.body,
    fontSize: 20,
    fontWeight: "800",
  },
  heroMeta: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 12,
  },
  avatarActions: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  avatarActionsCompact: {
    flexDirection: "column",
  },
  avatarActionButton: {
    minWidth: 130,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F3A3A3",
    backgroundColor: "#FFE5E5",
  },
  errorBannerText: {
    flex: 1,
    color: colors.error,
    fontFamily: type.body,
    fontSize: 13,
    fontWeight: "600",
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: type.body,
    fontSize: 16,
    fontWeight: "800",
  },
  fieldLabel: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginTop: 3,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: 12,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: colors.text,
    fontFamily: type.body,
    fontSize: 14,
  },
  readOnlyField: {
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: 12,
    backgroundColor: "#F0F4F8",
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  readOnlyText: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 14,
  },
  textArea: {
    minHeight: 94,
    textAlignVertical: "top",
  },
  inputDisabled: {
    opacity: 0.7,
  },
  preferenceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  preferenceLabel: {
    color: colors.text,
    fontFamily: type.body,
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
    paddingRight: 8,
  },
  segmentRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
  },
  segment: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    backgroundColor: colors.surfaceSoft,
  },
  segmentActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  segmentDisabled: {
    opacity: 0.55,
  },
  segmentText: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 13,
    fontWeight: "700",
  },
  segmentTextActive: {
    color: colors.primaryText,
  },
  rowButtons: {
    flexDirection: "row",
    gap: 8,
  },
  flexButton: {
    flex: 1,
  },
  primaryButton: {
    borderRadius: 12,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.primaryDark,
    paddingVertical: 11,
    alignItems: "center",
  },
  primaryButtonText: {
    color: colors.primaryText,
    fontFamily: type.body,
    fontSize: 14,
    fontWeight: "700",
  },
  ghostButton: {
    borderRadius: 12,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.stroke,
    paddingVertical: 11,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  ghostButtonText: {
    color: colors.text,
    fontFamily: type.body,
    fontSize: 13,
    fontWeight: "700",
  },
  dangerButton: {
    borderRadius: 12,
    backgroundColor: "#FFEDEE",
    borderWidth: 1,
    borderColor: "#F3A3A3",
    paddingVertical: 11,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  dangerButtonText: {
    color: colors.error,
    fontFamily: type.body,
    fontSize: 13,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  logoutButton: {
    marginTop: 4,
    borderRadius: 12,
    backgroundColor: "#FFE5E5",
    borderWidth: 1,
    borderColor: "#F3A3A3",
    paddingVertical: 11,
    alignItems: "center",
  },
  logoutButtonText: {
    color: colors.error,
    fontFamily: type.body,
    fontSize: 14,
    fontWeight: "700",
  },
  disabledText: {
    opacity: 0.6,
  },
});
